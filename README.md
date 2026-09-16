# Backtesting Engine

A comprehensive TypeScript-based backtesting engine for trading strategies. Simulates trades on historical candles, applies risk management rules, and computes detailed performance metrics.

## Features

✅ **Strategy Simulation**
- Execute strategy signals (BUY/SELL/HOLD) on historical candles
- Support for custom strategy functions
- Built-in strategies: Moving Average Crossover, RSI

✅ **Risk Management**
- Stop loss and take profit levels
- Trailing stops with configurable percentages
- Position sizing based on risk
- Maximum drawdown limits
- Commission and slippage modeling

✅ **Trade Tracking**
- Full trade history with entry/exit prices
- Win/loss classification
- Position management (open/closed)
- Risk multiples (R-multiple) calculation

✅ **Performance Metrics**
- Equity curve with drawdown tracking
- Win rate, profit factor, average R multiple
- Sharpe ratio, Sortino ratio, Calmar ratio
- Max drawdown and duration
- Total return and cumulative PnL

✅ **Multiple Interfaces**
- TypeScript library for programmatic use
- Express REST API (`/api/backtest`)
- CLI tool for quick backtests

## Installation

```bash
git clone https://github.com/joelkerns-ship-it/backtesting-engine.git
cd backtesting-engine
npm install
npm run build
```

## Quick Start

### CLI Usage

Run a backtest with sample data:

```bash
npm run backtest
```

This generates 252 days of sample candle data and runs the Moving Average Crossover strategy, outputting results to `backtest_results.json`.

### Programmatic Usage

```typescript
import { Backtester, movingAverageCrossover, Candle, RiskConfig } from './src';

// Define your candles
const candles: Candle[] = [
  { timestamp: 1609459200000, open: 100, high: 105, low: 99, close: 104, volume: 1000000 },
  // ... more candles
];

// Configure risk
const config: RiskConfig = {
  initialCapital: 10000,
  positionSize: 0.1,       // 10% per trade
  stopLossPercent: 0.02,   // 2% stop
  takeProfitPercent: 0.05, // 5% target
  trailingStopPercent: 0.02,
  slippagePercent: 0.001,
  commissionPercent: 0.001,
  maxPositions: 1,
};

// Run backtest
const backtester = new Backtester(config);
const result = backtester.backtest(candles, movingAverageCrossover);

console.log(result.metrics);
```

### REST API Usage

Start the server:

```bash
npm run dev
```

#### POST /api/backtest

Run a backtest via HTTP:

```bash
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "candles": [
      {"timestamp": 1609459200000, "open": 100, "high": 105, "low": 99, "close": 104, "volume": 1000000},
      ...
    ],
    "strategy": "movingAverageCrossover",
    "config": {
      "initialCapital": 10000,
      "positionSize": 0.1,
      "stopLossPercent": 0.02,
      "takeProfitPercent": 0.05,
      "trailingStopPercent": 0.02,
      "slippagePercent": 0.001,
      "commissionPercent": 0.001,
      "maxPositions": 1
    }
  }'
```

#### GET /api/strategies

List available strategies:

```bash
curl http://localhost:3000/api/strategies
```

Response:
```json
{
  "strategies": [
    {
      "name": "movingAverageCrossover",
      "description": "Buy on golden cross (fast MA > slow MA), sell on death cross",
      "parameters": {
        "fastPeriod": 10,
        "slowPeriod": 20
      }
    },
    {
      "name": "rsi",
      "description": "Buy on oversold (RSI < 30), sell on overbought (RSI > 70)",
      "parameters": {
        "period": 14,
        "overbought": 70,
        "oversold": 30
      }
    }
  ]
}
```

#### GET /api/config-template

Get a default risk config template:

```bash
curl http://localhost:3000/api/config-template
```

## Data Types

