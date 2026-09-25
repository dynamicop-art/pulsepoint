const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// ============================================================
// Mongoose Hospital Schema
// (address/lat/lng/city/state/source added so hospitals pulled
//  in live from OpenStreetMap can be stored the same way as
//  hand-entered ones, and so the map / "use my location" button
//  on the frontend has coordinates to work with.)
// ============================================================
const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true }, // city / area, shown as "Location"
  address: { type: String, default: "" },      // fuller street address if known
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  totalBeds: { type: Number, default: null },
  availableBeds: { type: Number, default: null },
  icuBeds: { type: Number, default: null },
  contact: { type: String, required: true },
  bloodAvailable: { type: [String], default: [] },
  source: { type: String, default: "manual" }, // 'manual' | 'openstreetmap'
  updatedAt: { type: Date, default: Date.now }
});

const Hospital = mongoose.models.Hospital || mongoose.model("Hospital", hospitalSchema);

// ============================================================
// Starter sample data (used only the very first time the
// collection is empty, so the homepage isn't blank before any
// search has been made). This is NOT the all-India dataset —
// that comes live from OpenStreetMap below.
// ============================================================
const defaultHospitals = [
  { name: "Apollo Multispeciality Hospital", location: "Kolkata", city: "Kolkata", state: "West Bengal", lat: 22.5354, lng: 88.3521, totalBeds: 250, availableBeds: 42, icuBeds: 14, contact: "+91 33 2320 3040", bloodAvailable: ["A+", "B+", "O+", "AB+"], source: "manual" },
  { name: "Fortis Hospital, Anandapur", location: "Kolkata", city: "Kolkata", state: "West Bengal", lat: 22.5049, lng: 88.3968, totalBeds: 180, availableBeds: 25, icuBeds: 9, contact: "+91 33 6628 4444", bloodAvailable: ["O+", "O-", "A+", "B-"], source: "manual" },
  { name: "Medica Superspecialty Hospital", location: "Mukundapur, Kolkata", city: "Kolkata", state: "West Bengal", lat: 22.4966, lng: 88.3927, totalBeds: 220, availableBeds: 38, icuBeds: 11, contact: "+91 33 6652 0000", bloodAvailable: ["A+", "B+", "AB-", "O+"], source: "manual" },
  { name: "AMRI Hospital, Dhakuria", location: "Kolkata", city: "Kolkata", state: "West Bengal", lat: 22.5109, lng: 88.3651, totalBeds: 160, availableBeds: 19, icuBeds: 6, contact: "+91 33 6606 3800", bloodAvailable: ["B+", "O+", "A-"], source: "manual" },
  { name: "AIIMS New Delhi", location: "New Delhi", city: "New Delhi", state: "Delhi", lat: 28.5672, lng: 77.2100, totalBeds: 2478, availableBeds: null, icuBeds: null, contact: "+91 11 2658 8500", bloodAvailable: [], source: "manual" },
  { name: "Kokilaben Dhirubhai Ambani Hospital", location: "Mumbai", city: "Mumbai", state: "Maharashtra", lat: 19.1324, lng: 72.8264, totalBeds: 750, availableBeds: null, icuBeds: null, contact: "+91 22 4269 6969", bloodAvailable: [], source: "manual" }
];

// ============================================================
// Small helpers for the live, all-India lookup
// ============================================================

