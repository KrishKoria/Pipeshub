import { ConfigManager } from './config-manager';
import { OrderRequest, QueuedOrder, RequestType } from './types';
import {
  QUEUE_PROCESSOR_INTERVAL,
  MILLISECONDS_PER_SECOND,
  QUEUE_NOT_FOUND_INDEX,
} from './constants';

export class RateLimiter {
  private configManager: ConfigManager;
  private orderQueue: QueuedOrder[] = [];
  private orderIndexMap: Map<number, number> = new Map(); // orderId -> queue index
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
    this.currentSecond = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
    this.startQueueProcessor();
  }

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
  private modifyQueuedOrder(
    orderId: number,
    newPrice: number,
    newQty: number
  ): boolean {
    const index = this.orderIndexMap.get(orderId);
    if (index !== undefined && this.orderQueue[index]) {
      this.orderQueue[index]!.m_price = newPrice;
      this.orderQueue[index]!.m_qty = newQty;
      return true;
    }
    return false;
  }

  private cancelQueuedOrder(orderId: number): boolean {
    const index = this.orderIndexMap.get(orderId);
    if (index !== undefined && this.orderQueue[index]) {
      this.removeOrderFromQueue(index);
      return true;
    }
    return false;
  }

  private removeOrderFromQueue(index: number): void {
    const removedOrder = this.orderQueue[index];
    if (!removedOrder) return;

    this.orderQueue.splice(index, 1);

    this.orderIndexMap.delete(removedOrder.m_orderId);

    this.updateIndexMapAfterRemoval(index);
  }

  private updateIndexMapAfterRemoval(removedIndex: number): void {
    for (let i = removedIndex; i < this.orderQueue.length; i++) {
      const order = this.orderQueue[i];
      if (order) {
        this.orderIndexMap.set(order.m_orderId, i);
      }
    }
  }
  private canSendImmediately(): boolean {
    const currentSecond = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
    const rateLimit = this.configManager.getRateLimit().ordersPerSecond;

    if (currentSecond !== this.currentSecond) {
      this.currentSecond = currentSecond;
      this.ordersThisSecond = 0;
    }

    return this.ordersThisSecond < rateLimit;
  }

  private queueOrder(order: OrderRequest): void {
    const queuedOrder: QueuedOrder = {
      ...order,
      queuedAt: Date.now(),
      originalTimestamp: order.timestamp || Date.now(),
    };

    this.orderQueue.push(queuedOrder);
    this.orderIndexMap.set(queuedOrder.m_orderId, this.orderQueue.length - 1);
  }

  private startQueueProcessor(): void {
    this.queueProcessor = setInterval(() => {
      this.processQueue();
    }, QUEUE_PROCESSOR_INTERVAL);
  }

  private processQueue(): void {
    if (this.orderQueue.length === 0) {
      return;
    }

    let processedCount = 0;
    while (this.orderQueue.length > 0 && this.canSendImmediately()) {
      const order = this.orderQueue.shift();
      if (order) {
        this.orderIndexMap.delete(order.m_orderId);

        this.updateIndexMapAfterShift();

        const orderToSend: OrderRequest = this.createOrderToSend(order);
        this.sendOrderNow(orderToSend);
        processedCount++;
      }
    }
  }

  private updateIndexMapAfterShift(): void {
    for (let i = 0; i < this.orderQueue.length; i++) {
      const order = this.orderQueue[i];
      if (order) {
        this.orderIndexMap.set(order.m_orderId, i);
      }
    }
  }
  private sendOrderNow(order: OrderRequest): void {
    this.ordersThisSecond++;
    this.onSendCallback(order);
  }

  private createOrderToSend(queuedOrder: QueuedOrder): OrderRequest {
    return {
      m_symbolId: queuedOrder.m_symbolId,
      m_price: queuedOrder.m_price,
      m_qty: queuedOrder.m_qty,
      m_side: queuedOrder.m_side,
      m_orderId: queuedOrder.m_orderId,
      requestType: queuedOrder.requestType || RequestType.New,
      timestamp: queuedOrder.originalTimestamp,
    };
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
    this.orderIndexMap.clear();
    return clearedCount;
  }

  public isOrderInQueue(orderId: number): boolean {
    return this.orderIndexMap.has(orderId);
  }

  public getOrderQueuePosition(orderId: number): number {
    const index = this.orderIndexMap.get(orderId);
    return index !== undefined ? index : QUEUE_NOT_FOUND_INDEX;
  }

  public stop(): void {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = null;
    }
  }
}
