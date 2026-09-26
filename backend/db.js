const seedHospitals = require('./seed');

let MongoClient = null;
try {
  ({ MongoClient } = require('mongodb'));
} catch (_) {
  // MongoDB is optional at runtime. OSM discovery still works without it.
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_ENDPOINTS = [
  process.env.OVERPASS_URL,
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
].filter(Boolean);

const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME = process.env.MONGO_DB_NAME || process.env.DB_NAME || 'pulsepoint';
const HOSPITAL_COLLECTION = process.env.HOSPITAL_COLLECTION || 'hospitals';

const GEOCODE_TTL_MS = 6 * 60 * 60 * 1000;
const HOSPITAL_TTL_MS = 10 * 60 * 1000;
const ENDPOINT_COOLDOWN_MS = 60 * 1000;
const OVERPASS_TIMEOUT_MS = 10000;
const NOMINATIM_TIMEOUT_MS = 9000;

let mongoClient = null;
let mongoDb = null;

const geocodeCache = new Map();
const hospitalCache = new Map();
const endpointCooldown = new Map();

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\uFFFF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function serviceError(message, cause = null) {
  const err = new Error(message);
  err.code = 'MAP_SERVICE_UNAVAILABLE';
  if (cause) err.cause = cause;
  return err;
}

function cacheGet(map, key, ttl, allowStale = false) {
  const row = map.get(key);
  if (!row) return null;
  const ageMs = Date.now() - row.time;
  const fresh = ageMs < ttl;
  if (!fresh && !allowStale) return null;
  return { value: row.value, fresh, ageMs };
}

function cacheSet(map, key, value) {
  map.set(key, { time: Date.now(), value });
}

function normalizeHospital(h, source = 'unknown') {
  const bloodStock = h?.bloodStock && typeof h.bloodStock === 'object'
    ? h.bloodStock
    : null;

  return {
    id: clean(h?.id ?? h?._id ?? h?.osm_id) || undefined,
    name: clean(h?.name ?? h?.hospitalName ?? h?.title) || 'Unnamed Hospital',
    address: clean(
      h?.address ??
      h?.fullAddress ??
      h?.locationName ??
      (typeof h?.location === 'string' ? h.location : '')
    ),
    category: clean(h?.category ?? h?.type) || 'Hospital',
    phone: clean(h?.phone ?? h?.telephone ?? h?.contact ?? h?.emergencyLine) || null,
    website: clean(h?.website ?? h?.url) || null,
    lat: toNumber(h?.lat ?? h?.latitude ?? h?.location?.lat),
    lng: toNumber(h?.lng ?? h?.lon ?? h?.longitude ?? h?.location?.lng ?? h?.location?.lon),
    distanceKm: toNumber(h?.distanceKm ?? h?.distance),
    generalBeds: toNumber(h?.generalBeds ?? h?.availableBeds),
    availableBeds: toNumber(h?.availableBeds ?? h?.generalBeds),
    totalBeds: toNumber(h?.totalBeds),
    icuBeds: toNumber(h?.icuBeds),
    ventilators: toNumber(h?.ventilators),
    bloodStock,
    bloodAvailable: Array.isArray(h?.bloodAvailable) ? h.bloodAvailable : [],
    doctors: Array.isArray(h?.doctors) ? h.doctors : [],
    organs: Array.isArray(h?.organs) ? h.organs : [],
    source
  };
}

const seed = seedHospitals.map(h => normalizeHospital(h, 'pulsepoint-inventory'));

function validIndia(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= 6 && lat <= 38.5 && lng >= 68 && lng <= 98;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return await response.json();
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeout = new Error('REQUEST_TIMEOUT');
      timeout.code = 'TIMEOUT';
      throw timeout;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function connectDB(uri = MONGO_URI) {
  if (!uri || !MongoClient) return null;
  if (mongoDb) return mongoDb;

  try {
    mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    await mongoClient.connect();
    mongoDb = mongoClient.db(DB_NAME);
    console.log(`MongoDB connected: ${DB_NAME}`);
    return mongoDb;
  } catch (err) {
    console.warn('MongoDB unavailable; continuing with public map data + local fallback:', err.message);
    try { await mongoClient?.close(); } catch (_) {}
    mongoClient = null;
    mongoDb = null;
    return null;
  }
}

function getDatabase() {
  return mongoDb;
}

async function mongoHospitals(query = '') {
  if (!mongoDb) return [];

  try {
    const collection = mongoDb.collection(HOSPITAL_COLLECTION);
    const q = clean(query);
    let docs;

    if (!q) {
      docs = await collection.find({}).limit(250).toArray();
    } else {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      docs = await collection.find({
        $or: [
          { name: regex },
          { hospitalName: regex },
          { address: regex },
          { city: regex },
          { district: regex },
          { state: regex },
          { location: regex }
        ]
      }).limit(100).toArray();
    }

    return docs.map(h => normalizeHospital(h, 'mongodb'));
  } catch (err) {
    console.warn('MongoDB hospital lookup skipped:', err.message);
    return [];
  }
}

function placeVariants(place) {
  const q = clean(place);
  if (!q) return [];

  const result = [q];
  const aliases = [
    [/\bmedinipur\b/i, 'Midnapore'],
    [/\bmidnapore\b/i, 'Medinipur'],
    [/\bburdwan\b/i, 'Bardhaman'],
    [/\bbardhaman\b/i, 'Burdwan'],
    [/\bcalcutta\b/i, 'Kolkata'],
    [/\bbombay\b/i, 'Mumbai'],
    [/\bmadras\b/i, 'Chennai'],
    [/\bbangalore\b/i, 'Bengaluru']
  ];

  for (const [pattern, replacement] of aliases) {
    if (pattern.test(q)) result.push(q.replace(pattern, replacement));
  }

  return [...new Set(result.map(x => x.trim()).filter(Boolean))].slice(0, 3);
}

function geocodeScore(row, query) {
  const display = normalizeText(row?.display_name);
  const q = normalizeText(query);
  const tokens = q.split(' ').filter(Boolean);
  const type = clean(row?.addresstype ?? row?.type).toLowerCase();

  let score = Number(row?.importance || 0) * 10;
  if (q && display.includes(q)) score += 100;
  score += tokens.filter(t => display.includes(t)).length * 12;

  if (['city', 'town', 'municipality', 'village', 'suburb'].includes(type)) score += 35;
  else if (['county', 'state_district'].includes(type)) score += 20;
  else if (type === 'administrative') score += 8;

  return score;
}

async function geocodePlace(place) {
  const q = clean(place);
  if (!q) return null;

  const cacheKey = normalizeText(q);
  const fresh = cacheGet(geocodeCache, cacheKey, GEOCODE_TTL_MS);
  if (fresh?.fresh) return fresh.value;
  const stale = cacheGet(geocodeCache, cacheKey, GEOCODE_TTL_MS, true)?.value || null;

  let sawSuccessfulResponse = false;
  let lastError = null;

  for (const variant of placeVariants(q)) {
    const url = new URL(NOMINATIM);
    url.searchParams.set('q', variant);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'in');
    url.searchParams.set('addressdetails', '1');

    try {
      const rows = await fetchJson(url.toString(), {
        headers: {
          'User-Agent': 'PulsePoint-EmergencyCare/4.0 (educational project)',
          Accept: 'application/json',
          'Accept-Language': 'en'
        }
      }, NOMINATIM_TIMEOUT_MS);

      sawSuccessfulResponse = true;
      if (!Array.isArray(rows) || !rows.length) continue;

      const best = rows
        .map(row => ({ row, score: geocodeScore(row, q) }))
        .sort((a, b) => b.score - a.score)[0]?.row;

      if (!best) continue;
      const value = {
        lat: Number(best.lat),
        lng: Number(best.lon),
        displayName: best.display_name || variant
      };

      if (validIndia(value.lat, value.lng)) {
        cacheSet(geocodeCache, cacheKey, value);
        return value;
      }
    } catch (err) {
      lastError = err;
      console.warn(`Geocoding failed for ${variant}:`, err.message);
    }
  }

  if (stale) return stale;
  if (sawSuccessfulResponse) return null;

  throw serviceError(
    'The place-name map service is temporarily unavailable. Please retry in a moment.',
    lastError
  );
}

function overpassQuery(lat, lng, radius) {
  return `[out:json][timeout:12];(
    nwr["amenity"="hospital"](around:${radius},${lat},${lng});
    nwr["healthcare"="hospital"](around:${radius},${lat},${lng});
  );out center tags qt;`;
}

function osmAddress(tags) {
  return [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:place'],
    tags['addr:suburb'],
    tags['addr:city'],
    tags['addr:town'],
    tags['addr:village'],
    tags['addr:district'],
    tags['addr:state'],
    tags['addr:postcode']
  ].filter(Boolean).join(', ');
}

async function overpassFrom(endpoint, lat, lng, radius) {
  const started = Date.now();
  const json = await fetchJson(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'PulsePoint-EmergencyCare/4.0 (educational project)'
    },
    body: new URLSearchParams({ data: overpassQuery(lat, lng, radius) }).toString()
  }, OVERPASS_TIMEOUT_MS);

  const elements = Array.isArray(json?.elements) ? json.elements : [];
  const seen = new Set();
  const hospitals = elements
    .filter(item => {
      const key = `${item.type}-${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(item => {
      const t = item.tags || {};
      return normalizeHospital({
        id: `osm-${item.type}-${item.id}`,
        name: t.name || t['name:en'] || t['name:bn'],
        address: osmAddress(t),
        phone: t.phone || t['contact:phone'] || t['contact:mobile'],
        website: t.website || t['contact:website'],
        lat: item.lat ?? item.center?.lat,
        lng: item.lon ?? item.center?.lon
      }, 'openstreetmap');
    })
    .filter(h => h.name !== 'Unnamed Hospital' && validIndia(h.lat, h.lng));

  return { endpoint, hospitals, elapsedMs: Date.now() - started };
}

async function osmHospitals(lat, lng, radiusMeters = 30000) {
  if (!validIndia(lat, lng)) return [];

  const radius = Math.min(Math.max(Number(radiusMeters) || 30000, 1000), 50000);
  const cacheKey = `${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`;

  const fresh = cacheGet(hospitalCache, cacheKey, HOSPITAL_TTL_MS);
  if (fresh?.fresh) return fresh.value;
  const stale = cacheGet(hospitalCache, cacheKey, HOSPITAL_TTL_MS, true)?.value || [];

  const candidates = OVERPASS_ENDPOINTS.filter(endpoint =>
    (endpointCooldown.get(endpoint) || 0) <= Date.now()
  );

  const endpoints = candidates.length ? candidates : OVERPASS_ENDPOINTS;

  // All providers are queried concurrently. This avoids 18s + 18s + 18s sequential delays.
  const settled = await Promise.allSettled(
    endpoints.map(endpoint => overpassFrom(endpoint, lat, lng, radius))
  );

  const successful = [];
  let lastError = null;

  settled.forEach((result, index) => {
    const endpoint = endpoints[index];
    if (result.status === 'fulfilled') {
      endpointCooldown.delete(endpoint);
      successful.push(result.value);
    } else {
      lastError = result.reason;
      endpointCooldown.set(endpoint, Date.now() + ENDPOINT_COOLDOWN_MS);
      console.warn(`Overpass failed: ${endpoint}`, result.reason?.message || result.reason);
    }
  });

  const nonEmpty = successful
    .filter(x => x.hospitals.length)
    .sort((a, b) => a.elapsedMs - b.elapsedMs);

  if (nonEmpty.length) {
    cacheSet(hospitalCache, cacheKey, nonEmpty[0].hospitals);
    return nonEmpty[0].hospitals;
  }

  // A successful empty result means the service worked but no mapped hospitals were found.
  if (successful.length) {
    cacheSet(hospitalCache, cacheKey, []);
    return [];
  }

  if (stale.length) {
    console.warn('All live Overpass providers failed; using backend cache.');
    return stale;
  }

  throw serviceError(
    'Public hospital map services are temporarily unavailable. Please retry in a moment.',
    lastError
  );
}

function sameHospital(a, b) {
  const an = normalizeText(a.name);
  const bn = normalizeText(b.name);
  if (!an || !bn) return false;

  if (an === bn) {
    if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return true;
    return haversineKm(a.lat, a.lng, b.lat, b.lng) < 1.5;
  }

  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    if (haversineKm(a.lat, a.lng, b.lat, b.lng) < 0.25) {
      const aw = new Set(an.split(' ').filter(w => w.length > 3));
      return bn.split(' ').filter(w => aw.has(w)).length >= 2;
    }
  }

  return false;
}

function mergeHospital(base, incoming) {
  const incomingInventory = ['mongodb', 'pulsepoint-inventory'].includes(incoming.source);
  if (!incomingInventory) {
    return {
      ...incoming,
      ...base,
      phone: base.phone || incoming.phone,
      website: base.website || incoming.website
    };
  }

  const merged = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== null && value !== undefined && value !== '') merged[key] = value;
  }
  merged.lat = base.lat ?? incoming.lat;
  merged.lng = base.lng ?? incoming.lng;
  merged.address = base.address || incoming.address;
  merged.source = incoming.source;
  return merged;
}

function dedupe(list) {
  const result = [];
  for (const item of list) {
    if (!item?.name) continue;
    const index = result.findIndex(existing => sameHospital(existing, item));
    if (index < 0) result.push(item);
    else result[index] = mergeHospital(result[index], item);
  }
  return result;
}

function withDistance(list, lat, lng) {
  return list
    .filter(h => validIndia(h.lat, h.lng))
    .map(h => ({
      ...h,
      distanceKm: Number(haversineKm(lat, lng, h.lat, h.lng).toFixed(2))
    }));
}

async function inventoryHospitals() {
  return dedupe([...seed, ...(await mongoHospitals(''))]);
}

async function searchNearbyHospitals(latValue, lngValue, radiusMeters = 30000, limit = 30) {
  const lat = Number(latValue);
  const lng = Number(lngValue);
  if (!validIndia(lat, lng)) throw new Error('Invalid Indian latitude/longitude');

  const requested = Math.min(Math.max(Number(radiusMeters) || 30000, 1000), 50000);
  const maxResults = Math.min(Math.max(Number(limit) || 30, 1), 100);

  let live = await osmHospitals(lat, lng, requested);

  // Only one wider fallback round, and only when the first round is sparse.
  if (live.length < 3 && requested < 50000) {
    const wider = await osmHospitals(lat, lng, 50000);
    live = dedupe([...live, ...wider]);
  }

  const local = withDistance(await inventoryHospitals(), lat, lng)
    .filter(h => h.distanceKm <= 50);
  const discovered = withDistance(live, lat, lng)
    .filter(h => h.distanceKm <= 50);

  return dedupe([...discovered, ...local])
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    .slice(0, maxResults);
}

async function searchAllIndia(query = '') {
  const q = clean(query);
  if (!q) return inventoryHospitals();

  const place = await geocodePlace(q);
  if (!place) {
    const mongoMatches = await mongoHospitals(q);
    const seedMatches = seed.filter(h =>
      `${h.name} ${h.address} ${h.category}`.toLowerCase().includes(q.toLowerCase())
    );
    return dedupe([...mongoMatches, ...seedMatches]);
  }

  return searchNearbyHospitals(place.lat, place.lng, 30000, 40);
}

module.exports = {
  connectDB,
  getDatabase,
  searchAllIndia,
  searchNearbyHospitals,
  normalizeHospital,
  haversineKm
};
