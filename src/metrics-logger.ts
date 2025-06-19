import * as fs from 'fs';
import * as path from 'path';
import { OrderResponse, OrderMetrics, ResponseType } from './types';
import {
  DEFAULT_LOG_DIRECTORY,
  LOG_FILES,
  CSV_HEADERS,
  ORDER_CLEANUP_TIMEOUT,
} from './constants';
import {
  getResponseTypeText,
  formatTimestamp,
  logError,
  logWarning,
  calculateAge,
  safeParseInt,
  safeParseNumber,
} from './utils';

export class MetricsLogger {
  private sentOrders: Map<number, number> = new Map();
  private readonly logDirectory: string;
  private readonly metricsFile: string;
  private readonly responseFile: string;
  private logStream: fs.WriteStream | null = null;

  constructor(logDirectory?: string) {
    this.logDirectory =
      logDirectory || path.join(__dirname, '..', DEFAULT_LOG_DIRECTORY);
    this.metricsFile = path.join(this.logDirectory, LOG_FILES.METRICS);
    this.responseFile = path.join(this.logDirectory, LOG_FILES.RESPONSES);
    this.initializeLogging();
  }

  public recordOrderSent(orderId: number, sentTimestamp?: number): void {
    const timestamp = sentTimestamp || Date.now();
    this.sentOrders.set(orderId, timestamp);
  }

  public recordOrderResponse(response: OrderResponse): OrderMetrics | null {
    const receivedTimestamp = response.timestamp || Date.now();
    const sentTimestamp = this.sentOrders.get(response.m_orderId);

    if (!sentTimestamp) {
      this.logUnmatchedResponse(response, receivedTimestamp);
      return null;
    }

    const roundTripLatency = receivedTimestamp - sentTimestamp;

    const metrics: OrderMetrics = {
      orderId: response.m_orderId,
      responseType: response.m_responseType,
      roundTripLatency,
      timestamp: receivedTimestamp,
    };

    this.logMetrics(metrics);
    this.logResponse(response, receivedTimestamp, roundTripLatency);

    this.sentOrders.delete(response.m_orderId);

    return metrics;
  }

  private initializeLogging(): void {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }

      this.initializeMetricsFile();
      this.initializeResponseFile();
    } catch (error) {
      logError('Failed to initialize logging', error);
      throw new Error(`Logging initialization failed: ${error}`);
    }
  }
  private initializeMetricsFile(): void {
    if (!fs.existsSync(this.metricsFile)) {
      fs.writeFileSync(this.metricsFile, CSV_HEADERS.METRICS, 'utf-8');
    }
  }

  private initializeResponseFile(): void {
    if (!fs.existsSync(this.responseFile)) {
      fs.writeFileSync(this.responseFile, CSV_HEADERS.RESPONSES, 'utf-8');
    }
  }
  private logMetrics(metrics: OrderMetrics): void {
    try {
      const logLine = `${formatTimestamp(metrics.timestamp)},${metrics.orderId},${metrics.responseType},${metrics.roundTripLatency}\n`;
      fs.appendFileSync(this.metricsFile, logLine, 'utf-8');
    } catch (error) {
      logError('Failed to log metrics', error);
    }
  }
  private logResponse(
    response: OrderResponse,
    timestamp: number,
    latency: number
  ): void {
    try {
      const responseTypeText = getResponseTypeText(response.m_responseType);
      const logLine = `${formatTimestamp(timestamp)},${response.m_orderId},${response.m_responseType},${latency},${responseTypeText}\n`;
      fs.appendFileSync(this.responseFile, logLine, 'utf-8');
    } catch (error) {
      logError('Failed to log response', error);
    }
  }
  private logUnmatchedResponse(
    response: OrderResponse,
    timestamp: number
  ): void {
    try {
      const warningFile = path.join(this.logDirectory, LOG_FILES.UNMATCHED);
      const responseTypeText = getResponseTypeText(response.m_responseType);
      const logLine = `${formatTimestamp(timestamp)},UNMATCHED,${response.m_orderId},${response.m_responseType},${responseTypeText}\n`;

      if (!fs.existsSync(warningFile)) {
        fs.writeFileSync(warningFile, CSV_HEADERS.UNMATCHED, 'utf-8');
      }

      fs.appendFileSync(warningFile, logLine, 'utf-8');
      logWarning('Unmatched response', `for order ${response.m_orderId}`);
    } catch (error) {
      logError('Failed to log unmatched response', error);
    }
  }
  public getTrackingStats(): {
    pendingOrders: number;
    oldestPendingOrder: { orderId: number; ageMs: number } | null;
  } {
    const now = Date.now();
    let oldestOrder: { orderId: number; ageMs: number } | null = null;

    for (const [orderId, sentTimestamp] of this.sentOrders.entries()) {
      const ageMs = calculateAge(sentTimestamp, now);
      if (!oldestOrder || ageMs > oldestOrder.ageMs) {
        oldestOrder = { orderId, ageMs };
      }
    }

    return {
      pendingOrders: this.sentOrders.size,
      oldestPendingOrder: oldestOrder,
    };
  }
  public cleanupOldOrders(maxAgeMs: number = ORDER_CLEANUP_TIMEOUT): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [orderId, sentTimestamp] of this.sentOrders.entries()) {
      if (calculateAge(sentTimestamp, now) > maxAgeMs) {
        this.sentOrders.delete(orderId);
        this.logAbandonedOrder(orderId, sentTimestamp, now);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
  private logAbandonedOrder(
    orderId: number,
    sentTimestamp: number,
    cleanupTimestamp: number
  ): void {
    try {
      const abandonedFile = path.join(this.logDirectory, LOG_FILES.ABANDONED);
      const ageMs = calculateAge(sentTimestamp, cleanupTimestamp);
      const logLine = `${formatTimestamp(cleanupTimestamp)},${orderId},${sentTimestamp},${ageMs}\n`;

      if (!fs.existsSync(abandonedFile)) {
        fs.writeFileSync(abandonedFile, CSV_HEADERS.ABANDONED, 'utf-8');
      }

      fs.appendFileSync(abandonedFile, logLine, 'utf-8');
      logWarning('Abandoned order', `${orderId} after ${ageMs}ms`);
    } catch (error) {
      logError('Failed to log abandoned order', error);
    }
  }

  public getPendingOrderIds(): number[] {
    return Array.from(this.sentOrders.keys());
  }

  public isOrderTracked(orderId: number): boolean {
    return this.sentOrders.has(orderId);
  }
  public async getMetricsForTimeRange(
    startTime: number,
    endTime: number
  ): Promise<OrderMetrics[]> {
    return new Promise((resolve, reject) => {
      try {
        const metrics: OrderMetrics[] = [];
        const fileContent = fs.readFileSync(this.metricsFile, 'utf-8');
        const lines = fileContent.split('\n').slice(1); // Skip header

        for (const line of lines) {
          if (line.trim()) {
            const [timestampStr, orderIdStr, responseTypeStr, latencyStr] =
              line.split(',');
            const timestamp = new Date(timestampStr!).getTime();

            if (timestamp >= startTime && timestamp <= endTime) {
              metrics.push({
                orderId: safeParseInt(orderIdStr!, 0),
                responseType: safeParseInt(responseTypeStr!, 0) as ResponseType,
                roundTripLatency: safeParseNumber(latencyStr!, 0),
                timestamp,
              });
            }
          }
        }

        resolve(metrics);
      } catch (error) {
        reject(new Error(`Failed to read metrics: ${error}`));
      }
    });
  }

  public close(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}
