// api/stocks/[ticker].js

const yahooFinance = require('yahoo-finance2').default;

module.exports = async (req, res) => {
  // 1) Add CORS headers to allow any domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  // 2) Handle preflight OPTIONS request (if any)
  if (req.method === 'OPTIONS') {
    // Just respond OK
    return res.status(200).end();
  }

  try {
    // Extract the ticker param from the dynamic route
    const { ticker } = req.query;
    if (!ticker) {
      return res.status(400).json({ error: "No ticker provided" });
    }

    // Fetch 1 year of historical data (adjust as needed)
    const today = new Date();
    const lastYear = new Date();
    lastYear.setFullYear(today.getFullYear() - 1);

    const history = await yahooFinance.historical(ticker, {
      period1: lastYear,  // start date
      period2: today,     // end date
    });

    // Sort oldest to newest, map to { date, close }
    const prices = history
      .sort((a, b) => a.date - b.date)
      .map((entry) => ({
        date: entry.date.toISOString(),
        close: entry.close,
      }));

    // Return JSON
    return res.status(200).json({
      ticker: ticker.toUpperCase(),
      prices: prices,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).json({ error: "Failed to fetch stock data" });
  }
};