// prevents user input from breaking the Mongo $regex query
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchWithTimeout(url, options = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Turns a place name typed by the user ("Howrah", "Salem", "Indore") into
// coordinates, restricted to India. Uses OpenStreetMap's free Nominatim
// geocoder — no API key required.
async function geocodePlace(place) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(place)}`;
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": "PulsePoint-EmergencyLocator/1.0 (demo project)" }
  }, 8000);
  if (!res.ok) return null;
  const rows = await res.json();
  if (!rows || !rows.length) return null;
  return { lat: parseFloat(rows[0].lat), lon: parseFloat(rows[0].lon), display: rows[0].display_name };
}

// Pulls real hospitals near a coordinate from OpenStreetMap (Overpass API),
// which has crowdsourced hospital data covering all of India, not just a
// handful of seeded cities.
async function fetchOSMHospitals(lat, lon, radiusMeters) {
  const query = `[out:json][timeout:20];(node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});relation["amenity"="hospital"](around:${radiusMeters},${lat},${lon}););out center tags 40;`;
  const res = await fetchWithTimeout("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query)
  }, 18000);
  if (!res.ok) return [];
  const json = await res.json();
  const elements = Array.isArray(json.elements) ? json.elements : [];

  return elements
    .map(el => {
      const tags = el.tags || {};
      const name = tags.name || tags["name:en"];
      if (!name) return null; // skip unnamed hospital nodes, they're not useful to show
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      const city = tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || "";
      const state = tags["addr:state"] || "";
      const addressParts = [
        tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"],
        city, state, tags["addr:postcode"]
      ].filter(Boolean);
      return {
        name,
        location: city || state || name,
        address: addressParts.join(", "),
        city, state,
        lat: elLat ?? null,
        lng: elLon ?? null,
        contact: tags.phone || tags["contact:phone"] || tags["contact:mobile"] || "Not listed",
        totalBeds: null,
        availableBeds: null,
        icuBeds: null,
        bloodAvailable: [],
        source: "openstreetmap"
      };
    })
    .filter(Boolean);
}

// Saves OSM results into Mongo (upsert, so re-searching the same place
// doesn't create duplicates) and returns the saved/updated documents.
async function upsertHospitals(records) {
  const saved = [];
  for (const rec of records) {
    try {
      const doc = await Hospital.findOneAndUpdate(
        { name: rec.name, location: rec.location },
        { $set: { ...rec, updatedAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      saved.push(doc);
    } catch (e) {
      // a single bad record shouldn't fail the whole search
      console.error("upsert skipped:", e.message);
    }
  }
  return saved;
}

// Straight-line distance between two coordinates, in km.
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// GET /api/hospitals/nearby?lat=..&lng=..&radius=..
// Takes a raw coordinate (e.g. from the browser's Geolocation API)
// and returns real hospitals around it, anywhere in India, sorted
// nearest-first. No place name / geocoding step needed, so this is
// what "use my location" should call.
// 1. Pull real hospitals from OpenStreetMap (Overpass) within the
//    radius, cache them into Mongo.
// 2. Also pull any hospitals already saved in Mongo that fall
//    inside the same radius (covers manually-added hospitals that
//    may not be in OSM).
// 3. Merge, dedupe, compute distanceKm for every entry, sort by
//    distance, and return.
// ============================================================
async function getNearbyHandler(req, res) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 60);
    let radius = parseInt(req.query.radius, 10) || 15000; // meters
    radius = Math.min(Math.max(radius, 1000), 50000); // clamp 1km - 50km

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: "lat and lng query params are required numbers." });
    }
    // Rough India bounding box so bad/foreign coordinates don't hit Overpass pointlessly.
    if (lat < 6 || lat > 37 || lng < 68 || lng > 98) {
      return res.status(400).json({ success: false, message: "Coordinates fall outside India." });
    }

    let osmNote;
    let osmResults = [];
    try {
      osmResults = await fetchOSMHospitals(lat, lng, radius);
      if (osmResults.length === 0 && radius < 50000) {
        osmResults = await fetchOSMHospitals(lat, lng, Math.min(radius * 2.5, 50000)); // widen once for sparse areas
      }
      await upsertHospitals(osmResults);
    } catch (e) {
      console.error("Live OSM nearby lookup failed:", e.message);
      osmNote = "Live lookup temporarily unavailable; showing saved results only.";
    }

    // Also pull from Mongo directly (covers manual entries + anything just cached above),
    // using a generous degree-box pre-filter before the precise haversine check.
    const degreePad = radius / 111000; // ~meters per degree of latitude
    const dbCandidates = await Hospital.find({
      lat: { $gte: lat - degreePad, $lte: lat + degreePad },
      lng: { $gte: lng - degreePad, $lte: lng + degreePad }
    }).limit(200);

    const merged = new Map();
    for (const h of [...osmResults, ...dbCandidates]) {
      const hLat = h.lat, hLng = h.lng;
      if (hLat == null || hLng == null) continue;
      const distanceKm = haversineKm(lat, lng, hLat, hLng);
      if (distanceKm > radius / 1000) continue;
      const key = `${h.name}|${h.city || h.location}`;
      const plain = typeof h.toObject === "function" ? h.toObject() : h;
      const existing = merged.get(key);
      if (!existing || distanceKm < existing.distanceKm) {
        merged.set(key, { ...plain, distanceKm: Math.round(distanceKm * 10) / 10 });
      }
    }

    const data = Array.from(merged.values())
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    res.json({
      success: true,
      count: data.length,
      origin: { lat, lng },
      radiusMeters: radius,
      data,
      ...(osmNote ? { note: osmNote } : {})
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ============================================================
// GET /api/hospitals?search=xyz
// 1. Look inside Mongo first (fast, works offline of OSM too).
// 2. If that comes up thin, geocode the search text and pull
//    real nearby hospitals from OpenStreetMap, cache them into
//    Mongo, and merge them into the results.
// This is what makes search work for ANY place in India, not
// just the handful of cities in defaultHospitals.
// ============================================================
async function getHospitalsHandler(req, res) {
  try {
    const search = (req.query.search || "").toString().trim().slice(0, 100);
    let localResults = [];

    if (search) {
      const safe = escapeRegex(search);
      localResults = await Hospital.find({
        $or: [
          { name: { $regex: safe, $options: "i" } },
          { location: { $regex: safe, $options: "i" } },
          { address: { $regex: safe, $options: "i" } },
          { city: { $regex: safe, $options: "i" } },
          { state: { $regex: safe, $options: "i" } }
        ]
      }).sort({ updatedAt: -1 }).limit(60);
    } else {
      localResults = await Hospital.find({}).sort({ updatedAt: -1 }).limit(60);
      if (localResults.length === 0) {
        localResults = await Hospital.insertMany(defaultHospitals);
      }
      return res.json({ success: true, count: localResults.length, data: localResults });
    }

    let externalNote;
    if (localResults.length < 6) {
      try {
        const place = await geocodePlace(search + ", India");
        if (place) {
          let osm = await fetchOSMHospitals(place.lat, place.lon, 20000);
          if (osm.length === 0) osm = await fetchOSMHospitals(place.lat, place.lon, 50000); // widen once for smaller towns
          const savedDocs = await upsertHospitals(osm);
          const known = new Set(localResults.map(h => `${h.name}|${h.location}`));
          for (const doc of savedDocs) {
            const key = `${doc.name}|${doc.location}`;
            if (!known.has(key)) {
              localResults.push(doc);
              known.add(key);
            }
          }
        } else {
          externalNote = "Could not locate that place in India.";
        }
      } catch (e) {
        console.error("Live OSM lookup failed:", e.message);
        externalNote = "Live lookup temporarily unavailable; showing saved results only.";
      }
    }

    res.json({
      success: true,
      count: localResults.length,
      data: localResults,
      ...(externalNote ? { note: externalNote } : {})
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ১. GET Route (যাতে "/" অথবা "/hospitals" যেকোনোটিতেই ডেটা পায়)
router.get("/", getHospitalsHandler);
router.get("/hospitals", getHospitalsHandler);

// GET /api/hospitals/nearby?lat=..&lng=.. — location-based lookup, all of India
router.get("/nearby", getNearbyHandler);

// ২. POST: নতুন হাসপাতাল যুক্ত করা (Viable ফিচার)
router.post("/", async (req, res) => {
  try {
    const { name, location, totalBeds, availableBeds, icuBeds, contact, bloodAvailable, address, city, state, lat, lng } = req.body;

    if (!name || !location || !contact) {
      return res.status(400).json({ success: false, message: "Name, Location, and Contact are required!" });
    }

    const newHospital = new Hospital({
      name,
      location,
      address: address || "",
      city: city || "",
      state: state || "",
      lat: typeof lat === "number" ? lat : null,
      lng: typeof lng === "number" ? lng : null,
      totalBeds: Number.isFinite(Number(totalBeds)) ? Number(totalBeds) : null,
      availableBeds: Number.isFinite(Number(availableBeds)) ? Number(availableBeds) : null,
      icuBeds: Number.isFinite(Number(icuBeds)) ? Number(icuBeds) : null,
      contact,
      bloodAvailable: Array.isArray(bloodAvailable) ? bloodAvailable : [],
      source: "manual"
    });

    const saved = await newHospital.save();
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ৩. PATCH: বেড সংখ্যা রিয়েল-টাইম আপডেট করা
router.patch("/:id/beds", async (req, res) => {
  try {
    const { availableBeds, icuBeds } = req.body;
    const updated = await Hospital.findByIdAndUpdate(
      req.params.id,
      { availableBeds, icuBeds, updatedAt: Date.now() },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
