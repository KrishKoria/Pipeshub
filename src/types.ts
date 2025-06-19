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
  timestamp?: number; // Added for latency calculation
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
  timestamp?: number; // Added for latency calculation
}

// Additional types for internal tracking
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

export interface TradingConfig {
  tradingHours: {
    start: string; // Format: "HH:MM"
    end: string; // Format: "HH:MM"
    timezone: string; // e.g., "Asia/Kolkata"
  };
  rateLimit: {
    ordersPerSecond: number;
  };
  credentials: {
    username: string;
    password: string;
  };
}
