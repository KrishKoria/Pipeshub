import { ConfigManager } from './config-manager';
import { TimeManager } from './time-manager';
import { RateLimiter } from './rate-limiter';
import { MetricsLogger } from './metrics-logger';
import {
  OrderRequest,
  OrderResponse,
  RequestType,
  Logon,
  Logout,
  SystemStatus,
} from './types';
import { SESSION_CHECK_INTERVAL } from './constants';
import { getResponseTypeText, logError, validateOrderRequest } from './utils';

export class OrderManagement {
  private configManager: ConfigManager;
  private timeManager: TimeManager;
  private rateLimiter: RateLimiter;
  private metricsLogger: MetricsLogger;
  private isInitialized: boolean = false;
  private sessionCheckInterval: NodeJS.Timeout | null = null;

  constructor(configPath?: string, logDirectory?: string) {
    this.configManager = new ConfigManager(configPath);
    this.timeManager = new TimeManager(this.configManager);
    this.rateLimiter = new RateLimiter(
      this.configManager,
      this.handleSendToExchange.bind(this)
    );
    this.metricsLogger = new MetricsLogger(logDirectory);
  }

  public async initialize(): Promise<void> {
    try {
      this.configManager.loadConfig();

      this.startSessionManagement();

      this.isInitialized = true;
      console.log('OrderManagement system initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize OrderManagement: ${error}`);
    }
  }

  public onData(request: OrderRequest): void;
  public onData(response: OrderResponse): void;
  public onData(data: OrderRequest | OrderResponse): void {
    if (!this.isInitialized) {
      throw new Error(
        'OrderManagement not initialized. Call initialize() first.'
      );
    }

    if (this.isOrderRequest(data)) {
      this.processOrderRequest(data);
    } else {
      this.processOrderResponse(data);
    }
  }

  private isOrderRequest(
    data: OrderRequest | OrderResponse
  ): data is OrderRequest {
    return 'm_symbolId' in data && 'm_side' in data;
  }
  private processOrderRequest(request: OrderRequest): void {
    try {
      validateOrderRequest(request);

      if (!this.timeManager.isTradingActive()) {
        this.rejectOrder(
          request,
          'Trading not active - outside trading hours or not logged in'
        );
        return;
      }

      const timestampedRequest: OrderRequest = {
        ...request,
        timestamp: request.timestamp || Date.now(),
        requestType: request.requestType || RequestType.New,
      };

      const wasProcessedImmediately =
        this.rateLimiter.processOrder(timestampedRequest);

      if (wasProcessedImmediately) {
        console.log(`Order ${request.m_orderId} processed immediately`);
      } else {
        console.log(`Order ${request.m_orderId} queued for rate limiting`);
      }
    } catch (error) {
      this.rejectOrder(request, `Order processing failed: ${error}`);
    }
  }
  private processOrderResponse(response: OrderResponse): void {
    try {
      const metrics = this.metricsLogger.recordOrderResponse(response);
      if (metrics) {
        console.log(
          `Order ${response.m_orderId} response: ${getResponseTypeText(response.m_responseType)} (${metrics.roundTripLatency}ms)`
        );
      } else {
        console.warn(
          `Received unmatched response for order ${response.m_orderId}`
        );
      }
    } catch (error) {
      logError('Failed to process order response', error);
    }
  }

  public send(request: OrderRequest): void {
    console.log(
      `[EXCHANGE] Sending order ${request.m_orderId}: ${request.m_side} ${request.m_qty} @ ${request.m_price}`
    );
    this.metricsLogger.recordOrderSent(request.m_orderId, request.timestamp);
  }

  public sendLogon(): void {
    const credentials = this.configManager.getCredentials();
    const logonMessage: Logon = {
      username: credentials.username,
      password: credentials.password,
    };

    console.log(`[EXCHANGE] Sending logon for user: ${logonMessage.username}`);

    this.timeManager.setLoggedIn(true);
    console.log('Successfully logged in to exchange');
  }

  public sendLogout(): void {
    const credentials = this.configManager.getCredentials();
    const logoutMessage: Logout = {
      username: credentials.username,
    };

    console.log(
      `[EXCHANGE] Sending logout for user: ${logoutMessage.username}`
    );

    this.timeManager.setLoggedIn(false);
    console.log('Successfully logged out from exchange');
  }

  private handleSendToExchange(order: OrderRequest): void {
    try {
      if (!this.timeManager.isTradingActive()) {
        this.rejectOrder(
          order,
          'Trading became inactive while order was queued'
        );
        return;
      }
      this.send(order);
    } catch (error) {
      logError(`Failed to send order ${order.m_orderId}`, error);
    }
  }
  private startSessionManagement(): void {
    this.sessionCheckInterval = setInterval(() => {
      this.checkAndUpdateSession();
    }, SESSION_CHECK_INTERVAL);

    this.checkAndUpdateSession();
  }

  private checkAndUpdateSession(): void {
    try {
      const sessionState = this.timeManager.getTradingSessionState();

      if (sessionState.shouldLogon) {
        console.log('Trading window opened - logging in');
        this.sendLogon();
      } else if (sessionState.shouldLogout) {
        console.log('Trading window closed - logging out');
        this.sendLogout();
      }
    } catch (error) {
      logError('Session management error', error);
    }
  }

  private rejectOrder(request: OrderRequest, reason: string): void {
    console.warn(`Order ${request.m_orderId} rejected: ${reason}`);
  }

  public getSystemStatus(): SystemStatus {
    if (!this.isInitialized) {
      return {
        isInitialized: false,
        isTradingActive: false,
        queueStats: null,
        trackingStats: null,
        nextTradingEvent: null,
      };
    }

    return {
      isInitialized: this.isInitialized,
      isTradingActive: this.timeManager.isTradingActive(),
      queueStats: this.rateLimiter.getQueueStats(),
      trackingStats: this.metricsLogger.getTrackingStats(),
      nextTradingEvent: this.timeManager.getNextTradingEvent(),
    };
  }

  public shutdown(): void {
    console.log('Shutting down OrderManagement system...');

    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }

    this.rateLimiter.stop();

    this.metricsLogger.close();

    if (this.timeManager.isTradingActive()) {
      this.sendLogout();
    }

    this.isInitialized = false;
    console.log('OrderManagement system shutdown complete');
  }

  public emergencyStop(): void {
    console.warn('EMERGENCY STOP initiated');

    const clearedOrders = this.rateLimiter.clearQueue();
    console.log(`Cleared ${clearedOrders} queued orders`);

    const cleanedTracking = this.metricsLogger.cleanupOldOrders(0);
    console.log(`Cleaned up ${cleanedTracking} tracked orders`);

    this.shutdown();
  }
}
