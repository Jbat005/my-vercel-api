// api/stocks/[ticker].js

const yahooFinance = require("yahoo-finance2").default;

module.exports = async (req, res) => {
  try {
    // 1) Grab the ticker from the dynamic route
    const { ticker } = req.query;
    if (!ticker) {
      return res.status(400).json({ error: "No ticker provided" });
    }

    // 2) Fetch historical data (1 year back, for example)
    const today = new Date();
    const lastYear = new Date();
    lastYear.setFullYear(today.getFullYear() - 1);

    const history = await yahooFinance.historical(ticker, {
      period1: lastYear,
      period2: today,
    });

    // 3) Sort oldest to newest, map to { date, close }
    const prices = history
      .sort((a, b) => a.date - b.date)
      .map((entry) => ({
        date: entry.date.toISOString(),
        close: entry.close,
      }));

    // 4) Return JSON
    return res.status(200).json({
      ticker: ticker.toUpperCase(),
      prices: prices,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).json({ error: "Failed to fetch stock data" });
  }
};
