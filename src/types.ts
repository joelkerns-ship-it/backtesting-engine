/**
 * Core type definitions for the backtesting engine
 */

export interface Candle {
  timestamp: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Signal = 'BUY' | 'SELL' | 'HOLD';

export interface StrategySignal {
  signal: Signal;
  confidence?: number; // 0-1 confidence level
  metadata?: Record<string, any>;
}

export interface RiskConfig {
  initialCapital: number;
  positionSize: number; // % of capital per trade (0-1)
  stopLossPercent?: number; // % below entry (e.g., 0.02 = 2%)
  takeProfitPercent?: number; // % above entry
  trailingStopPercent?: number; // Trailing stop as % of high water mark
  maxDrawdownPercent?: number; // Max allowed drawdown before stopping
  slippagePercent?: number; // Slippage as % of price (default: 0.001)
  commissionPercent?: number; // Commission/fee as % (default: 0.001)
  maxPositions?: number; // Max concurrent positions (default: 1)
}

export interface Position {
  id: string;
  entryTime: number;
  entryPrice: number;
  quantity: number;
  riskAmount: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStopHigh?: number;
  status: 'OPEN' | 'CLOSED';
  exitTime?: number;
  exitPrice?: number;
  exitReason?: string;
}

export interface Trade {
  id: string;
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  quantity: number;
  positionSize: number; // % of capital
  entryFee: number;
  exitFee: number;
  pnl: number; // Profit/Loss in currency
  pnlPercent: number; // Return as %
  rMultiple: number; // Risk multiple (pnl / risk amount)
  duration: number; // milliseconds
  win: boolean;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
  cash: number;
  drawdown: number;
}

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // %
  averageWin: number;
  averageLoss: number;
  profitFactor: number; // Gross profit / Gross loss
  totalReturn: number; // %
  cumulativePnL: number;
  averageRMultiple: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number; // %
  maxDrawdownDuration: number; // milliseconds
  calmarRatio: number;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalEquity: number;
}

export interface BacktestResult {
  trades: Trade[];
  equityCurve: EquityPoint[];
  metrics: BacktestMetrics;
  config: RiskConfig;
}

export type StrategyFunction = (
  candle: Candle,
  index: number,
  candles: Candle[],
  positions: Position[],
  equity: number,
  cash: number
) => StrategySignal;
