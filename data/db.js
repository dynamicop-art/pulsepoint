const express = require('express');
const cors = require('cors');
const { connectDB, searchAllIndia } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB(process.env.MONGO_URI);

// Search endpoint supporting any Indian city, district, or hospital name
app.get('/api/hospitals', async (req, res) => {
  try {
    const query = req.query.q || req.query.search || "";
    const hospitals = await searchAllIndia(query);
    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ error: "Search failed", details: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
