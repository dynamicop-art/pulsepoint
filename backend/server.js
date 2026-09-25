const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { connectDB, searchAllIndia, searchNearbyHospitals } = require('./db');

const app = express();

const allowedOrigins = new Set([
  'https://dynamicop-art.github.io',
  ...(process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(',').map(x => x.trim()).filter(Boolean)
    : [])
]);

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.has(origin) || process.env.NODE_ENV !== 'production') {
      return cb(null, true);
    }
    return cb(null, false);
  }
}));

app.use(express.json({ limit: '1.5mb' }));

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'store.json');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set. Sessions will reset when the service restarts.');
}

let store = {
  users: {},
  inventories: {},
  requests: {}
};

let writeQueue = Promise.resolve();

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function userId(email) {
  return crypto.createHash('sha256')
    .update(normalizeEmail(email))
    .digest('hex')
    .slice(0, 24);
}

function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
    role: user.role || 'citizen',
    profilePhoto: user.profilePhoto || ''
  };
}

function readStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;

    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    store = {
      users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
      inventories: parsed.inventories && typeof parsed.inventories === 'object'
        ? parsed.inventories
        : {},
      requests: parsed.requests && typeof parsed.requests === 'object'
        ? parsed.requests
        : {}
    };
  } catch (err) {
    console.warn('Could not read local store:', err.message);
  }
}

function persistStore() {
  writeQueue = writeQueue.then(async () => {
    const dir = path.dirname(DATA_FILE);
    await fs.promises.mkdir(dir, { recursive: true });

    const temp = `${DATA_FILE}.${process.pid}.tmp`;
    await fs.promises.writeFile(temp, JSON.stringify(store, null, 2), 'utf8');
    await fs.promises.rename(temp, DATA_FILE);
  }).catch(err => console.error('Store write failed:', err.message));

  return writeQueue;
}

readStore();

function signUser(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role || 'citizen'
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function getBearer(req) {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function verifyAuth(req, res, next) {
  const token = getBearer(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Sign in required'
    });
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({
      success: false,
      message: 'Session expired. Please sign in again.'
    });
  }
}

function verifyStaff(req, res, next) {
  verifyAuth(req, res, () => {
    if (req.auth.role !== 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Hospital staff authorization required'
      });
    }
    next();
  });
}

function inventoryKey(h) {
  return String(h?.id || '').trim();
}

function applyInventory(h) {
  const key = inventoryKey(h);
  const override = key ? store.inventories[key] : null;

  return override
    ? {
        ...h,
        ...override,
        id: h.id || key,
        source: 'pulsepoint-inventory'
      }
    : h;
}

function applyInventories(list) {
  return (Array.isArray(list) ? list : []).map(applyInventory);
}

async function staffCredentialMatches(email, password) {
  const staffEmail = normalizeEmail(process.env.STAFF_EMAIL);

  if (!staffEmail || normalizeEmail(email) !== staffEmail) {
    return false;
  }

  if (process.env.STAFF_PASSWORD_HASH) {
    return bcrypt.compare(
      String(password || ''),
      process.env.STAFF_PASSWORD_HASH
    );
  }

  if (process.env.STAFF_PASSWORD) {
    const a = Buffer.from(String(password || ''));
    const b = Buffer.from(String(process.env.STAFF_PASSWORD));

    return a.length === b.length &&
      crypto.timingSafeEqual(a, b);
  }

  return false;
}

