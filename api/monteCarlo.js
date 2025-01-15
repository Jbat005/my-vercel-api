// my-vercel-api/api/monteCarlo.js
import { runMonteCarloSimulation } from './monteCarlo-lib.js';
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tickers = [], period = '1y', num_portfolios = 50000 } = req.body || {};
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: 'No tickers provided or invalid format' });
    }

    // Basic date range
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    // Build priceData from yahooFinance
    const priceData = {};
    for (const tkr of tickers) {
      const history = await yahooFinance.historical(tkr, {
        period1: oneYearAgo,
        period2: today,
      });
      history.sort((a, b) => a.date - b.date);
      priceData[tkr] = history.map((h) => h.close);
    }

    // Run the Monte Carlo
    const result = await runMonteCarloSimulation(priceData, num_portfolios);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
