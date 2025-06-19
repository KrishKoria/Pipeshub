// Core type definitions converted from C++ template

export interface Logon {
  username: string;
  password: string;
}

export interface Logout {
  username: string;
}

export interface OrderRequest {
  m_symbolId: number;
  m_price: number;
  m_qty: number;
  m_side: 'B' | 'S';
  m_orderId: number;
  requestType?: RequestType;
  timestamp?: number;
}

export enum RequestType {
  Unknown = 0,
  New = 1,
  Modify = 2,
  Cancel = 3,
}

export enum ResponseType {
  Unknown = 0,
  Accept = 1,
  Reject = 2,
}

export interface OrderResponse {
  m_orderId: number;
  m_responseType: ResponseType;
  timestamp?: number;
}

export interface QueuedOrder extends OrderRequest {
  queuedAt: number;
  originalTimestamp: number;
}

export interface OrderMetrics {
  orderId: number;
  responseType: ResponseType;
  roundTripLatency: number;
  timestamp: number;
}

export interface QueueStats {
  queueLength: number;
  ordersThisSecond: number;
  rateLimit: number;
  remainingCapacity: number;
}

export interface TrackingStats {
  pendingOrders: number;
  oldestPendingOrder: { orderId: number; ageMs: number } | null;
}

export interface TradingEvent {
  eventType: 'open' | 'close';
  timeUntilEvent: number;
  eventTime: Date;
}

export interface SystemStatus {
  isInitialized: boolean;
  isTradingActive: boolean;
  queueStats: QueueStats | null;
  trackingStats: TrackingStats | null;
  nextTradingEvent: TradingEvent | null;
}

export interface TimeOfDay {
  hour: number;
  minute: number;
}

export interface TradingConfig {
  tradingHours: {
    start: string;
    end: string;
    timezone: string;
  };
  rateLimit: {
    ordersPerSecond: number;
  };
  credentials: {
    username: string;
    password: string;
  };
}
