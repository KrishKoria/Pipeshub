import * as fs from 'fs';
import * as path from 'path';
import { OrderResponse, OrderMetrics, ResponseType } from './types';
import {
  DEFAULT_LOG_DIRECTORY,
  LOG_FILES,
  CSV_HEADERS,
  ORDER_CLEANUP_TIMEOUT,
} from './constants';

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
      console.error('Failed to initialize logging:', error);
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
      const logLine = `${new Date(metrics.timestamp).toISOString()},${metrics.orderId},${metrics.responseType},${metrics.roundTripLatency}\n`;
      fs.appendFileSync(this.metricsFile, logLine, 'utf-8');
    } catch (error) {
      console.error('Failed to log metrics:', error);
    }
  }

  private logResponse(
    response: OrderResponse,
    timestamp: number,
    latency: number
  ): void {
    try {
      const responseTypeText = this.getResponseTypeText(
        response.m_responseType
      );
      const logLine = `${new Date(timestamp).toISOString()},${response.m_orderId},${response.m_responseType},${latency},${responseTypeText}\n`;
      fs.appendFileSync(this.responseFile, logLine, 'utf-8');
    } catch (error) {
      console.error('Failed to log response:', error);
    }
  }
  private logUnmatchedResponse(
    response: OrderResponse,
    timestamp: number
  ): void {
    try {
      const warningFile = path.join(this.logDirectory, LOG_FILES.UNMATCHED);
      const responseTypeText = this.getResponseTypeText(
        response.m_responseType
      );
      const logLine = `${new Date(timestamp).toISOString()},UNMATCHED,${response.m_orderId},${response.m_responseType},${responseTypeText}\n`;

      if (!fs.existsSync(warningFile)) {
        fs.writeFileSync(warningFile, CSV_HEADERS.UNMATCHED, 'utf-8');
      }

      fs.appendFileSync(warningFile, logLine, 'utf-8');
      console.warn(`Unmatched response for order ${response.m_orderId}`);
    } catch (error) {
      console.error('Failed to log unmatched response:', error);
    }
  }

  private getResponseTypeText(responseType: ResponseType): string {
    switch (responseType) {
      case ResponseType.Accept:
        return 'ACCEPT';
      case ResponseType.Reject:
        return 'REJECT';
      case ResponseType.Unknown:
      default:
        return 'UNKNOWN';
    }
  }

  public getTrackingStats(): {
    pendingOrders: number;
    oldestPendingOrder: { orderId: number; ageMs: number } | null;
  } {
    const now = Date.now();
    let oldestOrder: { orderId: number; ageMs: number } | null = null;

    for (const [orderId, sentTimestamp] of this.sentOrders.entries()) {
      const ageMs = now - sentTimestamp;
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
      if (now - sentTimestamp > maxAgeMs) {
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
      const ageMs = cleanupTimestamp - sentTimestamp;
      const logLine = `${new Date(cleanupTimestamp).toISOString()},${orderId},${sentTimestamp},${ageMs}\n`;

      if (!fs.existsSync(abandonedFile)) {
        fs.writeFileSync(abandonedFile, CSV_HEADERS.ABANDONED, 'utf-8');
      }

      fs.appendFileSync(abandonedFile, logLine, 'utf-8');
      console.warn(`Abandoned order ${orderId} after ${ageMs}ms`);
    } catch (error) {
      console.error('Failed to log abandoned order:', error);
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
                orderId: parseInt(orderIdStr!, 10),
                responseType: parseInt(responseTypeStr!, 10) as ResponseType,
                roundTripLatency: parseFloat(latencyStr!),
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
