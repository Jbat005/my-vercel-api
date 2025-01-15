// my-vercel-api/api/monteCarlo-lib.js

import { create, all } from 'mathjs';

/***********************************************************************
 * This file exports:
 *   runMonteCarloSimulation(priceData, numPortfolios)
 *
 * Where priceData = { TICKER: [price1, price2, ...], ... }
 ***********************************************************************/

// Initialize mathjs
const mathConfig = {};
const math = create(all, mathConfig);

// Helper: daily returns
function calculateDailyReturns(prices) {
  const dailyReturns = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev > 0) {
      dailyReturns.push((curr - prev) / prev);
    } else {
      dailyReturns.push(0);
    }
  }
  return dailyReturns;
}

// Build mean & covariance
function buildMeanAndCov(priceData) {
  const tickers = Object.keys(priceData);
  if (!tickers.length) {
    throw new Error("No tickers provided in priceData.");
  }

  // Convert to 2D daily returns
  const dailyReturnsMap = {};
  let minLength = Infinity;

  tickers.forEach((tkr) => {
    const arr = priceData[tkr] || [];
    const ret = calculateDailyReturns(arr);
    dailyReturnsMap[tkr] = ret;
    if (ret.length < minLength) {
      minLength = ret.length;
    }
  });

  // Align them
  const dailyReturns2D = [];
  for (let i = 0; i < minLength; i++) {
    const row = [];
    for (const tkr of tickers) {
      const ret = dailyReturnsMap[tkr];
      row.push(ret[ret.length - minLength + i]);
    }
    dailyReturns2D.push(row);
  }

  const R = math.matrix(dailyReturns2D); // shape: [numDays, numTickers]
  const numDays = minLength;
  const numTickers = tickers.length;

  // Mean daily
  const meanDaily = [];
  for (let j = 0; j < numTickers; j++) {
    let sum = 0;
    for (let i = 0; i < numDays; i++) {
      sum += R.get([i, j]);
    }
    meanDaily.push(sum / numDays);
  }

  // Annualize => multiply by ~252
  const meanAnnual = meanDaily.map((x) => x * 252);

  // Covariance (daily)
  const covDaily = math.matrix(math.zeros([numTickers, numTickers]));

  function getColumn(arr2D, col) {
    return arr2D.map((r) => r[col]);
  }

  for (let i = 0; i < numTickers; i++) {
    for (let j = i; j < numTickers; j++) {
      const colI = getColumn(dailyReturns2D, i);
      const colJ = getColumn(dailyReturns2D, j);
      let sumCov = 0;
      for (let d = 0; d < numDays; d++) {
        sumCov += (colI[d] - meanDaily[i]) * (colJ[d] - meanDaily[j]);
      }
      const covVal = sumCov / (numDays - 1); // sample-based
      covDaily.set([i, j], covVal);
      covDaily.set([j, i], covVal);
    }
  }

  // Annualize
  const covAnnual = math.multiply(covDaily, 252);

  return {
    meanReturns: meanAnnual,
    covMatrix: covAnnual,
    tickers,
  };
}

// The main Monte Carlo runner
function runMonteCarlo(meanReturns, covMatrix, tickers, numPortfolios = 10000) {
  const n = tickers.length;
  const allReturns = [];
  const allVols = [];
  const allSharpes = [];
  const allWeights = [];

  for (let p = 0; p < numPortfolios; p++) {
    let w = Array(n)
      .fill(0)
      .map(() => Math.random());
    const sumW = w.reduce((a, b) => a + b, 0);
    w = w.map((val) => val / sumW);

    // Portfolio return
    const portRet = w.reduce((acc, weight, idx) => acc + weight * meanReturns[idx], 0);

    // volatility
    const wVec = math.matrix(w);
    const tW = math.transpose(wVec);
    const val = math.multiply(math.multiply(tW, covMatrix), wVec);
    const portVol = Math.sqrt(val.valueOf());

    const portSharpe = portVol === 0 ? 0 : portRet / portVol;

    allReturns.push(portRet);
    allVols.push(portVol);
    allSharpes.push(portSharpe);
    allWeights.push(w);
  }

  // find min vol
  let minV = Infinity;
  let minIdx = -1;
  for (let i = 0; i < numPortfolios; i++) {
    if (allVols[i] < minV) {
      minV = allVols[i];
      minIdx = i;
    }
  }

  // find max sharpe
  let maxS = -Infinity;
  let maxIdx = -1;
  for (let i = 0; i < numPortfolios; i++) {
    if (allSharpes[i] > maxS) {
      maxS = allSharpes[i];
      maxIdx = i;
    }
  }

  function mapWeights(wArr) {
    const obj = {};
    wArr.forEach((val, idx) => {
      obj[tickers[idx]] = val;
    });
    return obj;
  }

  return {
    numPortfolios,
    tickers,
    MinVolPortfolio: {
      weights: mapWeights(allWeights[minIdx]),
      return: allReturns[minIdx],
      volatility: allVols[minIdx],
      sharpe: allSharpes[minIdx],
    },
    MaxSharpePortfolio: {
      weights: mapWeights(allWeights[maxIdx]),
      return: allReturns[maxIdx],
      volatility: allVols[maxIdx],
      sharpe: allSharpes[maxIdx],
    },
  };
}

// Public function to build data and run the simulation
export async function runMonteCarloSimulation(priceData, numPortfolios = 10000) {
  const { meanReturns, covMatrix, tickers } = buildMeanAndCov(priceData);
  const result = runMonteCarlo(meanReturns, covMatrix, tickers, numPortfolios);
  return result;
}
