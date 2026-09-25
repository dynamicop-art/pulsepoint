const { MongoClient } = require("mongodb");

/* =========================================================
   CONFIG
========================================================= */

const NOMINATIM_URL =
  "https://nominatim.openstreetmap.org/search";

const DEFAULT_OVERPASS_URL =
  "https://overpass-api.de/api/interpreter";

const OVERPASS_ENDPOINTS = [
  process.env.OVERPASS_URL || DEFAULT_OVERPASS_URL,
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

const MONGO_URI =
  process.env.MONGO_URI || "";

const DB_NAME =
  process.env.MONGO_DB_NAME ||
  process.env.DB_NAME ||
  "";

const HOSPITAL_COLLECTION =
  process.env.HOSPITAL_COLLECTION ||
  "hospitals";

let mongoClient = null;
let mongoDb = null;

const geocodeCache = new Map();

const CACHE_TTL_MS =
  5 * 60 * 1000;


/* =========================================================
   BASIC HELPERS
========================================================= */

function cleanText(value) {
  return value == null
    ? ""
    : String(value).trim();
}


function toNumber(value) {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}


function normalizeName(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9\u00c0-\uFFFF]+/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}


/* =========================================================
   HOSPITAL NORMALIZER
========================================================= */

function normalizeHospital(
  h,
  source = "unknown"
) {

  const lat = toNumber(
    h.lat ??
    h.latitude ??
    h.location?.lat
  );

  const lng = toNumber(
    h.lng ??
    h.lon ??
    h.longitude ??
    h.location?.lng ??
    h.location?.lon
  );

  return {

    id:
      cleanText(
        h.id ??
        h._id ??
        h.osm_id ??
        h.osmId
      ) || undefined,

    name:
      cleanText(
        h.name ??
        h.hospitalName ??
        h.title
      ) || "Unnamed Hospital",

    address:
      cleanText(
        h.address ??
        h.fullAddress ??
        h.locationName ??
        h.location?.address ??
        h.addr
      ) || "",

    category:
      cleanText(
        h.category ??
        h.type
      ) || "Hospital",

    phone:
      cleanText(
        h.phone ??
        h.telephone ??
        h.contactPhone
      ) || null,

    website:
      cleanText(
        h.website ??
        h.url
      ) || null,

    lat,
    lng,

    distanceKm:
      toNumber(
        h.distanceKm ??
        h.distance
      ),

    generalBeds:
      toNumber(
        h.generalBeds ??
        h.availableBeds ??
        h.beds ??
        h.totalBeds
      ),

    availableBeds:
      toNumber(
        h.availableBeds
      ),

    totalBeds:
      toNumber(
        h.totalBeds ??
        h.beds
      ),

    icuBeds:
      toNumber(
        h.icuBeds
      ),

    ventilators:
      toNumber(
        h.ventilators
      ),

    emergency:
      h.emergency === true ||
      h.emergency === "yes" ||
      h.emergency === "24x7"
        ? true
        : h.emergency === false
        ? false
        : null,

    source
  };
}


/* =========================================================
   HAVERSINE DISTANCE
========================================================= */

function haversineKm(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) /
    180;

  const dLon =
    ((lon2 - lon1) * Math.PI) /
    180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      (lat1 * Math.PI) / 180
    ) *
      Math.cos(
        (lat2 * Math.PI) / 180
      ) *
      Math.sin(dLon / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}


/* =========================================================
   INDIA COORDINATE VALIDATION
========================================================= */

function validIndiaCoordinates(
  lat,
  lng
) {

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 6 &&
    lat <= 38.5 &&
    lng >= 68 &&
    lng <= 98
  );
}


/* =========================================================
   FETCH WITH TIMEOUT
========================================================= */