function makeRequestId() {
  return `PP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

// ============================================================
// BASIC STATUS
// ============================================================
app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'PulsePoint API',
    health: '/api/health'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'PulsePoint Hospital Discovery',
    auth: true,
    inventoryEditor: true,
    requestSystem: true,
    time: new Date().toISOString()
  });
});

// ============================================================
// AUTH
// ============================================================
app.post('/api/auth/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email address.'
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 12 characters.'
      });
    }

    if (normalizeEmail(process.env.STAFF_EMAIL) === email) {
      return res.status(403).json({
        success: false,
        message: 'This address is reserved for hospital staff.'
      });
    }

    const id = userId(email);

    if (store.users[id]) {
      return res.status(409).json({
        success: false,
        message: 'An account already exists for this email.'
      });
    }

    const user = {
      id,
      email,
      name: email.split('@')[0],
      role: 'citizen',
      passwordHash: await bcrypt.hash(password, 12),
      profilePhoto: '',
      createdAt: new Date().toISOString()
    };

    store.users[id] = user;
    await persistStore();

    res.status(201).json({
      success: true,
      token: signUser(user),
      user: safeUser(user)
    });
  } catch (err) {
    console.error('Registration failed:', err);
    res.status(500).json({
      success: false,
      message: 'Could not create account.'
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    if (await staffCredentialMatches(email, password)) {
      const id = userId(email);
      const existing = store.users[id] || {};

      const staff = {
        ...existing,
        id,
        email,
        name: existing.name || 'Hospital Staff',
        role: 'staff',
        profilePhoto: existing.profilePhoto || ''
      };

      store.users[id] = staff;
      await persistStore();

      return res.json({
        success: true,
        token: signUser(staff),
        user: safeUser(staff)
      });
    }

    const user = store.users[userId(email)];

    if (!user ||
        !user.passwordHash ||
        !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect email or password.'
      });
    }

    res.json({
      success: true,
      token: signUser(user),
      user: safeUser(user)
    });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({
      success: false,
      message: 'Could not sign in.'
    });
  }
});

app.get('/api/auth/me', verifyAuth, (req, res) => {
  const id = req.auth.sub;
  let user = store.users[id];

  if (!user && req.auth.role === 'staff') {
    user = {
      id,
      email: req.auth.email,
      name: 'Hospital Staff',
      role: 'staff',
      profilePhoto: ''
    };
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Account not found.'
    });
  }

  res.json({
    success: true,
    user: safeUser(user)
  });
});

app.patch('/api/profile', verifyAuth, async (req, res) => {
  try {
    const id = req.auth.sub;

    const existing = store.users[id] || {
      id,
      email: req.auth.email,
      name: req.auth.role === 'staff'
        ? 'Hospital Staff'
        : req.auth.email.split('@')[0],
      role: req.auth.role || 'citizen'
    };

    const photo = String(req.body.profilePhoto || '');

    if (photo &&
        !/^data:image\/(jpeg|png|webp);base64,/i.test(photo)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported profile image.'
      });
    }

    if (photo.length > 800000) {
      return res.status(413).json({
        success: false,
        message: 'Profile image is too large.'
      });
    }

    existing.profilePhoto = photo;
    store.users[id] = existing;
    await persistStore();

    res.json({
      success: true,
      user: safeUser(existing)
    });
  } catch (err) {
    console.error('Profile update failed:', err);
    res.status(500).json({
      success: false,
      message: 'Could not update profile.'
    });
  }
});

// ============================================================
// HOSPITAL SEARCH
// ============================================================
app.get('/api/hospitals', async (req, res) => {
  try {
    const query = String(
      req.query.q ||
      req.query.search ||
      ''
    ).trim().slice(0, 120);

    const hospitals = applyInventories(
      await searchAllIndia(query)
    );

    res.json({
      success: true,
      query,
      count: hospitals.length,
      data: hospitals
    });
  } catch (err) {
    console.error('Hospital search failed:', err);

    res.status(500).json({
      success: false,
      error: 'Search failed',
      details: err.message
    });
  }
});

app.get('/api/hospitals/nearby', async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 20000,
      limit = 30
    } = req.query;

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (!Number.isFinite(latitude) ||
        !Number.isFinite(longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Valid latitude and longitude are required'
      });
    }

    const hospitals = applyInventories(
      await searchNearbyHospitals(
        latitude,
        longitude,
        Number(radius),
        Number(limit)
      )
    );

    res.json({
      success: true,
      latitude,
      longitude,
      radius: Number(radius),
      count: hospitals.length,
      data: hospitals
    });
  } catch (err) {
    console.error('Nearby hospital search failed:', err);

    res.status(500).json({
      success: false,
      error: 'Nearby hospital search failed',
      details: err.message
    });
  }
});

// ============================================================
// BLOOD / ORGAN REQUESTS
// ============================================================
app.post('/api/requests', verifyAuth, async (req, res) => {
  try {
    const patientName = String(req.body.patientName || '')
      .trim()
      .slice(0, 120);

    const item = String(req.body.item || '')
      .trim()
      .slice(0, 120);

    const hospital = String(req.body.hospital || '')
      .trim()
      .slice(0, 180);

    const phone = String(req.body.phone || '')
      .trim()
      .slice(0, 40);

    const units = Number(req.body.units);

    if (!patientName ||
        !item ||
        !hospital ||
        !phone ||
        !Number.isFinite(units) ||
        units < 1 ||
        units > 10) {
      return res.status(400).json({
        success: false,
        message: 'Complete all request fields correctly.'
      });
    }

    const id = makeRequestId();

    const requestRecord = {
      id,
      userId: req.auth.sub,
      userEmail: req.auth.email,
      patientName,
      item,
      units,
      hospital,
      phone,
      status: 'Saved — facility not notified',
      createdAt: new Date().toISOString()
    };

    store.requests[id] = requestRecord;
    await persistStore();

    res.status(201).json({
      success: true,
      data: requestRecord,
      warning:
        'This request is saved inside PulsePoint only. No hospital, blood bank, or transplant centre has been notified automatically.'
    });
  } catch (err) {
    console.error('Request save failed:', err);

    res.status(500).json({
      success: false,
      message: 'Could not save the request.'
    });
  }
});

app.get('/api/requests', verifyAuth, (req, res) => {
  const data = Object.values(store.requests)
    .filter(item => item.userId === req.auth.sub)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 10);

  res.json({
    success: true,
    count: data.length,
    data
  });
});

// ============================================================
// STAFF INVENTORY
// ============================================================
app.patch('/api/hospitals/:id/inventory', verifyStaff, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();

    if (!id || id.length > 240) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hospital ID.'
      });
    }

    const numeric = (value) => {
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };

    const current = store.inventories[id] || {};

    const next = {
      ...current,
      id,
      name: String(req.body.name || current.name || '')
        .slice(0, 180),

      address: String(req.body.address || current.address || '')
        .slice(0, 350),

      lat: Number.isFinite(Number(req.body.lat))
        ? Number(req.body.lat)
        : current.lat ?? null,

      lng: Number.isFinite(Number(req.body.lng))
        ? Number(req.body.lng)
        : current.lng ?? null,

      generalBeds: numeric(req.body.generalBeds),
      availableBeds: numeric(
        req.body.availableBeds ?? req.body.generalBeds
      ),
      icuBeds: numeric(req.body.icuBeds),
      ventilators: numeric(req.body.ventilators),

      bloodStock:
        req.body.bloodStock &&
        typeof req.body.bloodStock === 'object'
          ? req.body.bloodStock
          : current.bloodStock || null,

      inventoryUpdatedAt: new Date().toISOString(),
      inventoryUpdatedBy: req.auth.email
    };

    store.inventories[id] = next;
    await persistStore();

    res.json({
      success: true,
      data: next
    });
  } catch (err) {
    console.error('Inventory update failed:', err);

    res.status(500).json({
      success: false,
      message: 'Could not save hospital inventory.'
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

async function start() {
  await connectDB(process.env.MONGO_URI);

  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`PulsePoint API listening on port ${PORT}`);
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
}

module.exports = app;
