const express = require('express');
const cors = require('cors');
const { connectDB, searchAllIndia, searchNearbyHospitals } = require('./db');

const app = express();
const allowedOrigins = new Set([
  'https://dynamicop-art.github.io',
  ...(process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',').map(x => x.trim()).filter(Boolean) : [])
]);

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.has(origin) || process.env.NODE_ENV !== 'production') return cb(null, true);
    return cb(null, false);
  }
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ONLINE', service: 'PulsePoint Hospital Discovery', time: new Date().toISOString() });
});

app.get('/api/hospitals', async (req, res) => {
  try {
    const query = String(req.query.q || req.query.search || '').trim().slice(0, 120);
    const hospitals = await searchAllIndia(query);
    res.json({ success: true, query, count: hospitals.length, data: hospitals });
  } catch (err) {
    console.error('Hospital search failed:', err);
    res.status(500).json({ success: false, error: 'Search failed', details: err.message });
  }
});

app.get('/api/hospitals/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 20000, limit = 30 } = req.query;
    const latitude = Number(lat), longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ success: false, error: 'Valid latitude and longitude are required' });
    }
    const hospitals = await searchNearbyHospitals(latitude, longitude, Number(radius), Number(limit));
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
    res.status(500).json({ success: false, error: 'Nearby hospital search failed', details: err.message });
  }
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Not found' }));

async function start() {
  await connectDB(process.env.MONGO_URI);
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`PulsePoint API listening on port ${PORT}`));
}

if (require.main === module) start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});

module.exports = app;