async function fetchJson(
  url,
  options = {},
  timeoutMs = 15000
) {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {

    const response =
      await fetch(
        url,
        {
          ...options,
          signal:
            controller.signal
        }
      );

    const text =
      await response.text();

    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}: ${text.slice(
          0,
          300
        )}`
      );
    }

    if (!text) {
      return {};
    }

    try {

      return JSON.parse(text);

    } catch (jsonError) {

      throw new Error(
        `Invalid JSON response: ${text.slice(
          0,
          300
        )}`
      );
    }

  } finally {

    clearTimeout(timer);
  }
}


/* =========================================================
   MONGODB CONNECTION
========================================================= */

async function connectDB(
  uri = MONGO_URI
) {

  if (!uri) {

    console.warn(
      "MONGO_URI not configured. MongoDB search will be skipped."
    );

    return null;
  }

  try {

    if (
      mongoClient &&
      mongoDb
    ) {

      return mongoDb;
    }

    mongoClient =
      new MongoClient(
        uri,
        {
          serverSelectionTimeoutMS:
            10000
        }
      );

    await mongoClient.connect();

    mongoDb =
      mongoClient.db(
        DB_NAME || undefined
      );

    console.log(
      "MongoDB connected successfully."
    );

    return mongoDb;

  } catch (err) {

    console.error(
      "MongoDB connection failed:",
      err.message
    );

    mongoClient = null;
    mongoDb = null;

    return null;
  }
}


/* =========================================================
   ENSURE DATABASE CONNECTION
========================================================= */

async function ensureMongoConnection() {

  if (mongoDb) {
    return mongoDb;
  }

  if (!MONGO_URI) {
    return null;
  }

  return await connectDB(
    MONGO_URI
  );
}


/* =========================================================
   SEARCH MONGODB HOSPITALS
========================================================= */

async function searchMongoHospitals(
  query = ""
) {

  const db =
    await ensureMongoConnection();

  if (!db) {
    return [];
  }

  try {

    const collection =
      db.collection(
        HOSPITAL_COLLECTION
      );

    const q =
      cleanText(query);

    let docs;

    if (!q) {

      docs =
        await collection
          .find({})
          .limit(500)
          .toArray();

    } else {

      const escaped =
        q.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

      const regex =
        new RegExp(
          escaped,
          "i"
        );

      docs =
        await collection
          .find({
            $or: [
              { name: regex },
              { hospitalName: regex },
              { address: regex },
              { city: regex },
              { district: regex },
              { state: regex }
            ]
          })
          .limit(200)
          .toArray();
    }

    return docs.map(
      doc =>
        normalizeHospital(
          doc,
          "mongodb"
        )
    );

  } catch (err) {

    console.warn(
      "MongoDB hospital search skipped:",
      err.message
    );

    return [];
  }
}


/* =========================================================
   GEOCODING
========================================================= */

async function geocodePlace(
  place
) {

  const q =
    cleanText(place);

  if (!q) {
    return null;
  }

  const cacheKey =
    q.toLowerCase();

  const cached =
    geocodeCache.get(
      cacheKey
    );

  if (
    cached &&
    Date.now() -
      cached.time <
      CACHE_TTL_MS
  ) {

    return cached.value;
  }

  const url =
    new URL(
      NOMINATIM_URL
    );

  url.searchParams.set(
    "q",
    `${q}, India`
  );

  url.searchParams.set(
    "format",
    "jsonv2"
  );

  url.searchParams.set(
    "limit",
    "1"
  );

  url.searchParams.set(
    "countrycodes",
    "in"
  );

  try {

    const data =
      await fetchJson(
        url.toString(),
        {
          headers: {
            "User-Agent":
              "PulsePoint/1.0 emergency-hospital-discovery",
            "Accept":
              "application/json"
          }
        },
        12000
      );

    const first =
      Array.isArray(data)
        ? data[0]
        : null;

    const value =
      first
        ? {
            lat:
              Number(first.lat),

            lng:
              Number(first.lon),

            displayName:
              first.display_name ||
              q
          }
        : null;

    geocodeCache.set(
      cacheKey,
      {
        time: Date.now(),
        value
      }
    );

    return value;

  } catch (err) {

    console.warn(
      "Geocoding failed:",
      err.message
    );

    return null;
  }
}


/* =========================================================
   OPENSTREETMAP / OVERPASS HOSPITAL SEARCH
========================================================= */

async function fetchOSMHospitals(
  lat,
  lng,
  radiusMeters = 15000
) {

  if (
    !validIndiaCoordinates(
      lat,
      lng
    )
  ) {

    return [];
  }

  const radius =
    Math.min(
      Math.max(
        Number(radiusMeters) ||
          15000,
        1000
      ),
      50000
    );

  const query = `
[out:json][timeout:25];
(
  nwr["amenity"="hospital"](around:${radius},${lat},${lng});
  nwr["healthcare"="hospital"](around:${radius},${lat},${lng});
  nwr["amenity"="clinic"](around:${radius},${lat},${lng});
);
out center tags;
`;

  let lastError =
    null;

  for (
    const endpoint of OVERPASS_ENDPOINTS
  ) {

    if (!endpoint) {
      continue;
    }

    try {

      console.log(
        `Trying Overpass endpoint: ${endpoint}`
      );

      const result =
        await fetchJson(
          endpoint,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded; charset=UTF-8",

              "Accept":
                "application/json",

              "User-Agent":
                "PulsePoint/1.0 emergency-hospital-discovery"
            },

            body:
              new URLSearchParams({
                data: query
              }).toString()
          },

          30000
        );

      const elements =
        Array.isArray(
          result?.elements
        )
          ? result.elements
          : [];

      console.log(
        `Overpass returned ${elements.length} places.`
      );

      const hospitals =
        elements

          .map(item => {

            const tags =
              item.tags || {};

            const itemLat =
              item.lat ??
              item.center?.lat ??
              null;

            const itemLng =
              item.lon ??
              item.center?.lon ??
              null;

            const address = [

              tags["addr:housenumber"],
              tags["addr:street"],
              tags["addr:suburb"],
              tags["addr:city"],
              tags["addr:district"],
              tags["addr:state"]

            ]
              .filter(Boolean)
              .join(", ");

            return normalizeHospital(
              {

                id:
                  `osm-${item.type}-${item.id}`,

                name:
                  tags.name ||
                  tags["name:en"] ||
                  tags["name:bn"] ||
                  tags.operator,

                address,

                category:
                  tags.healthcare ||
                  tags.amenity ||
                  "Hospital",

                phone:
                  tags.phone ||
                  tags["contact:phone"] ||
                  null,

                website:
                  tags.website ||
                  tags["contact:website"] ||
                  null,

                lat:
                  itemLat,

                lng:
                  itemLng,

                emergency:
                  tags.emergency

              },
              "openstreetmap"
            );
          })

          .filter(
            hospital =>
              hospital.name &&
              validIndiaCoordinates(
                hospital.lat,
                hospital.lng
              )
          );

      /*
       * IMPORTANT:
       * A successful Overpass response with zero results
       * is still a valid response.
       */
      return hospitals;

    } catch (err) {

      lastError =
        err;

      console.warn(
        `Overpass endpoint failed: ${endpoint}`,
        err.message
      );
    }
  }

  console.error(
    "All Overpass endpoints failed.",
    lastError?.message ||
      "Unknown error"
  );

  return [];
}


/* =========================================================
   DEDUPLICATE HOSPITALS
========================================================= */

function dedupeHospitals(
  hospitals
) {

  const output = [];
  const byName = new Map();

  for (
    const hospital of hospitals
  ) {

    if (
      !hospital?.name
    ) {
      continue;
    }

    const nameKey =
      normalizeName(
        hospital.name
      );

    let duplicateIndex =
      -1;

    if (
      hospital.lat != null &&
      hospital.lng != null
    ) {

      duplicateIndex =
        output.findIndex(
          existing => {

            if (
              existing.lat ==
                null ||
              existing.lng ==
                null ||
              normalizeName(
                existing.name
              ) !== nameKey
            ) {

              return false;
            }

            return (
              haversineKm(
                hospital.lat,
                hospital.lng,
                existing.lat,
                existing.lng
              ) < 0.3
            );
          }
        );
    }

    if (
      duplicateIndex === -1 &&
      byName.has(nameKey)
    ) {

      duplicateIndex =
        byName.get(
          nameKey
        );
    }

    if (
      duplicateIndex === -1
    ) {

      byName.set(
        nameKey,
        output.length
      );

      output.push(
        hospital
      );

      continue;
    }

    const existing =
      output[
        duplicateIndex
      ];

    /*
     * Prefer MongoDB data because it may contain
     * your manually verified hospital details.
     */

    if (
      existing.source !==
        "mongodb" &&
      hospital.source ===
        "mongodb"
    ) {

      output[
        duplicateIndex
      ] = {
        ...existing,
        ...hospital,
        source:
          "mongodb"
      };

    } else {

      output[
        duplicateIndex
      ] = {
        ...existing,

        ...Object.fromEntries(
          Object.entries(
            hospital
          ).filter(
            ([key, value]) =>
              value !== null &&
              value !== "" &&
              value !== undefined &&
              (
                existing[key] ===
                  null ||
                existing[key] ===
                  "" ||
                existing[key] ===
                  undefined
              )
          )
        )
      };
    }
  }

  return output;
}


/* =========================================================
   SORT BY DISTANCE
========================================================= */

function sortByDistance(
  hospitals
) {

  return hospitals.sort(
    (a, b) => {

      if (
        a.distanceKm ==
          null &&
        b.distanceKm ==
          null
      ) {

        return 0;
      }

      if (
        a.distanceKm ==
          null
      ) {

        return 1;
      }

      if (
        b.distanceKm ==
          null
      ) {

        return -1;
      }

      return (
        a.distanceKm -
        b.distanceKm
      );
    }
  );
}


/* =========================================================
   GPS NEARBY SEARCH
========================================================= */

async function searchNearbyHospitals(
  latitude,
  longitude,
  radiusMeters = 15000,
  limit = 30
) {

  const lat =
    Number(latitude);

  const lng =
    Number(longitude);

  if (
    !validIndiaCoordinates(
      lat,
      lng
    )
  ) {

    throw new Error(
      "Invalid Indian latitude/longitude"
    );
  }

  const radius =
    Math.min(
      Math.max(
        Number(radiusMeters) ||
          15000,
        1000
      ),
      50000
    );

  const maxResults =
    Math.min(
      Math.max(
        Number(limit) ||
          30,
        1
      ),
      100
    );

  console.log(
    `Nearby hospital search: ${lat}, ${lng}, radius=${radius}m`
  );

  /*
   * Run OSM and MongoDB in parallel.
   */

  const [
    osmHospitals,
    mongoHospitals
  ] =
    await Promise.all([
      fetchOSMHospitals(
        lat,
        lng,
        radius
      ),

      searchMongoHospitals("")
    ]);

  console.log(
    `OSM hospitals: ${osmHospitals.length}`
  );

  console.log(
    `MongoDB hospitals: ${mongoHospitals.length}`
  );

  const merged =
    dedupeHospitals([
      ...mongoHospitals,
      ...osmHospitals
    ]);

  const nearby =
    merged

      .map(hospital => {

        if (
          hospital.lat ==
            null ||
          hospital.lng ==
            null
        ) {

          return hospital;
        }

        return {

          ...hospital,

          distanceKm:
            Number(
              haversineKm(
                lat,
                lng,
                hospital.lat,
                hospital.lng
              ).toFixed(2)
            )
        };
      })

      .filter(
        hospital =>
          hospital.distanceKm ==
            null ||
          hospital.distanceKm <=
            radius / 1000
      );

  return sortByDistance(
    nearby
  ).slice(
    0,
    maxResults
  );
}


/* =========================================================
   CITY / PLACE SEARCH
========================================================= */

async function searchAllIndia(
  query = ""
) {

  const q =
    cleanText(query);

  if (!q) {

    return searchMongoHospitals(
      ""
    );
  }

  const mongoMatches =
    await searchMongoHospitals(
      q
    );

  const location =
    await geocodePlace(
      q
    );

  if (!location) {

    return sortByDistance(
      mongoMatches
    );
  }

  const osmMatches =
    await fetchOSMHospitals(
      location.lat,
      location.lng,
      20000
    );

  const merged =
    dedupeHospitals([
      ...mongoMatches,
      ...osmMatches
    ]);

  const withDistance =
    merged.map(
      hospital => {

        if (
          hospital.lat ==
            null ||
          hospital.lng ==
            null
        ) {

          return hospital;
        }

        return {

          ...hospital,

          distanceKm:
            Number(
              haversineKm(
                location.lat,
                location.lng,
                hospital.lat,
                hospital.lng
              ).toFixed(2)
            )
        };
      }
    );

  return sortByDistance(
    withDistance
  );
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

  connectDB,

  searchAllIndia,

  searchNearbyHospitals

};
