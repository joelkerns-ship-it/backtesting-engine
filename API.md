# API Examples & Request/Response Formats

This document provides detailed examples of using the backtesting engine via the REST API.

## Base URL

```
http://localhost:3000
```

---

## Health Check

### Request
```bash
curl http://localhost:3000/health
```

### Response
```json
{
  "status": "ok",
  "timestamp": "2026-09-16T11:40:00.000Z"
}
```

---

## Get Available Strategies

### Request
```bash
curl http://localhost:3000/api/strategies
```

### Response
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

---

## Get Config Template

### Request
```bash
curl http://localhost:3000/api/config-template
```

### Response
```json
{
  "initialCapital": 10000,
  "positionSize": 0.1,
  "stopLossPercent": 0.02,
  "takeProfitPercent": 0.05,
  "trailingStopPercent": 0.02,
  "maxDrawdownPercent": 0.2,
  "slippagePercent": 0.001,
  "commissionPercent": 0.001,
  "maxPositions": 1
}
```

---

## Run Backtest

### Request

```bash
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "candles": [
      {
        "timestamp": 1609459200000,
        "open": 100.0,
        "high": 105.0,
        "low": 99.0,
        "close": 104.0,
        "volume": 1000000
      },
      {
        "timestamp": 1609545600000,
        "open": 104.0,
        "high": 108.0,
        "low": 102.0,
        "close": 107.0,
        "volume": 1100000
      },
      {
        "timestamp": 1609632000000,
        "open": 107.0,
        "high": 109.0,
        "low": 105.0,
        "close": 106.5,
        "volume": 950000
      }
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

### Response (Successful)

```json
{
  "success": true,
  "data": {
    "trades": [
      {
        "id": "pos_1",
        "entryTime": 1609459200000,
        "entryPrice": 104.104,
        "exitTime": 1609632000000,
        "exitPrice": 106.391,
        "quantity": 9.6,
        "positionSize": 0.1,
        "entryFee": 10.01,
        "exitFee": 10.21,
        "pnl": 209.5,
        "pnlPercent": 2.09,
        "rMultiple": 2.1,
        "duration": 172800000,
        "win": true
      }
    ],
    "equityCurve": [
      {
        "timestamp": 1609459200000,
        "equity": 10000,
        "cash": 8989.89,
        "drawdown": 0
      },
      {
        "timestamp": 1609545600000,
        "equity": 10223.5,
        "cash": 8989.89,
        "drawdown": 0
      },
      {
        "timestamp": 1609632000000,
        "equity": 10432.29,
        "cash": 9999.29,
        "drawdown": 0
      }
    ],
    "metrics": {
      "totalTrades": 1,
      "winningTrades": 1,
      "losingTrades": 0,
      "winRate": 100.0,
      "averageWin": 209.5,
      "averageLoss": 0,
      "profitFactor": 0,
      "totalReturn": 4.32,
      "cumulativePnL": 432.29,
      "averageRMultiple": 2.1,
      "sharpeRatio": 0.85,
      "sortinoRatio": 1.23,
      "maxDrawdown": 0.0,
      "maxDrawdownDuration": 0,
      "calmarRatio": 0,
      "startDate": "2021-01-01T00:00:00.000Z",
      "endDate": "2021-01-03T00:00:00.000Z",
      "initialCapital": 10000,
      "finalEquity": 10432.29
    },
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
  },
  "timestamp": "2026-09-16T11:45:00.000Z"
}
```

### Response (Error - Invalid Candles)

```bash
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{"candles": [], "strategy": "movingAverageCrossover", "config": {}}'
```

**Status**: 400

```json
{
  "error": "Invalid candles: must be a non-empty array"
}
```

### Response (Error - Unknown Strategy)

```bash
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "candles": [...],
    "strategy": "unknownStrategy",
    "config": {...}
  }'
```

**Status**: 400

```json
{
  "error": "Unknown strategy: unknownStrategy. Available: movingAverageCrossover, rsi"
}
```

### Response (Error - Server Error)

**Status**: 500

```json
{
  "error": "Internal server error",
  "message": "Error details",
  "timestamp": "2026-09-16T11:45:00.000Z"
}
```

---

## Practical Examples

### Example 1: Backtest with Moving Average Crossover

```bash
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "candles": [
    {"timestamp": 1609459200000, "open": 100, "high": 105, "low": 99, "close": 104, "volume": 1000000},
    {"timestamp": 1609545600000, "open": 104, "high": 108, "low": 102, "close": 107, "volume": 1100000},
    {"timestamp": 1609632000000, "open": 107, "high": 109, "low": 105, "close": 106.5, "volume": 950000},
    {"timestamp": 1609718400000, "open": 106.5, "high": 110, "low": 104, "close": 109, "volume": 1050000},
    {"timestamp": 1609804800000, "open": 109, "high": 112, "low": 107, "close": 111, "volume": 1200000}
  ],
  "strategy": "movingAverageCrossover",
  "config": {
    "initialCapital": 50000,
    "positionSize": 0.2,
    "stopLossPercent": 0.03,
    "takeProfitPercent": 0.08,
    "slippagePercent": 0.002,
    "commissionPercent": 0.0015,
    "maxPositions": 1
  }
}
EOF
```

### Example 2: Backtest with RSI Strategy

```bash
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "candles": [...],
    "strategy": "rsi",
    "config": {
      "initialCapital": 10000,
      "positionSize": 0.15,
      "stopLossPercent": 0.025,
      "takeProfitPercent": 0.06,
      "trailingStopPercent": 0.03,
      "slippagePercent": 0.001,
      "commissionPercent": 0.001
    }
  }'
