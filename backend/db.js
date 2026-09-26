const seedHospitals = require('./seed');

let MongoClient = null;
try {
  ({ MongoClient } = require('mongodb'));
} catch (_) {
  // MongoDB is optional. Hospital discovery continues with OSM + seed inventory.
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const OVERPASS_ENDPOINTS = [
  process.env.OVERPASS_URL,
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
].filter(Boolean);

const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME = process.env.MONGO_DB_NAME || process.env.DB_NAME || '';
const HOSPITAL_COLLECTION = process.env.HOSPITAL_COLLECTION || 'hospitals';

const GEOCODE_TTL_MS = 6 * 60 * 60 * 1000;      // 6 hours
const OVERPASS_TTL_MS = 10 * 60 * 1000;         // 10 minutes
const SEARCH_TTL_MS = 10 * 60 * 1000;           // 10 minutes
const ENDPOINT_COOLDOWN_MS = 45 * 1000;          // 45 seconds after an endpoint failure

let mongoClient = null;
let mongoDb = null;

const geocodeCache = new Map();
const overpassCache = new Map();
const searchCache = new Map();
const endpointCooldown = new Map();

function cleanText(v) {
  return v == null ? '' : String(v).trim();
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeName(v) {
  return cleanText(v)
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\uFFFF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cacheGet(map, key, ttl, allowStale = false) {
  const item = map.get(key);
  if (!item) return null;

  const fresh = Date.now() - item.time < ttl;
  if (fresh || allowStale) {
    return {
      value: item.value,
      fresh,
      ageMs: Date.now() - item.time
    };
  }
  return null;
}

function cacheSet(map, key, value) {
  map.set(key, { time: Date.now(), value });
}

function normalizeHospital(h, source = 'unknown') {
  const lat = toNumber(h.lat ?? h.latitude ?? h.location?.lat);
  const lng = toNumber(
    h.lng ??
    h.lon ??
    h.longitude ??
    h.location?.lng ??
    h.location?.lon
  );

  const bloodStock =
    h.bloodStock && typeof h.bloodStock === 'object'
      ? h.bloodStock
      : null;

  const bloodAvailable =
    Array.isArray(h.bloodAvailable)
      ? h.bloodAvailable
      : [];

  return {
    id: cleanText(h.id ?? h._id ?? h.osm_id ?? h.osmId) || undefined,
    name:
      cleanText(h.name ?? h.hospitalName ?? h.title) ||
      'Unnamed Hospital',
    address:
      cleanText(
        h.address ??
        h.fullAddress ??
        h.locationName ??
        h.location?.address ??
        h.addr
      ) || '',
    category: cleanText(h.category ?? h.type) || 'Hospital',
    phone:
      cleanText(
        h.phone ??
        h.telephone ??
        h.contactPhone ??
        h.contact ??
        h.emergencyLine
      ) || null,
    website: cleanText(h.website ?? h.url) || null,
    lat,
    lng,
    distanceKm: toNumber(h.distanceKm ?? h.distance),
    generalBeds: toNumber(h.generalBeds ?? h.availableBeds),
    availableBeds: toNumber(h.availableBeds ?? h.generalBeds),
    totalBeds: toNumber(h.totalBeds),
    icuBeds: toNumber(h.icuBeds),
    ventilators: toNumber(h.ventilators),
    bloodStock,
    bloodAvailable,
    emergency:
      h.emergency === true ||
      h.emergency === 'yes' ||
      h.emergency === '24x7'
        ? true
        : h.emergency === false
          ? false
          : null,
    source
  };
}

const localSeed = seedHospitals.map(h =>
  normalizeHospital(h, 'pulsepoint-inventory')
);

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function validIndiaCoordinates(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 6 &&
    lat <= 38.5 &&
    lng >= 68 &&
    lng <= 98
  );
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

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
  if (!uri || !MongoClient) {
    if (uri && !MongoClient) {
      console.warn(
        'MongoDB driver not installed; continuing without MongoDB.'
      );
    }
    return null;
  }

  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(uri, {
        serverSelectionTimeoutMS: 8000
      });
      await mongoClient.connect();
    }

    mongoDb = mongoClient.db(DB_NAME || undefined);
    console.log('MongoDB connected.');
    return mongoDb;
  } catch (err) {
    console.warn(
      'MongoDB unavailable; continuing with OSM + local inventory:',
      err.message
    );
    mongoClient = null;
    mongoDb = null;
    return null;
  }
}

