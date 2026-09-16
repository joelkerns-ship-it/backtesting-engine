/**
 * CLI tool for running backtests from the command line
 * Usage: ts-node src/cli.ts
 */

import { Backtester } from './backtester';
import { Candle, RiskConfig } from './types';
import { movingAverageCrossover } from './strategies/movingAverageCrossover';

/**
 * Generate sample candles for testing
 */
function generateSampleCandles(count: number = 252): Candle[] {
  const candles: Candle[] = [];
  let price = 100;
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.abs(Math.random() * 0.5);
    const low = Math.min(open, close) - Math.abs(Math.random() * 0.5);
    const volume = Math.random() * 1000000;

    candles.push({
      timestamp: now - (count - i) * oneDay,
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

/**
 * Format metrics for console output
 */
function printMetrics(result: any): void {
  const m = result.metrics;
  const lines = [
    '\n=== BACKTEST RESULTS ===',
    `Period: ${m.startDate} to ${m.endDate}`,
    `Initial Capital: $${m.initialCapital.toFixed(2)}`,
    `Final Equity: $${m.finalEquity.toFixed(2)}`,
    `Total Return: ${m.totalReturn.toFixed(2)}%`,
    ``,
    '=== TRADES ===',
    `Total Trades: ${m.totalTrades}`,
    `Winning Trades: ${m.winningTrades}`,
    `Losing Trades: ${m.losingTrades}`,
    `Win Rate: ${m.winRate.toFixed(2)}%`,
    `Average Win: $${m.averageWin.toFixed(2)}`,
    `Average Loss: $${m.averageLoss.toFixed(2)}`,
    `Profit Factor: ${m.profitFactor.toFixed(2)}`,
    `Average R Multiple: ${m.averageRMultiple.toFixed(2)}`,
    ``,
    '=== RISK METRICS ===',
    `Max Drawdown: ${m.maxDrawdown.toFixed(2)}%`,
    `Max Drawdown Duration: ${(m.maxDrawdownDuration / (1000 * 60 * 60 * 24)).toFixed(1)} days`,
    `Sharpe Ratio: ${m.sharpeRatio.toFixed(2)}`,
    `Sortino Ratio: ${m.sortinoRatio.toFixed(2)}`,
    `Calmar Ratio: ${m.calmarRatio.toFixed(2)}`,
    '',
  ];

  console.log(lines.join('\n'));
}

/**
 * Main CLI execution
 */
async function main(): Promise<void> {
  console.log('Backtesting Engine - CLI Mode');
  console.log('==============================\n');

  try {
    // Generate sample data
    console.log('Generating sample candle data...');
    const candles = generateSampleCandles(252); // 1 year of daily candles

    // Risk configuration
    const config: RiskConfig = {
      initialCapital: 10000,
      positionSize: 0.1, // 10% per trade
      stopLossPercent: 0.02, // 2% stop loss
      takeProfitPercent: 0.05, // 5% take profit
      trailingStopPercent: 0.02,
      maxDrawdownPercent: 0.3, // Stop if 30% drawdown
      slippagePercent: 0.001,
      commissionPercent: 0.001,
      maxPositions: 1,
    };

    console.log('Running backtest with Moving Average Crossover strategy...\n');

    // Run backtest
    const backtester = new Backtester(config);
    const result = backtester.backtest(candles, movingAverageCrossover);

    // Print results
    printMetrics(result);

    // Print first 10 trades
    if (result.trades.length > 0) {
      console.log('=== FIRST 10 TRADES ===');
      const trades = result.trades.slice(0, 10);
      console.log(
        'Entry\t\t\tExit\t\t\tPrice\t\tR Multiple\tPnL'
      );
      console.log('------\t\t\t----\t\t\t-----\t\t----------\t---');
      trades.forEach((trade) => {
        const entryDate = new Date(trade.entryTime).toLocaleDateString();
        const exitDate = new Date(trade.exitTime).toLocaleDateString();
        console.log(
          `${entryDate}\t${exitDate}\t${trade.entryPrice.toFixed(2)}-${trade.exitPrice.toFixed(
            2
          )}\t${trade.rMultiple.toFixed(2)}\t\t${trade.pnl.toFixed(2)}`
        );
      });
      console.log('');
    }

    // Save results to file
    const fs = await import('fs').then((m) => m.promises);
    const outputFile = 'backtest_results.json';
    await fs.writeFile(outputFile, JSON.stringify(result, null, 2));
    console.log(`Results saved to ${outputFile}`);
  } catch (error) {
    console.error('Backtest failed:', error);
    process.exit(1);
  }
}

main();
