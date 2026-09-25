const seedHospitals = require('./seed');

let MongoClient = null;
try {
  ({ MongoClient } = require('mongodb'));
} catch (_) {
  // Mongo is optional. Hospital discovery still works from OSM + seed inventory.
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_ENDPOINTS = [
  process.env.OVERPASS_URL,
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
].filter(Boolean);

const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME = process.env.MONGO_DB_NAME || process.env.DB_NAME || '';
const HOSPITAL_COLLECTION = process.env.HOSPITAL_COLLECTION || 'hospitals';

let mongoClient = null;
let mongoDb = null;
const geocodeCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cleanText(v) { return v == null ? '' : String(v).trim(); }
function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function normalizeName(v) {
  return cleanText(v).toLowerCase().replace(/[^a-z0-9\u00c0-\uFFFF]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeHospital(h, source = 'unknown') {
  const lat = toNumber(h.lat ?? h.latitude ?? h.location?.lat);
  const lng = toNumber(h.lng ?? h.lon ?? h.longitude ?? h.location?.lng ?? h.location?.lon);
  const bloodStock = h.bloodStock && typeof h.bloodStock === 'object' ? h.bloodStock : null;
  const bloodAvailable = Array.isArray(h.bloodAvailable) ? h.bloodAvailable : [];

  return {
    id: cleanText(h.id ?? h._id ?? h.osm_id ?? h.osmId) || undefined,
    name: cleanText(h.name ?? h.hospitalName ?? h.title) || 'Unnamed Hospital',
    address: cleanText(h.address ?? h.fullAddress ?? h.locationName ?? h.location?.address ?? h.addr) || '',
    category: cleanText(h.category ?? h.type) || 'Hospital',
    phone: cleanText(h.phone ?? h.telephone ?? h.contactPhone ?? h.contact ?? h.emergencyLine) || null,
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
    emergency: h.emergency === true || h.emergency === 'yes' || h.emergency === '24x7' ? true : (h.emergency === false ? false : null),
    source
  };
}

const localSeed = seedHospitals.map(h => normalizeHospital(h, 'pulsepoint-inventory'));

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function validIndiaCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 38.5 && lng >= 68 && lng <= 98;
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function connectDB(uri = MONGO_URI) {
  if (!uri || !MongoClient) {
    if (uri && !MongoClient) console.warn('MongoDB driver not installed; continuing without MongoDB.');
    return null;
  }
  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
      await mongoClient.connect();
    }
    mongoDb = mongoClient.db(DB_NAME || undefined);
    console.log('MongoDB connected.');
    return mongoDb;
  } catch (err) {
    console.warn('MongoDB unavailable; continuing with OSM + local inventory:', err.message);
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
          { name: regex }, { hospitalName: regex }, { address: regex },
          { city: regex }, { district: regex }, { state: regex }, { location: regex }
        ]
      }).limit(100).toArray();
    }
    return docs.map(d => normalizeHospital(d, 'mongodb'));
  } catch (err) {
    console.warn('MongoDB hospital search skipped:', err.message);
    return [];
  }
}

async function geocodePlace(place) {
  const q = cleanText(place);
  if (!q) return null;
  const key = q.toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.value;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', `${q}, India`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'in');

  try {
    const data = await fetchJson(url.toString(), {
      headers: {
        'User-Agent': 'PulsePoint-EmergencyCare/1.0 (hospital-search; contact via project owner)',
        'Accept': 'application/json'
      }
    }, 10000);
    const first = Array.isArray(data) ? data[0] : null;
    const value = first ? { lat: Number(first.lat), lng: Number(first.lon), displayName: first.display_name || q } : null;
    geocodeCache.set(key, { time: Date.now(), value });
    return value;
  } catch (err) {
    console.warn('Geocoding failed:', err.message);
    return null;
  }
}

