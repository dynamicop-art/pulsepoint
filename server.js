// Realtime nearby hospital search using GPS coordinates
app.get('/api/hospitals/nearby', async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: "Latitude and longitude are required"
      });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return res.status(400).json({
        error: "Invalid latitude or longitude"
      });
    }

    const query = `${latitude},${longitude}`;

    const hospitals = await searchAllIndia(query);

    res.json({
      success: true,
      latitude,
      longitude,
      hospitals
    });

  } catch (err) {
    console.error("Nearby hospital search failed:", err);

    res.status(500).json({
      error: "Nearby hospital search failed",
      details: err.message
    });
  }
});