async function searchMongoHospitals(query = '') {
  if (!mongoDb) return [];

  try {
    const collection = mongoDb.collection(HOSPITAL_COLLECTION);
    const q = cleanText(query);

    let docs;

    if (!q) {
      docs = await collection.find({}).limit(250).toArray();
    } else {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

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

    return docs.map(d => normalizeHospital(d, 'mongodb'));
  } catch (err) {
    console.warn('MongoDB hospital search skipped:', err.message);
    return [];
  }
}

function queryVariants(place) {
  const raw = cleanText(place);
  if (!raw) return [];

  const variants = [raw];

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
    if (pattern.test(raw)) {
      variants.push(raw.replace(pattern, replacement));
    }
  }

  return [...new Set(variants.map(v => v.trim()).filter(Boolean))].slice(0, 3);
}

function geocodeScore(row, originalQuery) {
  const display = normalizeName(row.display_name || '');
  const query = normalizeName(originalQuery);
  const queryTokens = query.split(' ').filter(Boolean);

  let score = Number(row.importance || 0) * 10;

  if (display.includes(query)) score += 100;

  const matchedTokens = queryTokens.filter(token =>
    display.includes(token)
  ).length;

  score += matchedTokens * 12;

  const type = String(
    row.addresstype ||
    row.type ||
    ''
  ).toLowerCase();

  if (['city', 'town', 'municipality', 'village', 'suburb'].includes(type)) {
    score += 35;
  } else if (type === 'county' || type === 'state_district') {
    score += 20;
  } else if (type === 'administrative') {
    score += 8;
  }

  return score;
}

async function geocodePlace(place) {
  const original = cleanText(place);
  if (!original) return null;

  const cacheKey = normalizeName(original);
  const cached = cacheGet(
    geocodeCache,
    cacheKey,
    GEOCODE_TTL_MS
  );

  if (cached?.fresh) return cached.value;

  const stale = cacheGet(
    geocodeCache,
    cacheKey,
    GEOCODE_TTL_MS,
    true
  )?.value || null;

  for (const variant of queryVariants(original)) {
    const url = new URL(NOMINATIM_URL);

    url.searchParams.set('q', variant);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'in');
    url.searchParams.set('addressdetails', '1');

    try {
      const rows = await fetchJson(
        url.toString(),
        {
          headers: {
            'User-Agent':
              'PulsePoint-EmergencyCare/2.0 (hospital-search; educational project)',
            'Accept': 'application/json',
            'Accept-Language': 'en'
          }
        },
        10000
      );

      if (!Array.isArray(rows) || !rows.length) continue;

      const ranked = rows
        .map(row => ({
          row,
          score: geocodeScore(row, original)
        }))
        .sort((a, b) => b.score - a.score);

      const best = ranked[0]?.row;

      if (!best) continue;

      const value = {
        lat: Number(best.lat),
        lng: Number(best.lon),
        displayName: best.display_name || variant,
        type: best.addresstype || best.type || '',
        boundingbox: best.boundingbox || null
      };

      if (validIndiaCoordinates(value.lat, value.lng)) {
        cacheSet(geocodeCache, cacheKey, value);
        return value;
      }
    } catch (err) {
      console.warn(
        `Geocoding attempt failed for "${variant}":`,
        err.message
      );
    }
  }

  // If Nominatim temporarily fails, a previously successful geocode is safer
  // than returning nothing.
  return stale;
}

function buildOverpassQuery(lat, lng, radius) {
  return `[out:json][timeout:18];(
    nwr["amenity"="hospital"](around:${radius},${lat},${lng});
    nwr["healthcare"="hospital"](around:${radius},${lat},${lng});
  );out center tags;`;
}

