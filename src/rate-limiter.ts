import { ConfigManager } from './config-manager';
import { OrderRequest, QueuedOrder, RequestType } from './types';

/**
 * RateLimiter handles order queue management and rate limiting
 **/
export class RateLimiter {
  private configManager: ConfigManager;
  private orderQueue: QueuedOrder[] = [];
  private ordersThisSecond: number = 0;
  private currentSecond: number = 0;
  private queueProcessor: NodeJS.Timeout | null = null;
  private readonly onSendCallback: (order: OrderRequest) => void;

  constructor(
    configManager: ConfigManager,
    onSendCallback: (order: OrderRequest) => void
  ) {
    this.configManager = configManager;
    this.onSendCallback = onSendCallback;
    this.currentSecond = Math.floor(Date.now() / 1000);
    this.startQueueProcessor();
  }

  /**
   * Process incoming order request with rate limiting and queue management
   * @returns true if processed immediately, false if queued
   **/
  public processOrder(request: OrderRequest): boolean {
    const now = Date.now();
    const requestWithTimestamp = {
      ...request,
      timestamp: now,
      requestType: request.requestType || RequestType.New,
    };

    if (this.handleQueueOperations(requestWithTimestamp)) {
      return true;
    }

    if (this.canSendImmediately()) {
      this.sendOrderNow(requestWithTimestamp);
      return true;
    } else {
      this.queueOrder(requestWithTimestamp);
      return false;
    }
  }

  /**
   * Handle modify and cancel operations on queued orders
   **/
  private handleQueueOperations(request: OrderRequest): boolean {
    const orderId = request.m_orderId;

    switch (request.requestType) {
      case RequestType.Modify:
        return this.modifyQueuedOrder(orderId, request.m_price, request.m_qty);

      case RequestType.Cancel:
        return this.cancelQueuedOrder(orderId);

      case RequestType.New:
      case RequestType.Unknown:
      default:
        return false;
    }
  }

  /**
   * Modify an existing order in the queue
   **/
  private modifyQueuedOrder(
    orderId: number,
    newPrice: number,
    newQty: number
  ): boolean {
    const queuedOrderIndex = this.orderQueue.findIndex(
      (order) => order.m_orderId === orderId
    );

    if (queuedOrderIndex !== -1) {
      this.orderQueue[queuedOrderIndex]!.m_price = newPrice;
      this.orderQueue[queuedOrderIndex]!.m_qty = newQty;
      return true;
    }

    return false;
  }

  /**
   * Cancel an existing order in the queue
   **/
  private cancelQueuedOrder(orderId: number): boolean {
    const queuedOrderIndex = this.orderQueue.findIndex(
      (order) => order.m_orderId === orderId
    );

    if (queuedOrderIndex !== -1) {
      this.orderQueue.splice(queuedOrderIndex, 1);
      return true;
    }

    return false;
  }

  private canSendImmediately(): boolean {
    const currentSecond = Math.floor(Date.now() / 1000);
    const rateLimit = this.configManager.getRateLimit().ordersPerSecond;

    if (currentSecond !== this.currentSecond) {
      this.currentSecond = currentSecond;
      this.ordersThisSecond = 0;
    }

    return this.ordersThisSecond < rateLimit;
  }

  private sendOrderNow(order: OrderRequest): void {
    this.ordersThisSecond++;
    this.onSendCallback(order);
  }

  private queueOrder(order: OrderRequest): void {
    const queuedOrder: QueuedOrder = {
      ...order,
      queuedAt: Date.now(),
      originalTimestamp: order.timestamp || Date.now(),
    };

    this.orderQueue.push(queuedOrder);
  }

  /**
   * Start the queue processor that runs every 100ms
   **/
  private startQueueProcessor(): void {
    this.queueProcessor = setInterval(() => {
      this.processQueue();
    }, 100);
  }

  private processQueue(): void {
    if (this.orderQueue.length === 0) {
      return;
    }

    while (this.orderQueue.length > 0 && this.canSendImmediately()) {
      const order = this.orderQueue.shift();
      if (order) {
        const orderToSend: OrderRequest = {
          m_symbolId: order.m_symbolId,
          m_price: order.m_price,
          m_qty: order.m_qty,
          m_side: order.m_side,
          m_orderId: order.m_orderId,
          requestType: order.requestType || RequestType.New,
          timestamp: order.originalTimestamp,
        };

        this.sendOrderNow(orderToSend);
      }
    }
  }

  public getQueueStats(): {
    queueLength: number;
    ordersThisSecond: number;
    rateLimit: number;
    remainingCapacity: number;
  } {
    const rateLimit = this.configManager.getRateLimit().ordersPerSecond;
    return {
      queueLength: this.orderQueue.length,
      ordersThisSecond: this.ordersThisSecond,
      rateLimit,
      remainingCapacity: Math.max(0, rateLimit - this.ordersThisSecond),
    };
  }

  public getQueuedOrders(): ReadonlyArray<QueuedOrder> {
    return [...this.orderQueue];
  }

  public clearQueue(): number {
    const clearedCount = this.orderQueue.length;
    this.orderQueue = [];
    return clearedCount;
  }

  /**
   * Stop the queue processor
   */
  public stop(): void {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = null;
    }
  }

  public isOrderInQueue(orderId: number): boolean {
    return this.orderQueue.some((order) => order.m_orderId === orderId);
  }

  public getOrderQueuePosition(orderId: number): number {
    return this.orderQueue.findIndex((order) => order.m_orderId === orderId);
  }
}
