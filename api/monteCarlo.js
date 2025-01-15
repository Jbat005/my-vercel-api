// my-vercel-api/api/monteCarlo.js
import { runMonteCarloSimulation } from './monteCarlo-lib.js';
import yahooFinance from 'yahoo-finance2';

/**
 * Vercel serverless function handler for running Monte Carlo simulations.
 * Handles CORS preflight OPTIONS requests and POST requests.
 */
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        // Handle preflight request
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tickers = [], period = '1y', num_portfolios = 50000 } = req.body || {};
        if (!Array.isArray(tickers) || tickers.length === 0) {
            return res.status(400).json({ error: 'No tickers provided or invalid format' });
        }

        // Define date range based on 'period'
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        // Fetch historical data for each ticker
        const priceData = {};
        for (const tkr of tickers) {
            const history = await yahooFinance.historical(tkr, {
                period1: oneYearAgo,
                period2: today,
            });

            if (!history || history.length === 0) {
                return res.status(400).json({ error: `No historical data found for ticker: ${tkr}` });
            }

            // Sort by date ascending
            history.sort((a, b) => a.date - b.date);

            // Map to array of close prices
            priceData[tkr] = history.map((h) => h.close);
        }

        // Run the Monte Carlo simulation
        const result = await runMonteCarloSimulation(priceData, num_portfolios);

        return res.status(200).json(result);
    } catch (err) {
        console.error('Monte Carlo Simulation Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