async function fetchOSMFromEndpoint(endpoint, lat, lng, radius) {
  const result = await fetchJson(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'PulsePoint-EmergencyCare/2.0 (hospital-search; educational project)'
      },
      body: new URLSearchParams({
        data: buildOverpassQuery(lat, lng, radius)
      }).toString()
    },
    18000
  );

  const elements = Array.isArray(result?.elements)
    ? result.elements
    : [];

  const seenOsm = new Set();

  return elements
    .filter(item => {
      const key = `${item.type}-${item.id}`;
      if (seenOsm.has(key)) return false;
      seenOsm.add(key);
      return true;
    })
    .map(item => {
      const t = item.tags || {};
      const itemLat = Number(
        item.lat ??
        item.center?.lat
      );
      const itemLng = Number(
        item.lon ??
        item.center?.lon
      );

      const name =
        t.name ||
        t['name:en'] ||
        t['name:bn'];

      const address = [
        t['addr:housenumber'],
        t['addr:street'],
        t['addr:place'],
        t['addr:suburb'],
        t['addr:city'],
        t['addr:town'],
        t['addr:village'],
        t['addr:district'],
        t['addr:state'],
        t['addr:postcode']
      ].filter(Boolean).join(', ');

      return normalizeHospital(
        {
          id: `osm-${item.type}-${item.id}`,
          name,
          address,
          phone:
            t.phone ||
            t['contact:phone'] ||
            t['contact:mobile'],
          website:
            t.website ||
            t['contact:website'],
          lat: itemLat,
          lng: itemLng,
          emergency: t.emergency
        },
        'openstreetmap'
      );
    })
    .filter(h =>
      h.name !== 'Unnamed Hospital' &&
      validIndiaCoordinates(h.lat, h.lng)
    );
}

async function fetchOSMHospitals(lat, lng, radiusMeters = 25000) {
  if (!validIndiaCoordinates(lat, lng)) return [];

  const radius = Math.min(
    Math.max(Number(radiusMeters) || 25000, 1000),
    50000
  );

  const cacheKey =
    `${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`;

  const cached = cacheGet(
    overpassCache,
    cacheKey,
    OVERPASS_TTL_MS
  );

  if (cached?.fresh) return cached.value;

  const stale = cacheGet(
    overpassCache,
    cacheKey,
    OVERPASS_TTL_MS,
    true
  )?.value || [];

  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const cooldownUntil =
      endpointCooldown.get(endpoint) || 0;

    if (cooldownUntil > Date.now()) {
      continue;
    }

    try {
      const hospitals = await fetchOSMFromEndpoint(
        endpoint,
        lat,
        lng,
        radius
      );

      endpointCooldown.delete(endpoint);
      cacheSet(overpassCache, cacheKey, hospitals);
      return hospitals;
    } catch (err) {
      lastError = err;
      endpointCooldown.set(
        endpoint,
        Date.now() + ENDPOINT_COOLDOWN_MS
      );

      console.warn(
        `Overpass endpoint failed: ${endpoint}`,
        err.message
      );
    }
  }

  if (stale.length) {
    console.warn(
      'All live Overpass endpoints failed; using cached hospital locations.'
    );
    return stale;
  }

  if (lastError) {
    console.warn(
      'All Overpass endpoints failed:',
      lastError.message
    );
  }

  return [];
}

function mergeHospital(base, incoming) {
  const incomingIsInventory =
    incoming.source === 'mongodb' ||
    incoming.source === 'pulsepoint-inventory';

  if (!incomingIsInventory) {
    return {
      ...incoming,
      ...base,
      phone: base.phone || incoming.phone,
      website: base.website || incoming.website
    };
  }

  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(incoming).filter(
        ([, value]) =>
          value !== null &&
          value !== '' &&
          value !== undefined
      )
    ),
    lat: base.lat ?? incoming.lat,
    lng: base.lng ?? incoming.lng,
    address: base.address || incoming.address,
    phone: incoming.phone || base.phone,
    website: incoming.website || base.website,
    source: incoming.source
  };
}

function sameHospital(a, b) {
  const aName = normalizeName(a.name);
  const bName = normalizeName(b.name);

  if (!aName || !bName) return false;

  if (aName === bName) {
    if (
      a.lat == null ||
      a.lng == null ||
      b.lat == null ||
      b.lng == null
    ) {
      return true;
    }

    return haversineKm(
      a.lat,
      a.lng,
      b.lat,
      b.lng
    ) < 1.5;
  }

  // Also catch minor name differences when two records are almost at the same point.
  if (
    a.lat != null &&
    a.lng != null &&
    b.lat != null &&
    b.lng != null
  ) {
    const close =
      haversineKm(
        a.lat,
        a.lng,
        b.lat,
        b.lng
      ) < 0.25;

    if (close) {
      const aWords = new Set(aName.split(' '));
      const bWords = new Set(bName.split(' '));
      const common = [...aWords].filter(word =>
        word.length > 3 && bWords.has(word)
      );

      return common.length >= 2;
    }
  }

  return false;
}

function dedupeHospitals(hospitals) {
  const output = [];

  for (const hospital of hospitals) {
    if (!hospital?.name) continue;

    const idx = output.findIndex(existing =>
      sameHospital(existing, hospital)
    );

    if (idx < 0) {
      output.push(hospital);
    } else {
      output[idx] = mergeHospital(
        output[idx],
        hospital
      );
    }
  }

  return output;
}

