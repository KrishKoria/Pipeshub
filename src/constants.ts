export const QUEUE_PROCESSOR_INTERVAL = 100;
export const SESSION_CHECK_INTERVAL = 10_000;
export const ORDER_CLEANUP_TIMEOUT = 300_000;

export const MILLISECONDS_PER_SECOND = 1_000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const MILLISECONDS_PER_MINUTE =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE;
export const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_MINUTE * MINUTES_PER_HOUR;

export const TIMEZONE_OFFSETS = {
  'Asia/Kolkata': 5.5,
  'Asia/Calcutta': 5.5,
  'America/New_York': -5,
  'Europe/London': 0,
  UTC: 0,
} as const;

export const QUEUE_NOT_FOUND_INDEX = -1;

export const DEFAULT_CONFIG_FILENAME = 'trading-config.json';
export const DEFAULT_LOG_DIRECTORY = 'logs';

export const LOG_FILES = {
  METRICS: 'order-metrics.log',
  RESPONSES: 'order-responses.log',
  UNMATCHED: 'unmatched-responses.log',
  ABANDONED: 'abandoned-orders.log',
} as const;

export const CSV_HEADERS = {
  METRICS: 'timestamp,orderId,responseType,roundTripLatency\n',
  RESPONSES:
    'timestamp,orderId,responseType,roundTripLatency,responseTypeText\n',
  UNMATCHED: 'timestamp,status,orderId,responseType,responseTypeText\n',
  ABANDONED: 'cleanupTimestamp,orderId,sentTimestamp,ageMs\n',
} as const;

export const TIME_FORMAT_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