### Candle
```typescript
interface Candle {
  timestamp: number;    // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### RiskConfig
```typescript
interface RiskConfig {
  initialCapital: number;
  positionSize: number;           // % of capital per trade (0-1)
  stopLossPercent?: number;       // % below entry
  takeProfitPercent?: number;     // % above entry
  trailingStopPercent?: number;   // % of high water mark
  maxDrawdownPercent?: number;    // Stop if exceeded
  slippagePercent?: number;       // Default: 0.001 (0.1%)
  commissionPercent?: number;     // Default: 0.001 (0.1%)
  maxPositions?: number;          // Default: 1
}
```

### Trade
```typescript
interface Trade {
  id: string;
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  quantity: number;
  positionSize: number;
  entryFee: number;
  exitFee: number;
  pnl: number;              // Profit/Loss in currency
  pnlPercent: number;       // Return as %
  rMultiple: number;        // Risk multiple
  duration: number;         // milliseconds
  win: boolean;
}
```

### BacktestMetrics
```typescript
interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;          // %
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  totalReturn: number;      // %
  cumulativePnL: number;
  averageRMultiple: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;      // %
  maxDrawdownDuration: number; // milliseconds
  calmarRatio: number;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalEquity: number;
}
```

## Assumptions & Execution Model

### Slippage
- Applied as a percentage spread on entry (negative) and exit (negative)
- Default: 0.1% (0.001)
- Simulates market impact and bid-ask spread

### Commissions/Fees
- Applied at entry and exit as a percentage of notional value
- Default: 0.1% (0.001)
- Includes broker commissions and exchange fees

### Order Execution
- **Entry**: Buy signal triggers at current close price + slippage
- **Exit**: 
  - Strategy signal: exit at close + slippage
  - Stop loss: exit at exact stop price (assuming hit within candle)
  - Take profit: exit at exact target price (assuming hit within candle)
  - Trailing stop: exit when price dips below trailing level

### Position Sizing
- Fixed percentage of current equity per trade
- Position size = equity × positionSize
- Quantity = positionSize / entryPrice

### Risk Management
- Positions checked at each candle for stop/target/trailing stop hits
- If max drawdown exceeded, backtest stops
- Remaining open positions closed at end of test

### Metrics Assumptions
- **Sharpe Ratio**: Assumes daily candles, risk-free rate = 0, annualized (×252)
- **Sortino Ratio**: Uses only downside volatility
- **Calmar Ratio**: Annualized return / max drawdown
- **Drawdown**: Calculated as (high water mark - current equity) / initial capital

## Writing Custom Strategies

Create a strategy function matching the `StrategyFunction` signature:

```typescript
import { StrategyFunction, StrategySignal } from './src/types';

const myStrategy: StrategyFunction = (
  candle,      // Current candle
  index,       // Index in candle array
  candles,     // All candles
  positions,   // Current open positions
  equity,      // Current equity
  cash         // Available cash
): StrategySignal => {
  // Your logic here
  if (someCondition) {
    return {
      signal: 'BUY',
      confidence: 0.85,
      metadata: { reason: 'Golden cross' }
    };
  }
  return { signal: 'HOLD' };
};
```

Then pass it to the backtester:

```typescript
const backtester = new Backtester(config);
const result = backtester.backtest(candles, myStrategy);
```

## Example Strategies Included

### Moving Average Crossover
- Fast MA (10), Slow MA (20)
- Buy: Fast MA crosses above Slow MA (Golden Cross)
- Sell: Fast MA crosses below Slow MA (Death Cross)
- File: `src/strategies/movingAverageCrossover.ts`

### RSI Strategy
- Period: 14
- Buy: RSI < 30 (oversold)
- Sell: RSI > 70 (overbought)
- File: `src/strategies/movingAverageCrossover.ts` (rsiStrategy function)

## Performance Tips

1. **Limit candle data**: Backtesting 5+ years at 1-minute granularity is slow
2. **Use max drawdown stop**: Prevents running full test on losing strategies
3. **Optimize strategy parameters offline**: Test parameter sweeps separately
4. **Batch requests**: Use API to run multiple backtests in parallel

## Project Structure

```
backtesting-engine/
├── src/
│   ├── backtester.ts           # Main backtesting engine
│   ├── types.ts                # TypeScript type definitions
│   ├── server.ts               # Express API server
│   ├── cli.ts                  # Command-line interface
│   ├── index.ts                # Main export
│   └── strategies/
│       └── movingAverageCrossover.ts  # Example strategies
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| POST | /api/backtest | Run a backtest |
| GET | /api/strategies | List available strategies |
| GET | /api/config-template | Get default config |

## Development

```bash
# Build
npm run build

# Run server
npm run dev

# Run CLI
npm run backtest

# Run tests (when added)
npm test

# Clean build
npm run clean
```

## Notes

- Backtester processes candles sequentially
- Positions are updated for stop/target/trailing stop at each candle
- Strategy receives full candle array for lookback calculations
- All timestamps are Unix milliseconds
- Results include trade-by-trade detail for detailed analysis

## License

MIT

## Contributing

Issues and pull requests welcome!
