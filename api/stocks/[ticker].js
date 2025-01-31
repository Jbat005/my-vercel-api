
// api/stocks/[ticker].js
const yahooFinance = require('yahoo-finance2').default;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    try {
        const { ticker } = req.query;
        const startDate = req.query.start ? new Date(req.query.start) : new Date();
        startDate.setFullYear(startDate.getFullYear() - 1); // Default to 1 year
        
        const history = await yahooFinance.historical(ticker, {
            period1: startDate,
            period2: new Date(),
            interval: '1d' // Ensure daily data
        });

        const prices = history
            .sort((a, b) => a.date - b.date)
            .map((entry) => ({
                date: entry.date.toISOString(),
                close: entry.close,
            }));

        return res.status(200).json({
            ticker: ticker.toUpperCase(),
            prices: prices,
        });
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ error: "Failed to fetch stock data" });
    }
};
