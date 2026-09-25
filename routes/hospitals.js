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

// Straight-line distance in km between two coordinates.
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// GET /api/hospitals?lat=..&lng=..
// Used by the "Use my location" button: the browser already
// knows the coordinates, so this skips the geocoding step and
// goes straight to a LIVE OpenStreetMap lookup around that exact
// point every time — cached/manual Mongo entries are only used
// as a fallback/extra, never given priority over the live data.
// ============================================================
async function getHospitalsByCoords(req, res, lat, lng) {
  const radiusKm = 20;
  let liveNearby = [];
  let externalNote;

  // 1. ALWAYS ask OpenStreetMap first — this is the "real, current"
  //    source. It gets cached into Mongo (upsert), but that cache is
  //    just a copy for next time, not something we trust over this.
  try {
    let osm = await fetchOSMHospitals(lat, lng, radiusKm * 1000);
    if (osm.length === 0) osm = await fetchOSMHospitals(lat, lng, 50000); // widen for rural areas
    const savedDocs = await upsertHospitals(osm);
    liveNearby = savedDocs
      .filter(doc => doc.lat != null && doc.lng != null)
      .map(doc => ({ doc, d: haversineKm(lat, lng, doc.lat, doc.lng) }))
      .filter(x => x.d <= 50)
      .sort((a, b) => a.d - b.d);
  } catch (e) {
    console.error("Live OSM lookup (by coords) failed:", e.message);
    externalNote = "Live lookup temporarily unavailable; showing saved results only.";
  }

  // 2. Only to fill gaps: anything already in Mongo nearby that the
  //    live call above didn't return (e.g. a manually-added entry).
  //    These are appended AFTER the live results, never ahead of them.
  const known = new Set(liveNearby.map(x => String(x.doc._id)));
  const cached = await Hospital.find({ lat: { $ne: null }, lng: { $ne: null } }).limit(500);
  const cachedNearby = cached
    .map(doc => ({ doc, d: haversineKm(lat, lng, doc.lat, doc.lng) }))
    .filter(x => x.d <= radiusKm && !known.has(String(x.doc._id)))
    .sort((a, b) => a.d - b.d);

  const merged = [...liveNearby, ...cachedNearby].slice(0, 30);

  const data = merged.map(x => {
    const obj = x.doc.toObject ? x.doc.toObject() : x.doc;
    return { ...obj, distanceKm: Math.round(x.d * 10) / 10 };
  });

  res.json({
    success: true,
    count: data.length,
    data,
    ...(externalNote ? { note: externalNote } : {})
  });
}

// ============================================================
// GET /api/hospitals?search=xyz
// LIVE-FIRST: every search geocodes the typed place and pulls
// real, current hospitals from OpenStreetMap FIRST. Whatever is
// already sitting in Mongo (old manual entries, previously
// cached searches) is only appended afterwards to fill gaps —
// it is never allowed to take priority over the live lookup.
// This is what makes search work for ANY place in India, not
// just the handful of cities in defaultHospitals, and keeps
// results fresh instead of stuck on whatever was typed/saved
// before.
// ============================================================
async function getHospitalsHandler(req, res) {
  try {
    // "Use my location" comes in as lat/lng instead of typed text —
    // handle that path separately, no geocoding needed.
    const rawLat = parseFloat(req.query.lat);
    const rawLng = parseFloat(req.query.lng);
    if (Number.isFinite(rawLat) && Number.isFinite(rawLng)) {
      return await getHospitalsByCoords(req, res, rawLat, rawLng);
    }

    const search = (req.query.search || "").toString().trim().slice(0, 100);

    if (!search) {
      let localResults = await Hospital.find({}).sort({ updatedAt: -1 }).limit(60);
      if (localResults.length === 0) {
        localResults = await Hospital.insertMany(defaultHospitals);
      }
      return res.json({ success: true, count: localResults.length, data: localResults });
    }

    // 1. ALWAYS geocode + hit OpenStreetMap live for this search text.
    //    This runs every time, regardless of what's already cached.
    let liveResults = [];
    let externalNote;
    try {
      const place = await geocodePlace(search + ", India");
      if (place) {
        let osm = await fetchOSMHospitals(place.lat, place.lon, 20000);
        if (osm.length === 0) osm = await fetchOSMHospitals(place.lat, place.lon, 50000); // widen once for smaller towns
        liveResults = await upsertHospitals(osm); // fresh data, and re-caches it for next time
      } else {
        externalNote = "Could not locate that place in India.";
      }
    } catch (e) {
      console.error("Live OSM lookup failed:", e.message);
      externalNote = "Live lookup temporarily unavailable; showing saved results only.";
    }

    // 2. Only to fill gaps: local Mongo matches (e.g. hand-entered
    //    hospitals) that the live lookup above doesn't already cover.
    //    These are appended AFTER the live results, never ahead.
    const safe = escapeRegex(search);
    const localMatches = await Hospital.find({
      $or: [
        { name: { $regex: safe, $options: "i" } },
        { location: { $regex: safe, $options: "i" } },
        { address: { $regex: safe, $options: "i" } },
        { city: { $regex: safe, $options: "i" } },
        { state: { $regex: safe, $options: "i" } }
      ]
    }).sort({ updatedAt: -1 }).limit(60);

    const known = new Set(liveResults.map(d => `${d.name}|${d.location}`));
    const merged = [...liveResults];
    for (const doc of localMatches) {
      const key = `${doc.name}|${doc.location}`;
      if (!known.has(key)) {
        merged.push(doc);
        known.add(key);
      }
    }

    res.json({
      success: true,
      count: merged.length,
      data: merged,
      ...(externalNote ? { note: externalNote } : {})
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// ১. GET Route (যাতে "/" অথবা "/hospitals" যেকোনোটিতেই ডেটা পায়)
router.get("/", getHospitalsHandler);
router.get("/hospitals", getHospitalsHandler);

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
