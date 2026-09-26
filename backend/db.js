const seedHospitals = require('./seed');

let MongoClient = null;
try {
  ({ MongoClient } = require('mongodb'));
} catch (_) {
  // MongoDB is optional. OSM discovery still works without it.
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = [
  process.env.OVERPASS_URL,
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
].filter(Boolean);

const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME = process.env.MONGO_DB_NAME || process.env.DB_NAME || '';
const COLLECTION = process.env.HOSPITAL_COLLECTION || 'hospitals';

const GEOCODE_TTL = 6 * 60 * 60 * 1000;
const HOSPITAL_TTL = 10 * 60 * 1000;
const ENDPOINT_COOLDOWN = 45 * 1000;

let mongoClient = null;
let mongoDb = null;

const geocodeCache = new Map();
const hospitalCache = new Map();
const endpointCooldown = new Map();

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function keyText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\uFFFF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapServiceError(message, cause = null) {
  const error = new Error(message);
  error.code = 'MAP_SERVICE_UNAVAILABLE';
  if (cause) error.cause = cause;
  return error;
}

function cacheGet(map, key, ttl, allowStale = false) {
  const row = map.get(key);
  if (!row) return null;
  const fresh = Date.now() - row.time < ttl;
  if (!fresh && !allowStale) return null;
  return { value: row.value, fresh, ageMs: Date.now() - row.time };
}

function cacheSet(map, key, value) {
  map.set(key, { time: Date.now(), value });
}

function normalize(h, source = 'unknown') {
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
    phone: clean(h?.phone ?? h?.contact ?? h?.emergencyLine) || null,
    website: clean(h?.website ?? h?.url) || null,
    lat: number(h?.lat ?? h?.latitude ?? h?.location?.lat),
    lng: number(h?.lng ?? h?.lon ?? h?.longitude ?? h?.location?.lng),
    distanceKm: number(h?.distanceKm ?? h?.distance),
    generalBeds: number(h?.generalBeds ?? h?.availableBeds),
    availableBeds: number(h?.availableBeds ?? h?.generalBeds),
    totalBeds: number(h?.totalBeds),
    icuBeds: number(h?.icuBeds),
    ventilators: number(h?.ventilators),
    bloodStock,
    bloodAvailable: Array.isArray(h?.bloodAvailable) ? h.bloodAvailable : [],
    source
  };
}

const seed = seedHospitals.map(h => normalize(h, 'pulsepoint-inventory'));

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

async function fetchJson(url, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function connectDB(uri = MONGO_URI) {
  if (!uri || !MongoClient) return null;

  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
      await mongoClient.connect();
    }
    mongoDb = mongoClient.db(DB_NAME || undefined);
    console.log('MongoDB connected.');
    return mongoDb;
  } catch (error) {
    console.warn('MongoDB unavailable; continuing without it:', error.message);
    mongoClient = null;
    mongoDb = null;
    return null;
  }
}

async function mongoHospitals(query = '') {
  if (!mongoDb) return [];

  try {
    const collection = mongoDb.collection(COLLECTION);
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

    return docs.map(h => normalize(h, 'mongodb'));
  } catch (error) {
    console.warn('MongoDB hospital lookup skipped:', error.message);
    return [];
  }
}

function variants(place) {
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

  return [...new Set(result)].slice(0, 3);
}

function geocodeScore(row, query) {
  const display = keyText(row?.display_name);
  const q = keyText(query);
  const tokens = q.split(' ').filter(Boolean);
  const type = clean(row?.addresstype ?? row?.type).toLowerCase();

  let score = Number(row?.importance || 0) * 10;
  if (display.includes(q)) score += 100;
  score += tokens.filter(t => display.includes(t)).length * 12;

  if (['city', 'town', 'municipality', 'village', 'suburb'].includes(type)) score += 35;
  else if (['county', 'state_district'].includes(type)) score += 20;
  else if (type === 'administrative') score += 8;

  return score;
}

async function geocodePlace(place) {
  const q = clean(place);
  if (!q) return null;

  const cacheKey = keyText(q);
  const fresh = cacheGet(geocodeCache, cacheKey, GEOCODE_TTL);
  if (fresh?.fresh) return fresh.value;

  const stale = cacheGet(geocodeCache, cacheKey, GEOCODE_TTL, true)?.value || null;
  let gotNormalResponse = false;
  let lastError = null;

  for (const variant of variants(q)) {
    const url = new URL(NOMINATIM);
    url.searchParams.set('q', variant);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'in');
    url.searchParams.set('addressdetails', '1');

    try {
      const rows = await fetchJson(url.toString(), {
        headers: {
          'User-Agent': 'PulsePoint-EmergencyCare/3.0 (educational project)',
          'Accept': 'application/json',
          'Accept-Language': 'en'
        }
      }, 10000);

      gotNormalResponse = true;
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
    } catch (error) {
      lastError = error;
      console.warn(`Geocoding failed for ${variant}:`, error.message);
    }
  }

  if (stale) return stale;
  if (gotNormalResponse) return null;

  if (lastError) {
    throw mapServiceError(
      'The place-name map service is temporarily unavailable. Please retry in a moment.',
      lastError
    );
  }

  return null;
}

