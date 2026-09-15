/**
 * Main backtesting engine
 * Simulates trades based on candle data and strategy signals
 */

import {
  Candle,
  RiskConfig,
  StrategyFunction,
  Position,
  Trade,
  EquityPoint,
  BacktestResult,
  BacktestMetrics,
} from './types';

export class Backtester {
  private config: RiskConfig;
  private trades: Trade[] = [];
  private positions: Position[] = [];
  private equityCurve: EquityPoint[] = [];
  private cash: number;
  private equity: number;
  private tradeIdCounter = 0;
  private highWaterMark: number;
  private maxDrawdown = 0;
  private maxDrawdownStart?: EquityPoint;
  private maxDrawdownEnd?: EquityPoint;

  constructor(config: RiskConfig) {
    this.config = {
      slippagePercent: 0.001,
      commissionPercent: 0.001,
      maxPositions: 1,
      ...config,
    };
    this.cash = this.config.initialCapital;
    this.equity = this.config.initialCapital;
    this.highWaterMark = this.config.initialCapital;
  }

  /**
   * Run the backtest
   */
  public backtest(
    candles: Candle[],
    strategy: StrategyFunction
  ): BacktestResult {
    if (candles.length === 0) {
      throw new Error('No candles provided');
    }

    // Reset state
    this.trades = [];
    this.positions = [];
    this.equityCurve = [];
    this.cash = this.config.initialCapital;
    this.equity = this.config.initialCapital;
    this.highWaterMark = this.config.initialCapital;
    this.maxDrawdown = 0;
    this.tradeIdCounter = 0;

    // Process each candle
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];

      // Update existing positions (check stop/target hits)
      this.updatePositions(candle, i, candles);

      // Get strategy signal
      const signal = strategy(
        candle,
        i,
        candles,
        this.positions,
        this.equity,
        this.cash
      );

      // Execute signal
      if (signal.signal === 'BUY') {
        this.executeBuy(candle, i);
      } else if (signal.signal === 'SELL') {
        this.executeSell(candle, i);
      }

      // Record equity point
      this.recordEquity(candle);

