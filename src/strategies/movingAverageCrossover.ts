/**
 * Example Strategy: Moving Average Crossover
 * Buy when fast MA crosses above slow MA
 * Sell when fast MA crosses below slow MA
 */

import { Candle, StrategySignal } from '../types';

const FAST_PERIOD = 10;
const SLOW_PERIOD = 20;

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(candles: Candle[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = candles
        .slice(i - period + 1, i + 1)
        .reduce((acc, c) => acc + c.close, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

export function movingAverageCrossover(
  candle: Candle,
  index: number,
  candles: Candle[]
): StrategySignal {
  // Need at least SLOW_PERIOD candles
  if (index < SLOW_PERIOD) {
    return { signal: 'HOLD' };
  }

  const fastSMA = calculateSMA(candles.slice(0, index + 1), FAST_PERIOD);
  const slowSMA = calculateSMA(candles.slice(0, index + 1), SLOW_PERIOD);

  const currentFast = fastSMA[index];
  const currentSlow = slowSMA[index];
  const prevFast = fastSMA[index - 1];
  const prevSlow = slowSMA[index - 1];

  // Golden Cross: Fast MA crosses above Slow MA
  if (prevFast <= prevSlow && currentFast > currentSlow) {
    return {
      signal: 'BUY',
      confidence: 0.8,
      metadata: { fastMA: currentFast, slowMA: currentSlow },
    };
  }

  // Death Cross: Fast MA crosses below Slow MA
  if (prevFast >= prevSlow && currentFast < currentSlow) {
    return {
      signal: 'SELL',
      confidence: 0.8,
      metadata: { fastMA: currentFast, slowMA: currentSlow },
    };
  }

  return { signal: 'HOLD' };
}

/**
 * Alternative: RSI-based strategy
 */
export function rsiStrategy(
  candle: Candle,
  index: number,
  candles: Candle[]
): StrategySignal {
  const RSI_PERIOD = 14;
  const OVERBOUGHT = 70;
  const OVERSOLD = 30;

  if (index < RSI_PERIOD) {
    return { signal: 'HOLD' };
  }

  const rsi = calculateRSI(candles.slice(0, index + 1), RSI_PERIOD);
  const currentRSI = rsi[index];

  if (currentRSI < OVERSOLD) {
    return {
      signal: 'BUY',
      confidence: 0.7,
      metadata: { rsi: currentRSI },
    };
  }

  if (currentRSI > OVERBOUGHT) {
    return {
      signal: 'SELL',
      confidence: 0.7,
      metadata: { rsi: currentRSI },
    };
  }

  return { signal: 'HOLD' };
}

/**
 * Calculate RSI (Relative Strength Index)
 */
function calculateRSI(candles: Candle[], period: number): number[] {
  const rsi: number[] = [];
  const changes = candles.map((c, i) =>
    i === 0 ? 0 : c.close - candles[i - 1].close
  );

  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      rsi.push(NaN);
    } else {
      const gains = changes
        .slice(i - period + 1, i + 1)
        .filter((c) => c > 0)
        .reduce((a, b) => a + b, 0);
      const losses = Math.abs(
        changes
          .slice(i - period + 1, i + 1)
          .filter((c) => c < 0)
          .reduce((a, b) => a + b, 0)
      );

      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgLoss > 0 ? avgGain / avgLoss : 0;
      rsi.push(100 - 100 / (1 + rs));
    }
  }

  return rsi;
}