function addDistance(hospitals, lat, lng) {
  return hospitals
    .filter(h =>
      validIndiaCoordinates(h.lat, h.lng)
    )
    .map(h => ({
      ...h,
      distanceKm: Number(
        haversineKm(
          lat,
          lng,
          h.lat,
          h.lng
        ).toFixed(2)
      )
    }));
}

function sortByDistance(hospitals) {
  return hospitals.sort(
    (a, b) =>
      (a.distanceKm ?? Infinity) -
      (b.distanceKm ?? Infinity)
  );
}

async function inventoryHospitals() {
  const mongo = await searchMongoHospitals('');
  return dedupeHospitals([
    ...localSeed,
    ...mongo
  ]);
}

async function searchNearbyHospitals(
  latitude,
  longitude,
  radiusMeters = 25000,
  limit = 30
) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!validIndiaCoordinates(lat, lng)) {
    throw new Error(
      'Invalid Indian latitude/longitude'
    );
  }

  const requestedRadius = Math.min(
    Math.max(Number(radiusMeters) || 25000, 1000),
    50000
  );

  const maxResults = Math.min(
    Math.max(Number(limit) || 30, 1),
    100
  );

  const inventory = await inventoryHospitals();

  // Search the requested radius first.
  let live = await fetchOSMHospitals(
    lat,
    lng,
    requestedRadius
  );

  // Rural / sparse area fallback: widen to 35 km and then 50 km,
  // but stop early as soon as we have a useful set of hospitals.
  const radii = [
    requestedRadius,
    35000,
    50000
  ].filter(
    (value, index, arr) =>
      value >= requestedRadius &&
      arr.indexOf(value) === index
  );

  for (const radius of radii) {
    if (live.length >= 5) break;
    if (radius === requestedRadius) continue;

    const wider = await fetchOSMHospitals(
      lat,
      lng,
      radius
    );

    live = dedupeHospitals([
      ...live,
      ...wider
    ]);
  }

  const maxUsedRadius =
    live.length >= 5
      ? Math.max(
          requestedRadius,
          ...live.map(() => requestedRadius)
        )
      : 50000;

  const inventoryNearby = addDistance(
    inventory,
    lat,
    lng
  ).filter(h =>
    h.distanceKm <=
    Math.max(requestedRadius, maxUsedRadius) / 1000
  );

  const liveNearby = addDistance(
    live,
    lat,
    lng
  ).filter(h =>
    h.distanceKm <= 50
  );

  const merged = dedupeHospitals([
    ...liveNearby,
    ...inventoryNearby
  ]);

  return sortByDistance(merged)
    .slice(0, maxResults);
}

async function searchAllIndia(query = '') {
  const q = cleanText(query);

  if (!q) {
    return localSeed;
  }

  const cacheKey = normalizeName(q);

  const cached = cacheGet(
    searchCache,
    cacheKey,
    SEARCH_TTL_MS
  );

  if (cached?.fresh) {
    return cached.value;
  }

  const staleSearch = cacheGet(
    searchCache,
    cacheKey,
    SEARCH_TTL_MS,
    true
  )?.value || [];

  const place = await geocodePlace(q);

  if (
    !place ||
    !validIndiaCoordinates(
      place.lat,
      place.lng
    )
  ) {
    const lower = q.toLowerCase();

    const seedMatches = localSeed.filter(h =>
      `${h.name} ${h.address} ${h.category}`
        .toLowerCase()
        .includes(lower)
    );

    const mongoMatches =
      await searchMongoHospitals(q);

    const fallback = dedupeHospitals([
      ...seedMatches,
      ...mongoMatches
    ]);

    if (fallback.length) {
      cacheSet(
        searchCache,
        cacheKey,
        fallback
      );
      return fallback;
    }

    return staleSearch;
  }

  let results = await searchNearbyHospitals(
    place.lat,
    place.lng,
    25000,
    40
  );

  if (!results.length) {
    results = await searchNearbyHospitals(
      place.lat,
      place.lng,
      50000,
      40
    );
  }

  if (results.length) {
    cacheSet(
      searchCache,
      cacheKey,
      results
    );
    return results;
  }

  // If external services are temporarily unavailable, use the last successful
  // result for the same place rather than leaving the user on a spinner.
  return staleSearch;
}

module.exports = {
  connectDB,
  searchAllIndia,
  searchNearbyHospitals,
  normalizeHospital,
  haversineKm
};