      // Check max drawdown limit
      if (
        this.config.maxDrawdownPercent &&
        this.getDrawdownPercent() > this.config.maxDrawdownPercent
      ) {
        console.warn(
          `Max drawdown of ${this.config.maxDrawdownPercent}% exceeded at candle ${i}`
        );
        break;
      }
    }

    // Close remaining open positions at last candle
    const lastCandle = candles[candles.length - 1];
    for (const position of [...this.positions]) {
      if (position.status === 'OPEN') {
        this.closePosition(position, lastCandle.close, lastCandle.timestamp, 'End of backtest');
      }
    }

    // Final equity record
    this.recordEquity(lastCandle);

    // Calculate metrics
    const metrics = this.calculateMetrics(candles);

    return {
      trades: this.trades,
      equityCurve: this.equityCurve,
      metrics,
      config: this.config,
    };
  }

  /**
   * Update existing positions: check for stop loss / take profit / trailing stop
   */
  private updatePositions(candle: Candle, index: number, candles: Candle[]): void {
    for (const position of this.positions) {
      if (position.status !== 'OPEN') continue;

      let shouldClose = false;
      let exitPrice = candle.close;
      let exitReason = '';

      // Check stop loss (using low of candle)
      if (
        position.stopLoss !== undefined &&
        candle.low <= position.stopLoss
      ) {
        shouldClose = true;
        exitPrice = position.stopLoss;
        exitReason = 'Stop Loss';
      }

      // Check take profit (using high of candle)
      if (
        !shouldClose &&
        position.takeProfit !== undefined &&
        candle.high >= position.takeProfit
      ) {
        shouldClose = true;
        exitPrice = position.takeProfit;
        exitReason = 'Take Profit';
      }

      // Check trailing stop
      if (!shouldClose && position.trailingStopHigh !== undefined) {
        const trailingStop =
          position.trailingStopHigh *
          (1 - (this.config.trailingStopPercent || 0.02));
        if (candle.low <= trailingStop) {
          shouldClose = true;
          exitPrice = trailingStop;
          exitReason = 'Trailing Stop';
        }

        // Update trailing stop high
        if (candle.high > position.trailingStopHigh) {
          position.trailingStopHigh = candle.high;
        }
      }

      if (shouldClose) {
        this.closePosition(
          position,
          exitPrice,
          candle.timestamp,
          exitReason
        );
      }
    }
  }

  /**
   * Execute a BUY signal
   */
  private executeBuy(candle: Candle, index: number): void {
    // Check if we can open a new position
    const openPositions = this.positions.filter((p) => p.status === 'OPEN');
    if (openPositions.length >= (this.config.maxPositions || 1)) {
      return;
    }

    // Calculate position size
    const riskAmount = this.equity * this.config.positionSize;
    const entryPrice = candle.close * (1 + (this.config.slippagePercent || 0));
    const quantity = riskAmount / entryPrice;
    const fee = quantity * entryPrice * (this.config.commissionPercent || 0);

    // Check if we have enough cash
    if (this.cash < quantity * entryPrice + fee) {
      return;
    }

    const position: Position = {
      id: `pos_${++this.tradeIdCounter}`,
      entryTime: candle.timestamp,
      entryPrice,
      quantity,
      riskAmount,
      status: 'OPEN',
    };

    // Set stop loss and take profit
    if (this.config.stopLossPercent) {
      position.stopLoss =
        entryPrice * (1 - this.config.stopLossPercent);
    }

    if (this.config.takeProfitPercent) {
      position.takeProfit =
        entryPrice * (1 + this.config.takeProfitPercent);
    }

    // Set trailing stop
    if (this.config.trailingStopPercent) {
      position.trailingStopHigh = entryPrice;
    }

    this.positions.push(position);
    this.cash -= quantity * entryPrice + fee;
  }

  /**
   * Execute a SELL signal (close oldest position)
   */
  private executeSell(candle: Candle, index: number): void {
    const openPosition = this.positions.find((p) => p.status === 'OPEN');
    if (!openPosition) {
      return;
    }

    const exitPrice = candle.close * (1 - (this.config.slippagePercent || 0));
    this.closePosition(
      openPosition,
      exitPrice,
      candle.timestamp,
      'Strategy Signal'
    );
  }

  /**
   * Close a position and record trade
   */
  private closePosition(
    position: Position,
    exitPrice: number,
    exitTime: number,
    exitReason: string
  ): void {
    position.status = 'CLOSED';
    position.exitTime = exitTime;
    position.exitPrice = exitPrice;
    position.exitReason = exitReason;

    const exitFee =
      position.quantity * exitPrice * (this.config.commissionPercent || 0);
    const proceeds = position.quantity * exitPrice - exitFee;
    const pnl = proceeds - (position.quantity * position.entryPrice + (position.quantity * position.entryPrice * (this.config.commissionPercent || 0)));
    const pnlPercent = (pnl / (position.quantity * position.entryPrice)) * 100;
    const rMultiple = pnl / position.riskAmount;

    const trade: Trade = {
      id: position.id,
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      exitTime,
      exitPrice,
      quantity: position.quantity,
      positionSize: this.config.positionSize,
      entryFee: position.quantity * position.entryPrice * (this.config.commissionPercent || 0),
      exitFee,
      pnl,
      pnlPercent,
      rMultiple,
      duration: exitTime - position.entryTime,
      win: pnl > 0,
    };

    this.trades.push(trade);
    this.cash += proceeds;
    this.equity = this.cash + this.getOpenPositionValue();
  }

  /**
   * Get the total value of open positions at current market price
   */
  private getOpenPositionValue(): number {
    return 0; // Simplified: we'll track equity through cash + realized PnL
  }

  /**
   * Record equity point for equity curve
   */
  private recordEquity(candle: Candle): void {
    const openPnL = this.positions
      .filter((p) => p.status === 'OPEN')
      .reduce((sum, p) => sum + (p.quantity * candle.close - p.quantity * p.entryPrice), 0);

    this.equity = this.cash + openPnL;

    const drawdown = this.highWaterMark - this.equity;
    if (drawdown > this.maxDrawdown) {
      this.maxDrawdown = drawdown;
    }

    this.highWaterMark = Math.max(this.highWaterMark, this.equity);

    this.equityCurve.push({
      timestamp: candle.timestamp,
      equity: this.equity,
      cash: this.cash,
      drawdown: drawdown,
    });
  }

  /**
   * Get current drawdown as percentage
   */
  private getDrawdownPercent(): number {
    return ((this.highWaterMark - this.equity) / this.highWaterMark) * 100;
  }

  /**
   * Calculate backtest metrics
   */
  private calculateMetrics(candles: Candle[]): BacktestMetrics {
    const totalTrades = this.trades.length;
    const winningTrades = this.trades.filter((t) => t.win).length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const wins = this.trades.filter((t) => t.win);
    const losses = this.trades.filter((t) => !t.win);

    const averageWin =
      wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
    const averageLoss =
      losses.length > 0
        ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length
        : 0;

    const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(
      losses.reduce((sum, t) => sum + t.pnl, 0)
    );
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    const cumulativePnL = this.trades.reduce((sum, t) => sum + t.pnl, 0);
    const totalReturn = ((this.equity - this.config.initialCapital) / this.config.initialCapital) * 100;

    const rMultiples = this.trades.map((t) => t.rMultiple);
    const averageRMultiple =
      rMultiples.length > 0
        ? rMultiples.reduce((sum, r) => sum + r, 0) / rMultiples.length
        : 0;

    // Sharpe Ratio: (avg return - risk-free rate) / std dev of returns
    const returns = this.equityCurve.map((e, i) =>
      i === 0
        ? 0
        : (e.equity - this.equityCurve[i - 1].equity) /
          this.equityCurve[i - 1].equity
    );
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
        returns.length
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn * 252) / stdDev : 0; // Assuming daily candles

    // Sortino Ratio: uses only downside deviation
    const downsideReturns = returns.filter((r) => r < 0);
    const downsideStdDev =
      downsideReturns.length > 0
        ? Math.sqrt(
            downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) /
              downsideReturns.length
          )
        : 0;
    const sortinoRatio =
      downsideStdDev > 0 ? (avgReturn * 252) / downsideStdDev : 0;

    // Max Drawdown
    const maxDrawdownPercent = (this.maxDrawdown / this.config.initialCapital) * 100;

    // Calmar Ratio: annual return / max drawdown
    const dayCount = (candles[candles.length - 1].timestamp - candles[0].timestamp) / (1000 * 60 * 60 * 24);
    const annualizedReturn = (totalReturn / dayCount) * 365;
    const calmarRatio = maxDrawdownPercent > 0 ? annualizedReturn / maxDrawdownPercent : 0;

    // Max Drawdown Duration
    let maxDrawdownDuration = 0;
    let drawdownStart = 0;
    for (let i = 0; i < this.equityCurve.length; i++) {
      if (i === 0) continue;
      const prevEquity = this.equityCurve[i - 1].equity;
      const currentEquity = this.equityCurve[i].equity;
      if (currentEquity < prevEquity) {
        if (drawdownStart === 0) {
          drawdownStart = i;
        }
      } else if (drawdownStart > 0) {
        const duration =
          this.equityCurve[i].timestamp -
          this.equityCurve[drawdownStart].timestamp;
        if (duration > maxDrawdownDuration) {
          maxDrawdownDuration = duration;
        }
        drawdownStart = 0;
      }
    }

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      averageWin,
      averageLoss,
      profitFactor,
      totalReturn,
      cumulativePnL,
      averageRMultiple,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown: maxDrawdownPercent,
      maxDrawdownDuration,
      calmarRatio,
      startDate: new Date(candles[0].timestamp).toISOString(),
      endDate: new Date(candles[candles.length - 1].timestamp).toISOString(),
      initialCapital: this.config.initialCapital,
      finalEquity: this.equity,
    };
  }
}
