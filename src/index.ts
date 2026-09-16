/**
 * Main index file - exports backtester and types
 */

export { Backtester } from './backtester';
export type {
  Candle,
  Signal,
  StrategySignal,
  RiskConfig,
  Position,
  Trade,
  EquityPoint,
  BacktestMetrics,
  BacktestResult,
  StrategyFunction,
} from './types';

export { movingAverageCrossover, rsiStrategy } from './strategies/movingAverageCrossover';
