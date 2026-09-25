const express = require('express');
const cors = require('cors');

const {
  connectDB,
  searchAllIndia,
  searchNearbyHospitals
} = require('./db');

const app = express();

app.use(cors());
app.use(express.json());


// =====================================
// CONNECT TO MONGODB
// =====================================

connectDB(process.env.MONGO_URI);


// =====================================
// TEXT / CITY / HOSPITAL SEARCH
// =====================================

app.get('/api/hospitals', async (req, res) => {

  try {

    const query =
      req.query.q ||
      req.query.search ||
      "";

    const hospitals =
      await searchAllIndia(
        query
      );

    res.json(
      hospitals
    );

  } catch (err) {

    console.error(
      "Hospital search failed:",
      err
    );

    res.status(500).json({

      error:
        "Search failed",

      details:
        err.message

    });
  }

});


// =====================================
// REALTIME GPS NEARBY HOSPITAL SEARCH
// =====================================

app.get(
  '/api/hospitals/nearby',
  async (req, res) => {

    try {

      const {
        lat,
        lng,
        radius = 15000,
        limit = 30
      } = req.query;


      if (
        !lat ||
        !lng
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Latitude and longitude are required"

        });
      }


      const latitude =
        Number(lat);

      const longitude =
        Number(lng);


      if (
        !Number.isFinite(
          latitude
        ) ||
        !Number.isFinite(
          longitude
        )
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Invalid latitude or longitude"

        });
      }


      const hospitals =
        await searchNearbyHospitals(

          latitude,

          longitude,

          Number(radius),

          Number(limit)

        );


      res.json({

        success: true,

        latitude,

        longitude,

        radius:
          Number(radius),

        count:
          hospitals.length,

        data:
          hospitals

      });


    } catch (err) {

      console.error(
        "Nearby hospital search failed:",
        err
      );


      res.status(500).json({

        success: false,

        error:
          "Nearby hospital search failed",

        details:
          err.message

      });

    }

  }
);


// =====================================
// SERVER
// =====================================

const PORT =
  process.env.PORT ||
  5000;


app.listen(
  PORT,
  () => {

    console.log(
      `Server listening on port ${PORT}`
    );

  }
);