```

### Example 3: Aggressive Risk Config

```bash
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "candles": [...],
    "strategy": "movingAverageCrossover",
    "config": {
      "initialCapital": 10000,
      "positionSize": 0.25,
      "stopLossPercent": 0.01,
      "takeProfitPercent": 0.10,
      "slippagePercent": 0.005,
      "commissionPercent": 0.003,
      "maxDrawdownPercent": 0.15
    }
  }'
```

### Example 4: Conservative Risk Config

```bash
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "candles": [...],
    "strategy": "rsi",
    "config": {
      "initialCapital": 100000,
      "positionSize": 0.05,
      "stopLossPercent": 0.05,
      "takeProfitPercent": 0.10,
      "trailingStopPercent": 0.05,
      "slippagePercent": 0.001,
      "commissionPercent": 0.001,
      "maxDrawdownPercent": 0.10
    }
  }'
```

---

## Candle Data Format

Each candle must include:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | number | Unix timestamp in milliseconds |
| `open` | number | Opening price |
| `high` | number | Highest price during period |
| `low` | number | Lowest price during period |
| `close` | number | Closing price |
| `volume` | number | Trading volume |

**Example Candle**:
```json
{
  "timestamp": 1609459200000,
  "open": 100.50,
  "high": 105.75,
  "low": 99.25,
  "close": 104.30,
  "volume": 1250000
}
```

---

## Configuration Options

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `initialCapital` | number | - | > 0 | Starting account size |
| `positionSize` | number | - | 0-1 | % of equity per trade |
| `stopLossPercent` | number | - | 0-1 | Stop loss as % below entry |
| `takeProfitPercent` | number | - | 0-1 | Take profit as % above entry |
| `trailingStopPercent` | number | - | 0-1 | Trailing stop as % below high |
| `maxDrawdownPercent` | number | - | 0-1 | Max allowed drawdown before stop |
| `slippagePercent` | number | 0.001 | 0-1 | Execution slippage as % |
| `commissionPercent` | number | 0.001 | 0-1 | Commission/fees as % |
| `maxPositions` | number | 1 | 1+ | Max concurrent positions |

---

## Response Structure

### Successful Response

```json
{
  "success": true,
  "data": {
    "trades": [...],
    "equityCurve": [...],
    "metrics": {...},
    "config": {...}
  },
  "timestamp": "ISO-8601 string"
}
```

### Error Response

```json
{
  "error": "Error message",
  "timestamp": "ISO-8601 string"
}
```

---

## Python Client Example

```python
import requests
import json
from datetime import datetime, timedelta

class BacktestClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
    
    def get_strategies(self):
        response = requests.get(f"{self.base_url}/api/strategies")
        return response.json()
    
    def get_config_template(self):
        response = requests.get(f"{self.base_url}/api/config-template")
        return response.json()
    
    def run_backtest(self, candles, strategy, config):
        payload = {
            "candles": candles,
            "strategy": strategy,
            "config": config
        }
        response = requests.post(
            f"{self.base_url}/api/backtest",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        return response.json()

# Usage
client = BacktestClient()

# Get template
config = client.get_config_template()
config['initialCapital'] = 50000
config['positionSize'] = 0.15

# Generate sample candles
candles = []
price = 100
now = int(datetime.now().timestamp() * 1000)
for i in range(252):
    candle = {
        "timestamp": now - (252 - i) * 24 * 60 * 60 * 1000,
        "open": price,
        "high": price + 5,
        "low": price - 2,
        "close": price + 2,
        "volume": 1000000
    }
    candles.append(candle)
    price = candle['close']

# Run backtest
result = client.run_backtest(candles, "movingAverageCrossover", config)

# Print results
if result.get('success'):
    metrics = result['data']['metrics']
    print(f"Total Trades: {metrics['totalTrades']}")
    print(f"Win Rate: {metrics['winRate']:.2f}%")
    print(f"Total Return: {metrics['totalReturn']:.2f}%")
    print(f"Sharpe Ratio: {metrics['sharpeRatio']:.2f}")
    print(f"Max Drawdown: {metrics['maxDrawdown']:.2f}%")
```

---

## JavaScript/TypeScript Client Example

```typescript
interface BacktestRequest {
  candles: Candle[];
  strategy: string;
  config: RiskConfig;
}

class BacktestClient {
  constructor(private baseUrl: string = "http://localhost:3000") {}

  async getStrategies() {
    const response = await fetch(`${this.baseUrl}/api/strategies`);
    return response.json();
  }

  async getConfigTemplate() {
    const response = await fetch(`${this.baseUrl}/api/config-template`);
    return response.json();
  }

  async runBacktest(request: BacktestRequest) {
    const response = await fetch(`${this.baseUrl}/api/backtest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return response.json();
  }
}

// Usage
const client = new BacktestClient();
const result = await client.runBacktest({
  candles: [...],
  strategy: "movingAverageCrossover",
  config: {...}
});

console.log(`Sharpe Ratio: ${result.data.metrics.sharpeRatio}`);
```

---

## Common Errors & Solutions

### Error: "Invalid candles: must be a non-empty array"
**Cause**: Candles array is empty or missing  
**Solution**: Ensure you're providing at least one candle object

### Error: "Unknown strategy"
**Cause**: Strategy name doesn't match available options  
**Solution**: Use `/api/strategies` to see available options

### Error: 413 Payload Too Large
**Cause**: Candle data exceeds server limit  
**Solution**: Test with fewer candles or chunk the data

### Status: 500 Internal Server Error
**Cause**: Unexpected error in backtesting logic  
**Solution**: Check console logs on server, verify candle data format

---

**Last Updated**: 2026-09-16  
**Version**: 1.0.0
