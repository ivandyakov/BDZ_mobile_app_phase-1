const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Redis = require('ioredis');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Databases
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);

// Endpoint 1: Get all stations
app.get('/api/v1/stations', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name_bg, name_en, lat, lng FROM stations ORDER BY name_bg ASC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Endpoint 2: Station Live Board (Departures/Arrivals)
app.get('/api/v1/live-board/:station_id', async (req, res) => {
  const { station_id } = req.params;
  try {
    const cachedData = await redis.get(`station_board:${station_id}`);
    if (cachedData) {
      return res.json({ success: true, source: 'cache', data: JSON.parse(cachedData) });
    }
    
    // Fallback if cache is empty
    res.json({ success: true, source: 'live', message: 'No live updates available currently for this station.', data: [] });
  } catch (error) {
    console.error('Error fetching live board:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Endpoint 3: Train Live Tracking
app.get('/api/v1/train/:train_number/live', async (req, res) => {
  const { train_number } = req.params;
  try {
    const cachedTrain = await redis.get(`train_live:${train_number}`);
    if (cachedTrain) {
      return res.json({ success: true, source: 'cache', data: JSON.parse(cachedTrain) });
    }
    res.status(404).json({ success: false, error: 'Train data not found or train is not currently running.' });
  } catch (error) {
    console.error('Error fetching train data:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'UP', timestamp: new Date() }));

app.listen(port, () => {
  console.log(`BDZ MVP Backend running on port ${port}`);
});
