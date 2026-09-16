# Backtesting Engine: Assumptions & Execution Model

This document outlines the detailed assumptions, execution flow, and design decisions in the backtesting engine.

## Table of Contents

1. [Execution Flow](#execution-flow)
2. [Order Execution Model](#order-execution-model)
3. [Slippage & Commissions](#slippage--commissions)
4. [Risk Management](#risk-management)
5. [Position Management](#position-management)
6. [Metrics Calculations](#metrics-calculations)
7. [Known Limitations](#known-limitations)
8. [Design Justifications](#design-justifications)

---

## Execution Flow

### Per-Candle Processing

For each candle in the dataset, the backtester executes the following sequence:

```
1. Update existing positions
   └─ Check stop loss / take profit / trailing stop
   └─ Close positions if triggered

2. Request strategy signal
   └─ Strategy analyzes current candle + history
   └─ Returns BUY / SELL / HOLD signal

3. Execute signal
   └─ BUY:  Open new position (if capacity)
   └─ SELL: Close oldest open position
   └─ HOLD: No action

4. Record equity point
   └─ Calculate current P&L (open + closed)
   └─ Update equity curve
   └─ Track drawdown

5. Check stopping conditions
   └─ If max drawdown exceeded, halt backtest
```

### End-of-Backtest Cleanup

- Any remaining open positions are closed at the final candle's close price
- Equity curve is finalized
- All metrics are calculated

---

## Order Execution Model

### Entry (BUY) Execution

**Trigger**: When strategy returns `signal: 'BUY'`

**Price Calculation**:
```
Entry Price = candle.close × (1 + slippagePercent)
```

**Assumptions**:
- Order is filled at current candle's close (end-of-bar fill)
- Slippage is applied as a negative spread (you pay more to buy)
- The entry occurs AFTER the strategy receives the signal (no lookahead bias)

**Position Sizing**:
```
Position Risk Amount = current_equity × positionSize
Quantity = Position Risk Amount / Entry Price
```

**Example**:
- Equity: $10,000
- Position Size: 0.1 (10%)
- Risk Amount: $1,000
- Entry Price: $100
- Quantity: 10 contracts
- Cost (with 0.1% slippage): $1,000 × 1.001 = $1,001

### Exit (SELL) Execution

#### Strategy Signal Exit
**Trigger**: Strategy returns `signal: 'SELL'` when position is open

**Price**: `candle.close × (1 - slippagePercent)`

#### Stop Loss Exit
**Trigger**: `candle.low <= stopLossPrice`

**Price**: Exact `stopLossPrice` (assumes execution at the stop level)

**Rationale**: Assumes stop orders are market orders that execute at or near the stop price during the candle.

#### Take Profit Exit
**Trigger**: `candle.high >= takeProfitPrice`

**Price**: Exact `takeProfitPrice`

**Rationale**: Assumes profit target orders execute at the target price.

#### Trailing Stop Exit
**Trigger**: `candle.low <= (highestPriceSinceEntry × (1 - trailingStopPercent))`

**Price**: The trailing stop level

**Logic**:
- Highest price since entry is updated if current candle's high exceeds it
- Trail is set as a percentage below the highest point
- If price dips below the trail, position closes

---

## Slippage & Commissions

### Slippage

**Definition**: Cost of market impact and bid-ask spread

**Application**:
- **Entry**: Price moves against you → `close × (1 + slippagePercent)`
- **Exit (signal)**: Price moves against you → `close × (1 - slippagePercent)`
- **Stop/Target/Trailing**: No slippage (assumed to execute at limit prices)

**Default**: 0.1% (0.001)

**Typical Ranges**:
- Liquid stocks/ETFs: 0.01-0.05%
- Crypto major pairs: 0.02-0.10%
- Forex majors: 0.001-0.005%
- Illiquid stocks: 0.5-2.0%

### Commissions/Fees

**Definition**: Broker fees, exchange fees, regulatory charges

**Application**: Applied at both entry and exit
```
Entry Fee = Quantity × Entry Price × commissionPercent
Exit Fee  = Quantity × Exit Price × commissionPercent
```

**Default**: 0.1% (0.001)

**Typical Ranges**:
- Interactive Brokers stocks: 0.001-0.004%
- Retail brokers (flat fee): ~0.01% equivalent
- Crypto exchanges: 0.1-0.5%
- Forex brokers: 0-0.05% (often built into spread)

---

## Risk Management

### Position Size Calculation

```
positionSize = 0.1  // 10% of capital per trade
riskAmount = equity × positionSize
quantity = riskAmount / entryPrice
```

**Rationale**: 
- Fixed fractional sizing scales with account growth
- If you lose, next trade is smaller (preserves capital)
- If you win, next trade is larger (compounds gains)

### Stop Loss

```
stopLoss = entryPrice × (1 - stopLossPercent)
```

**Example**: Entry $100, stop 2% → Stop at $98

**Execution**: If candle low drops to or below stop, position closes at stop price

### Take Profit

```
takeProfit = entryPrice × (1 + takeProfitPercent)
```

**Example**: Entry $100, profit target 5% → Target at $105

**Execution**: If candle high reaches or exceeds target, position closes at target price

### Trailing Stop

```
trail = highestPrice × (1 - trailingStopPercent)
```

**Logic**:
1. Track highest price since entry (`trailingStopHigh`)
2. If current candle's high > `trailingStopHigh`, update it
3. If current candle's low < (highestPrice × (1 - trailingStopPercent)), close
4. Trail only moves up, never down

**Use Case**: Lock in gains while allowing room for pullbacks

### Max Drawdown Stop

```
drawdownPercent = (highWaterMark - currentEquity) / initialCapital × 100

if drawdownPercent > maxDrawdownPercent:
    halt backtest
```

**Example**: Max drawdown 20%, current equity at 85% of start → Stop backtest

**Rationale**: Prevents strategy from destroying account; stops testing unprofitable parameters

---

## Position Management

### Maximum Positions

```
maxPositions = 1  // Only one open trade at a time
```

**Current**: Single position only (can be extended for multi-leg)

**Check**: Before opening new position
```typescript
const openCount = positions.filter(p => p.status === 'OPEN').length;
if (openCount >= maxPositions) {
  // Reject new entry signal
}
```

### Position Status

- **OPEN**: Actively managed, checked for stop/target/trail
- **CLOSED**: Final trade record, no longer updated

### Exit Priority

When multiple exits are possible (stop < target < highest), the first one hit wins:

1. **Stop Loss** checked against `candle.low`
2. **Take Profit** checked against `candle.high`
3. **Trailing Stop** checked against `candle.low`
4. **Strategy Signal** (SELL) at `candle.close`

---

## Metrics Calculations

### Trade Metrics

**Per Trade**:
```
pnl = exitValue - entryValue
    = (Qty × exitPrice) - (Qty × entryPrice) - fees

pnlPercent = pnl / (Qty × entryPrice) × 100

rMultiple = pnl / riskAmount
          // How many times the initial risk you made/lost

duration = exitTime - entryTime
```

### Aggregate Metrics

**Count & Win Rate**:
```
totalTrades = count of all closed trades
winningTrades = count where pnl > 0
losingTrades = count where pnl < 0
winRate = (winningTrades / totalTrades) × 100
```

**Average Win/Loss**:
```
wins = [trades where pnl > 0]
losses = [trades where pnl < 0]

averageWin = sum(wins) / count(wins)
averageLoss = sum(losses) / count(losses)
```

**Profit Factor**:
```
grossProfit = sum of all winning trade PnLs
grossLoss = abs(sum of all losing trade PnLs)

profitFactor = grossProfit / grossLoss
```

**Interpretation**:
- > 1.5: Generally profitable
- > 2.0: Very profitable
- < 1.0: Money-losing system

**Average R Multiple**:
```
rMultiples = [trade.pnl / trade.riskAmount for each trade]
averageRMultiple = mean(rMultiples)
```

**Interpretation**:
- > 1.0: On average, you win more than you risk
- < 1.0: On average, you lose more than you risk

### Equity Curve Metrics

**Total Return**:
```
totalReturn = ((finalEquity - initialCapital) / initialCapital) × 100
```

**Cumulative PnL**:
```
cumulativePnL = finalEquity - initialCapital
```

**Max Drawdown**:
```
For each point in equity curve:
  drawdown = highWaterMark - currentEquity
  maxDrawdown = max of all drawdowns

maxDrawdownPercent = (maxDrawdown / initialCapital) × 100
```

**High Water Mark**: The peak equity achieved at any point in the test

### Risk-Adjusted Metrics

**Sharpe Ratio** (Annualized):
```
dailyReturns = [daily equity changes / previous equity]
avgReturn = mean(dailyReturns)
stdDev = stdev(dailyReturns)
riskFreeRate = 0 (assumed)

sharpeRatio = ((avgReturn - riskFreeRate) / stdDev) × sqrt(252)
// 252 = trading days per year
```

**Interpretation**:
- > 1.0: Good risk-adjusted return
- > 2.0: Excellent
- < 0: Negative return adjusted for risk

**Sortino Ratio** (Similar to Sharpe, but only downside risk):
```
downsideReturns = [returns where return < 0]
downsideStdDev = stdev(downsideReturns)

sortinoRatio = (avgReturn / downsideStdDev) × sqrt(252)
```

**Interpretation**: More favorable than Sharpe if strategy has upside skew

**Calmar Ratio**:
```
annualizedReturn = (totalReturn / dayCount) × 365
calmarRatio = annualizedReturn / maxDrawdownPercent
```

**Interpretation**:
- > 1.0: Return exceeds max drawdown (good)
- > 3.0: Excellent risk-reward

---

## Known Limitations

### 1. Gap Risk
**Assumption**: All stops and targets execute within the candle's high/low range

**Reality**: Gaps overnight or at open can bypass stops

**Mitigation**: Use opening price checks in strategy logic

### 2. Slippage Simplification
**Assumption**: Slippage is a fixed percentage

**Reality**: Slippage varies with liquidity, volume, market conditions, and order size

**Mitigation**: Test with multiple slippage scenarios

### 3. Stop/Target Assumption
**Assumption**: Stop loss/take profit execute at exact prices

**Reality**: May only partially fill, especially on illiquid assets

**Mitigation**: Use slightly wider targets than backtest suggests

### 4. No Partial Fills
**Assumption**: Positions open/close entirely at once

**Reality**: Large orders may fill in tranches

**Mitigation**: Reduce position size in backtest, or use smaller candle timeframes

### 5. Single Timeframe
**Assumption**: Strategy signals based only on current timeframe

**Reality**: Multi-timeframe strategies may have different dynamics

**Mitigation**: Run tests on multiple timeframes separately

### 6. No Correlation to Volume
**Assumption**: Volume doesn't affect execution or slippage

**Reality**: Low volume = worse execution

**Mitigation**: Add volume-weighted slippage in strategy logic

### 7. Simple Execution Logic
**Assumption**: All signals execute same day

**Reality**: Some signals should wait for confirmation

**Mitigation**: Add delay logic in strategy (check `index - lastSignalIndex > threshold`)

### 8. No Commissions on Trail/Stop/Target
**Assumption**: Only entry/signal-based exits have commissions

**Reality**: Broker charges on all exits

**Mitigation**: Modify backtester to add fees to all exits

---

## Design Justifications

### Why Entry Price = Close × (1 + slippage)?

- **Realistic**: On entry, you pay more than you want
- **Conservative**: Penalizes aggressive strategies
- **Consistent**: Same treatment as trading in real life

### Why Stops/Targets = Exact Price?

- **Limit Orders**: Assuming you use stop-limit orders that execute at target
- **Alternative**: Could model as market orders with additional slippage
- **Current**: Assumes perfect execution on the limit price

### Why High/Low Within Candle?

- **Realistic**: High/low tick within a candle is price action that occurred
- **Alternative**: Could assume only open/close were traded
- **Current**: Assumes any price between high/low could be hit

### Why Single Position?

- **Simplicity**: Easier to reason about and debug
- **Default**: Most retail traders trade one at a time
- **Extensible**: Can expand to multi-position with position list

### Why Equity Based Sizing?

- **Compound Growth**: Accounts for both wins and losses
- **Alternative**: Fixed position size ignores account changes
- **Current**: More realistic for long-term trading

### Why Sharpe with 252 Days?

- **Standard**: 252 is official trading days per year (US)
- **Annualization**: Allows comparison across timeframes
- **Alternative**: Could use different factors for intraday or crypto (24/7)

---

## Validating Your Backtests

1. **Check Trade Counts**: Do you have enough trades to draw conclusions?
   - < 10 trades: Too few (luck-based)
   - 30-100+ trades: Sufficient for initial screening

2. **Sharpe > Sortino?**: If Sortino much higher, you have upside skew (good!)

3. **Profit Factor > 2.0?**: Generally needed for real trading (accounting for slippage margin)

4. **Max Drawdown < 30%?**: Larger drawdowns mean higher psychological pressure

5. **Average Win > Average Loss?**: Positive expectancy requirement

6. **Calmar > 1.0?**: Annual return should exceed maximum drawdown

7. **Test Different Markets**: Does strategy work in trending, ranging, volatile, calm markets?

8. **Robustness**: Test +/- 10% parameter changes. Do results hold?

---

## Further Reading

- Kelly Criterion: Optimal position sizing
- Monte Carlo Simulation: Test strategy robustness
- Walk-Forward Analysis: Time-window based testing
- Out-of-Sample Testing: Hold-out test set
- Parameter Sensitivity Analysis: How much do small changes matter?

---

**Last Updated**: 2026-09-16  
**Version**: 1.0.0
