import { ResponseType, OrderRequest, RequestType } from './types';

export function getResponseTypeText(
  responseType: ResponseType | number
): string {
  const typeValue =
    typeof responseType === 'number' ? responseType : Number(responseType);

  switch (typeValue) {
    case ResponseType.Accept:
    case 1:
      return 'ACCEPT';
    case ResponseType.Reject:
    case 2:
      return 'REJECT';
    case ResponseType.Unknown:
    case 0:
    default:
      return 'UNKNOWN';
  }
}
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function logError(context: string, error: unknown): void {
  console.error(`${context}: ${error}`);
}

export function logWarning(context: string, message: string): void {
  console.warn(`${context}: ${message}`);
}

export function validateOrderRequest(request: OrderRequest): void {
  if (!request.m_orderId || request.m_orderId <= 0) {
    throw new Error('Invalid or missing order ID');
  }

  if (!request.m_symbolId || request.m_symbolId <= 0) {
    throw new Error('Invalid or missing symbol ID');
  }

  const isCancel = request.requestType === RequestType.Cancel;

  if (!isCancel && (!request.m_price || request.m_price <= 0)) {
    throw new Error('Invalid or missing price');
  }

  if (!isCancel && (!request.m_qty || request.m_qty <= 0)) {
    throw new Error('Invalid or missing quantity');
  }

  if (!request.m_side || (request.m_side !== 'B' && request.m_side !== 'S')) {
    throw new Error('Invalid side - must be B (Buy) or S (Sell)');
  }
}

export function safeParseNumber(
  value: string,
  defaultValue: number = 0
): number {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function safeParseInt(value: string, defaultValue: number = 0): number {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function calculateAge(
  timestamp: number,
  currentTime: number = Date.now()
): number {
  return currentTime - timestamp;
}
