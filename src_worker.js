const axios = require('axios');
const cheerio = require('cheerio');
const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis(process.env.REDIS_URL);
const SCRAPE_INTERVAL = parseInt(process.env.SCRAPE_INTERVAL_MS) || 60000;

// User-Agent rotation mock to prevent automated request blocking
const AXIOS_CONFIG = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'bg,en-US;q=0.7,en;q=0.3'
  },
  timeout: 10000 // 10 second timeout threshold
};

async function scrapeBdzRadar() {
  console.log(`[${new Date().toISOString()}] Initiating sync worker loop...`);
  try {
    // Reverse Engineering step: Point to BDZ Radar layout endpoint
    // NOTE: In production, substitute with the exact radar JSON API endpoint identified via Network analysis
    const response = await axios.get('https://radar.bdz.bg/bg', AXIOS_CONFIG);
    const $ = cheerio.load(response.data);
    
    let activeTrains = [];

    // Visual scraping placeholder parse pattern. 
    // Usually, live systems read an internal JSON endpoint from radar.bdz.bg/api/...
    // Below simulates normal structure matching:
    $('.train-row, tr').each((index, element) => {
      const trainNo = $(element).find('.train-number').text().trim();
      const delay = parseInt($(element).find('.delay-minutes').text().trim()) || 0;
      const status = delay > 0 ? `Delayed by ${delay} min` : 'On Time';
      
      if (trainNo) {
        activeTrains.push({
          trainNumber: trainNo,
          delayMinutes: delay,
          status: status,
          lastUpdated: new Date().toISOString()
        });
      }
    });

    // Write processed elements directly into clean localized caching memory matrices
    if (activeTrains.length > 0) {
      for (const train of activeTrains) {
        await redis.set(`train_live:${train.trainNumber}`, JSON.stringify(train), 'EX', 120); // 2 minute expiry
      }
      console.log(`[Worker Sync] Successfully updated ${activeTrains.length} active trains inside local RAM state stores.`);
    } else {
      console.log('[Worker Sync] Warning: Read completed, but no active train entities were discovered inside current viewport.');
    }
  } catch (error) {
    console.error('[Worker Sync Error] Connection target unreachable or structural source modifications encountered:', error.message);
  }
}

// Infinite execution cycle engine block loop
console.log('BDZ Data Synchronizer Worker Started Engine Node Loop Successfully...');
scrapeBdzRadar();
setInterval(scrapeBdzRadar, SCRAPE_INTERVAL);