function overpassQuery(lat, lng, radius) {
  return `[out:json][timeout:18];(
    nwr["amenity"="hospital"](around:${radius},${lat},${lng});
    nwr["healthcare"="hospital"](around:${radius},${lat},${lng});
  );out center tags;`;
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
  const json = await fetchJson(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'PulsePoint-EmergencyCare/3.0 (educational project)'
    },
    body: new URLSearchParams({ data: overpassQuery(lat, lng, radius) }).toString()
  }, 18000);

  const elements = Array.isArray(json?.elements) ? json.elements : [];
  const seen = new Set();

  return elements
    .filter(item => {
      const key = `${item.type}-${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(item => {
      const t = item.tags || {};
      return normalize({
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
}

async function osmHospitals(lat, lng, radiusMeters) {
  const radius = Math.min(Math.max(Number(radiusMeters) || 25000, 1000), 50000);
  const key = `${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`;

  const fresh = cacheGet(hospitalCache, key, HOSPITAL_TTL);
  if (fresh?.fresh) return fresh.value;

  const stale = cacheGet(hospitalCache, key, HOSPITAL_TTL, true)?.value || [];
  let lastError = null;
  let tried = 0;

  for (const endpoint of OVERPASS) {
    if ((endpointCooldown.get(endpoint) || 0) > Date.now()) continue;
    tried++;

    try {
      const list = await overpassFrom(endpoint, lat, lng, radius);
      endpointCooldown.delete(endpoint);
      cacheSet(hospitalCache, key, list);
      return list;
    } catch (error) {
      lastError = error;
      endpointCooldown.set(endpoint, Date.now() + ENDPOINT_COOLDOWN);
      console.warn(`Overpass failed: ${endpoint}`, error.message);
    }
  }

  if (stale.length) return stale;

  if (lastError || tried === 0) {
    throw mapServiceError(
      'Public hospital map services are temporarily unavailable. Please retry in a moment.',
      lastError
    );
  }

  return [];
}

function sameHospital(a, b) {
  const an = keyText(a.name);
  const bn = keyText(b.name);
  if (!an || !bn) return false;

  if (an === bn) {
    if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return true;
    return haversineKm(a.lat, a.lng, b.lat, b.lng) < 1.5;
  }

  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    if (haversineKm(a.lat, a.lng, b.lat, b.lng) < 0.25) {
      const aw = new Set(an.split(' ').filter(w => w.length > 3));
      const common = bn.split(' ').filter(w => aw.has(w));
      return common.length >= 2;
    }
  }

  return false;
}

function mergeHospital(base, incoming) {
  const inventory = ['mongodb', 'pulsepoint-inventory'].includes(incoming.source);

  if (!inventory) {
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

async function inventory() {
  return dedupe([...seed, ...(await mongoHospitals(''))]);
}

async function searchNearbyHospitals(latValue, lngValue, radiusMeters = 25000, limit = 30) {
  const lat = Number(latValue);
  const lng = Number(lngValue);
  if (!validIndia(lat, lng)) throw new Error('Invalid Indian latitude/longitude');

  const requested = Math.min(Math.max(Number(radiusMeters) || 25000, 1000), 50000);
  const maxResults = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const radii = [...new Set([requested, 35000, 50000].filter(r => r >= requested))];

  let live = [];
  for (const radius of radii) {
    const found = await osmHospitals(lat, lng, radius);
    live = dedupe([...live, ...found]);
    if (live.length >= 5) break;
  }

  const local = withDistance(await inventory(), lat, lng)
    .filter(h => h.distanceKm <= 50);
  const discovered = withDistance(live, lat, lng)
    .filter(h => h.distanceKm <= 50);

  return dedupe([...discovered, ...local])
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    .slice(0, maxResults);
}

async function searchAllIndia(query = '') {
  const q = clean(query);
  if (!q) return dedupe([...seed, ...(await mongoHospitals(''))]);

  const place = await geocodePlace(q);

  if (!place) {
    // The geocoder responded normally but did not recognise the place.
    // Only return matching local inventory; never return unrelated seed hospitals.
    const local = await mongoHospitals(q);
    const seedMatches = seed.filter(h =>
      `${h.name} ${h.address} ${h.category}`.toLowerCase().includes(q.toLowerCase())
    );
    return dedupe([...local, ...seedMatches]);
  }

  return searchNearbyHospitals(place.lat, place.lng, 25000, 40);
}

module.exports = {
  connectDB,
  searchAllIndia,
  searchNearbyHospitals,
  normalizeHospital: normalize,
  haversineKm
};
