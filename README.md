# Order Management System

A TypeScript-based order management system that handles order flow with time-based trading windows, rate limiting, and queue management.

## Features

- **Time-based Trading Windows**: Orders only accepted during configured trading hours
- **Rate Limiting**: Controls orders per second to exchange (configurable)
- **Queue Management**: FIFO queue with modify/cancel support
- **Response Tracking**: Order lifecycle tracking with latency metrics
- **Persistent Logging**: CSV logs for analysis

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run the demo:

```bash
npm run dev
```

### Configuration

Edit `config/trading-config.json`:

```json
{
  "tradingHours": {
    "start": "10:00",
    "end": "15:30",
    "timezone": "Asia/Kolkata"
  },
  "rateLimit": {
    "ordersPerSecond": 100
  },
  "credentials": {
    "username": "trader_001",
    "password": "secure_password_123"
  }
}
```

## Development

```bash
# Run the demo
npm run dev

# Run tests
npm test
```

## Architecture

The system consists of 5 main components:

- **ConfigManager**: Loads and validates configuration
- **TimeManager**: Handles trading hours and sessions
- **RateLimiter**: Manages order queue and rate limiting
- **MetricsLogger**: Tracks responses and logs metrics
- **OrderManagement**: Main class coordinating everything

## Key Design Decisions

1. **No External Dependencies**: Implements all functionality without 3rd party libraries
2. **Thread Safety**: Single-threaded design as required by C++ template
3. **In-Memory Queue**: FIFO queue with modify/cancel support
4. **File-Based Logging**: CSV logs for easy analysis
5. **Timezone Handling**: Basic timezone support (production would use proper library)

## Key Assumptions

1. **RequestType Field**: Added `requestType` to `OrderRequest` interface to detect New/Modify/Cancel operations
2. **Order ID Uniqueness**: Order IDs are unique across all upstream systems
3. **No External Dependencies**: All functionality implemented without 3rd party libraries (as required)
4. **In-Memory Only**: Queue state not persisted across system restarts
5. **File-Based Storage**: CSV logging instead of database for metrics storage
6. **Basic Timezone Support**: Simple timezone handling (production would use proper library)
7. **Reasonable Volumes**: No queue size limits (assumes manageable order volumes)
8. **Network Reliability**: No retry logic for exchange communication failures
