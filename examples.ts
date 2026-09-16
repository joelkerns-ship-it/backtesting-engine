/**
 * Example usage demonstrating the backtesting engine
 */

import { Backtester, movingAverageCrossover, Candle, RiskConfig } from './src';

// Generate sample data for 1 year (252 trading days)
function generateSampleData(): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  for (let i = 0; i < 252; i++) {
    const volatility = 0.02; // 2% daily volatility
    const change = (Math.random() - 0.5) * 2 * volatility * price;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.abs(Math.random() * 0.5 * price * volatility);
    const low = Math.min(open, close) - Math.abs(Math.random() * 0.5 * price * volatility);
    const volume = 1000000 + Math.random() * 500000;

    candles.push({
      timestamp: now - (252 - i) * oneDay,
      open,
      high,
      low,
      close,
      volume,
    });

    price = close;
  }

  return candles;
}

// Example 1: Basic backtest
async function example1BasicBacktest(): Promise<void> {
  console.log('\n=== EXAMPLE 1: Basic Backtest ===\n');

  const candles = generateSampleData();

  const config: RiskConfig = {
    initialCapital: 10000,
    positionSize: 0.1, // 10% per trade
    stopLossPercent: 0.02,
    takeProfitPercent: 0.05,
    slippagePercent: 0.001,
    commissionPercent: 0.001,
    maxPositions: 1,
  };

  const backtester = new Backtester(config);
  const result = backtester.backtest(candles, movingAverageCrossover);

  console.log('Metrics:');
  console.log(`- Total Trades: ${result.metrics.totalTrades}`);
  console.log(`- Win Rate: ${result.metrics.winRate.toFixed(2)}%`);
  console.log(`- Total Return: ${result.metrics.totalReturn.toFixed(2)}%`);
  console.log(`- Sharpe Ratio: ${result.metrics.sharpeRatio.toFixed(2)}`);
  console.log(`- Max Drawdown: ${result.metrics.maxDrawdown.toFixed(2)}%`);
  console.log(`- Profit Factor: ${result.metrics.profitFactor.toFixed(2)}`);
}

// Example 2: Custom strategy
async function example2CustomStrategy(): Promise<void> {
  console.log('\n=== EXAMPLE 2: Custom Strategy ===\n');

  const candles = generateSampleData();

  // Simple strategy: Buy if price is above 50-day MA, sell if below
  const customStrategy = (candle: any, index: number, candles: Candle[]) => {
    if (index < 50) return { signal: 'HOLD' };

    const ma50 = candles
      .slice(index - 49, index + 1)
      .reduce((sum, c) => sum + c.close, 0) / 50;

    if (candle.close > ma50) {
      return { signal: 'BUY', confidence: 0.75 };
    } else if (candle.close < ma50) {
      return { signal: 'SELL', confidence: 0.75 };
    }

    return { signal: 'HOLD' };
  };

  const config: RiskConfig = {
    initialCapital: 10000,
    positionSize: 0.1,
    stopLossPercent: 0.03,
    takeProfitPercent: 0.06,
    slippagePercent: 0.001,
    commissionPercent: 0.001,
    maxPositions: 1,
  };

  const backtester = new Backtester(config);
  const result = backtester.backtest(candles, customStrategy);

  console.log('Custom Strategy Results:');
  console.log(`- Total Trades: ${result.metrics.totalTrades}`);
  console.log(`- Win Rate: ${result.metrics.winRate.toFixed(2)}%`);
  console.log(`- Average Win: $${result.metrics.averageWin.toFixed(2)}`);
  console.log(`- Average Loss: $${result.metrics.averageLoss.toFixed(2)}`);
  console.log(`- Total Return: ${result.metrics.totalReturn.toFixed(2)}%`);
  console.log(`- Avg R Multiple: ${result.metrics.averageRMultiple.toFixed(2)}`);
}

// Example 3: Parameter optimization simulation
async function example3ParameterTesting(): Promise<void> {
  console.log('\n=== EXAMPLE 3: Parameter Testing ===\n');

  const candles = generateSampleData();

  const positionSizes = [0.05, 0.1, 0.2];
  const stopLosses = [0.01, 0.02, 0.03];

  console.log('Testing different position sizes and stop losses:\n');
  console.log('PosSize | StopLoss | Trades | Win% | Return% | Sharpe');
  console.log('--------|----------|--------|------|---------|--------');

  for (const posSize of positionSizes) {
    for (const stopLoss of stopLosses) {
      const config: RiskConfig = {
        initialCapital: 10000,
        positionSize: posSize,
        stopLossPercent: stopLoss,
        takeProfitPercent: stopLoss * 2.5, // 2.5:1 risk/reward
        slippagePercent: 0.001,
        commissionPercent: 0.001,
        maxPositions: 1,
      };

      const backtester = new Backtester(config);
      const result = backtester.backtest(candles, movingAverageCrossover);
      const m = result.metrics;

      console.log(
        `${(posSize * 100).toFixed(0).padEnd(7)} | ${(stopLoss * 100).toFixed(0).padEnd(8)} | ${m.totalTrades
          .toString()
          .padEnd(6)} | ${m.winRate.toFixed(1).padEnd(4)} | ${m.totalReturn
          .toFixed(1)
          .padEnd(7)} | ${m.sharpeRatio.toFixed(2)}`
      );
    }
  }
}

// Example 4: Trade analysis
async function example4TradeAnalysis(): Promise<void> {
  console.log('\n=== EXAMPLE 4: Trade-by-Trade Analysis ===\n');

  const candles = generateSampleData();

  const config: RiskConfig = {
    initialCapital: 10000,
    positionSize: 0.1,
    stopLossPercent: 0.02,
    takeProfitPercent: 0.05,
    slippagePercent: 0.001,
    commissionPercent: 0.001,
    maxPositions: 1,
  };

  const backtester = new Backtester(config);
  const result = backtester.backtest(candles, movingAverageCrossover);

  console.log(`First 5 trades:\n`);
  console.log('ID     | Entry Price | Exit Price | PnL     | R Multiple | Win');
  console.log('-------|-------------|------------|---------|------------|-----');

  result.trades.slice(0, 5).forEach((trade) => {
    console.log(
      `${trade.id.padEnd(6)} | ${trade.entryPrice.toFixed(2).padEnd(11)} | ${trade.exitPrice
        .toFixed(2)
        .padEnd(10)} | ${trade.pnl.toFixed(2).padEnd(7)} | ${trade.rMultiple
        .toFixed(2)
        .padEnd(10)} | ${trade.win ? 'YES' : 'NO'}`
    );
  });

  console.log('\nEquity curve (first 10 points):');
  result.equityCurve.slice(0, 10).forEach((point) => {
    const date = new Date(point.timestamp).toLocaleDateString();
    console.log(
      `${date} | Equity: $${point.equity.toFixed(2)} | Drawdown: ${point.drawdown.toFixed(2)}`
    );
  });
}

// Run examples
async function runExamples(): Promise<void> {
  try {
    await example1BasicBacktest();
    await example2CustomStrategy();
    await example3ParameterTesting();
    await example4TradeAnalysis();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Execute if run directly
if (require.main === module) {
  runExamples();
}

export { example1BasicBacktest, example2CustomStrategy, example3ParameterTesting, example4TradeAnalysis };