async function fetchOSMHospitals(lat, lng, radiusMeters = 20000) {
  if (!validIndiaCoordinates(lat, lng)) return [];
  const radius = Math.min(Math.max(Number(radiusMeters) || 20000, 1000), 50000);
  const query = `[out:json][timeout:20];(
    nwr["amenity"="hospital"](around:${radius},${lat},${lng});
    nwr["healthcare"="hospital"](around:${radius},${lat},${lng});
  );out center tags;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const result = await fetchJson(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PulsePoint-EmergencyCare/1.0 (hospital-search)'
        },
        body: new URLSearchParams({ data: query }).toString()
      }, 25000);

      const elements = Array.isArray(result?.elements) ? result.elements : [];
      return elements.map(item => {
        const t = item.tags || {};
        const itemLat = item.lat ?? item.center?.lat ?? null;
        const itemLng = item.lon ?? item.center?.lon ?? null;
        const address = [
          t['addr:housenumber'], t['addr:street'], t['addr:suburb'], t['addr:city'],
          t['addr:district'], t['addr:state'], t['addr:postcode']
        ].filter(Boolean).join(', ');
        return normalizeHospital({
          id: `osm-${item.type}-${item.id}`,
          name: t.name || t['name:en'] || t['name:bn'],
          address,
          phone: t.phone || t['contact:phone'] || t['contact:mobile'],
          website: t.website || t['contact:website'],
          lat: itemLat,
          lng: itemLng,
          emergency: t.emergency
        }, 'openstreetmap');
      }).filter(h => h.name !== 'Unnamed Hospital' && validIndiaCoordinates(h.lat, h.lng));
    } catch (err) {
      console.warn(`Overpass endpoint failed: ${endpoint}`, err.message);
    }
  }
  return [];
}

function mergeHospital(base, incoming) {
  const preferInventory = incoming.source === 'mongodb' || incoming.source === 'pulsepoint-inventory';
  if (!preferInventory) {
    return Object.fromEntries(Object.entries({ ...incoming, ...base }).map(([k, v]) => [k, v]));
  }
  return {
    ...base,
    ...Object.fromEntries(Object.entries(incoming).filter(([,v]) => v !== null && v !== '' && v !== undefined)),
    lat: base.lat ?? incoming.lat,
    lng: base.lng ?? incoming.lng,
    address: base.address || incoming.address,
    phone: incoming.phone || base.phone,
    source: incoming.source
  };
}

function dedupeHospitals(hospitals) {
  const output = [];
  for (const h of hospitals) {
    if (!h?.name) continue;
    const key = normalizeName(h.name);
    let idx = output.findIndex(x => normalizeName(x.name) === key && (
      x.lat == null || h.lat == null || haversineKm(x.lat, x.lng, h.lat, h.lng) < 1
    ));
    if (idx < 0) output.push(h);
    else output[idx] = mergeHospital(output[idx], h);
  }
  return output;
}

function addDistance(hospitals, lat, lng) {
  return hospitals
    .filter(h => validIndiaCoordinates(h.lat, h.lng))
    .map(h => ({ ...h, distanceKm: Number(haversineKm(lat, lng, h.lat, h.lng).toFixed(2)) }));
}

function sortByDistance(hospitals) {
  return hospitals.sort((a,b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

async function inventoryHospitals() {
  const mongo = await searchMongoHospitals('');
  return dedupeHospitals([...localSeed, ...mongo]);
}

async function searchNearbyHospitals(latitude, longitude, radiusMeters = 20000, limit = 30) {
  const lat = Number(latitude), lng = Number(longitude);
  if (!validIndiaCoordinates(lat, lng)) throw new Error('Invalid Indian latitude/longitude');
  const radius = Math.min(Math.max(Number(radiusMeters) || 20000, 1000), 50000);
  const maxResults = Math.min(Math.max(Number(limit) || 30, 1), 100);

  let osm = await fetchOSMHospitals(lat, lng, radius);
  if (!osm.length && radius < 50000) osm = await fetchOSMHospitals(lat, lng, 50000);

  const inventory = await inventoryHospitals();
  const inventoryNearby = addDistance(inventory, lat, lng).filter(h => h.distanceKm <= radius / 1000);
  const osmNearby = addDistance(osm, lat, lng).filter(h => h.distanceKm <= Math.max(radius, 50000) / 1000);

  // Discovery first, inventory overlays matching hospitals with bed/ICU data.
  const merged = dedupeHospitals([...osmNearby, ...inventoryNearby]);
  return sortByDistance(merged).slice(0, maxResults);
}

async function searchAllIndia(query = '') {
  const q = cleanText(query);
  if (!q) return localSeed;

  const place = await geocodePlace(q);
  if (!place || !validIndiaCoordinates(place.lat, place.lng)) {
    const lower = q.toLowerCase();
    const seedMatches = localSeed.filter(h => `${h.name} ${h.address} ${h.category}`.toLowerCase().includes(lower));
    const mongoMatches = await searchMongoHospitals(q);
    return dedupeHospitals([...seedMatches, ...mongoMatches]);
  }

  let results = await searchNearbyHospitals(place.lat, place.lng, 25000, 40);
  if (!results.length) results = await searchNearbyHospitals(place.lat, place.lng, 50000, 40);
  return results;
}

module.exports = {
  connectDB,
  searchAllIndia,
  searchNearbyHospitals,
  normalizeHospital,
  haversineKm
};
