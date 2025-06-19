import { RateLimiter } from '../src/rate-limiter';
import { ConfigManager } from '../src/config-manager';
import { OrderRequest, RequestType } from '../src/types';

class MockConfigManager extends ConfigManager {
  private mockConfig = {
    tradingHours: {
      start: '10:00',
      end: '15:30',
      timezone: 'Asia/Kolkata',
    },
    rateLimit: {
      ordersPerSecond: 2,
    },
    credentials: {
      username: 'test',
      password: 'test',
    },
  };

  public loadConfig() {
    return this.mockConfig;
  }

  public getConfig() {
    return this.mockConfig;
  }

  public getTradingHours() {
    return this.mockConfig.tradingHours;
  }

  public getRateLimit() {
    return this.mockConfig.rateLimit;
  }

  public getCredentials() {
    return this.mockConfig.credentials;
  }

  public setRateLimit(ordersPerSecond: number) {
    this.mockConfig.rateLimit.ordersPerSecond = ordersPerSecond;
  }
}

describe('RateLimiter', () => {
  let mockConfigManager: MockConfigManager;
  let rateLimiter: RateLimiter;
  let sentOrders: OrderRequest[] = [];

  const mockSendCallback = (order: OrderRequest) => {
    sentOrders.push(order);
  };

  beforeEach(() => {
    mockConfigManager = new MockConfigManager();
    sentOrders = [];
    rateLimiter = new RateLimiter(mockConfigManager, mockSendCallback);
  });

  afterEach(() => {
    rateLimiter.stop();
  });

  afterAll(() => {
    // Ensure all timers are cleared
    jest.clearAllTimers();
  });

  describe('rate limiting', () => {
    it('should send orders immediately when under rate limit', () => {
      const order1: OrderRequest = {
        m_orderId: 1,
        m_symbolId: 100,
        m_price: 50.0,
        m_qty: 100,
        m_side: 'B',
        requestType: RequestType.New,
      };

      const order2: OrderRequest = {
        m_orderId: 2,
        m_symbolId: 101,
        m_price: 60.0,
        m_qty: 200,
        m_side: 'S',
        requestType: RequestType.New,
      };

      const result1 = rateLimiter.processOrder(order1);
      const result2 = rateLimiter.processOrder(order2);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(sentOrders).toHaveLength(2);
      expect(sentOrders[0]?.m_orderId).toBe(1);
      expect(sentOrders[1]?.m_orderId).toBe(2);
    });

    it('should queue orders when rate limit is exceeded', () => {
      const orders: OrderRequest[] = [];
      for (let i = 1; i <= 5; i++) {
        orders.push({
          m_orderId: i,
          m_symbolId: 100,
          m_price: 50.0,
          m_qty: 100,
          m_side: 'B',
          requestType: RequestType.New,
        });
      }

      const results = orders.map((order) => rateLimiter.processOrder(order));

      expect(results[0]).toBe(true);
      expect(results[1]).toBe(true);
      expect(results[2]).toBe(false);
      expect(results[3]).toBe(false);
      expect(results[4]).toBe(false);

      expect(sentOrders).toHaveLength(2);

      const queueStats = rateLimiter.getQueueStats();
      expect(queueStats.queueLength).toBe(3);
      expect(queueStats.ordersThisSecond).toBe(2);
      expect(queueStats.remainingCapacity).toBe(0);
    });
  });

  describe('queue operations', () => {
    beforeEach(() => {
      mockConfigManager.setRateLimit(1);
      rateLimiter = new RateLimiter(mockConfigManager, mockSendCallback);

      for (let i = 1; i <= 3; i++) {
        rateLimiter.processOrder({
          m_orderId: i,
          m_symbolId: 100,
          m_price: 50.0,
          m_qty: 100,
          m_side: 'B',
          requestType: RequestType.New,
        });
      }

      sentOrders = [];
    });

    it('should modify queued orders correctly', () => {
      const modifyOrder: OrderRequest = {
        m_orderId: 2,
        m_symbolId: 100,
        m_price: 75.0,
        m_qty: 150,
        m_side: 'B',
        requestType: RequestType.Modify,
      };

      const result = rateLimiter.processOrder(modifyOrder);
      expect(result).toBe(true);

      const queuedOrders = rateLimiter.getQueuedOrders();
      const modifiedOrder = queuedOrders.find((order) => order.m_orderId === 2);

      expect(modifiedOrder).toBeDefined();
      expect(modifiedOrder?.m_price).toBe(75.0);
      expect(modifiedOrder?.m_qty).toBe(150);
    });

    it('should cancel queued orders correctly', () => {
      const initialQueueLength = rateLimiter.getQueueStats().queueLength;

      const cancelOrder: OrderRequest = {
        m_orderId: 2,
        m_symbolId: 100,
        m_price: 0,
        m_qty: 0,
        m_side: 'B',
        requestType: RequestType.Cancel,
      };

      const result = rateLimiter.processOrder(cancelOrder);
      expect(result).toBe(true);
      const newQueueLength = rateLimiter.getQueueStats().queueLength;
      expect(newQueueLength).toBe(initialQueueLength - 1);

      const queuedOrders = rateLimiter.getQueuedOrders();
      const canceledOrder = queuedOrders.find((order) => order.m_orderId === 2);
      expect(canceledOrder).toBeUndefined();
    });

    it('should return false for modify/cancel of non-existent orders', () => {
      const modifyOrder: OrderRequest = {
        m_orderId: 999,
        m_symbolId: 100,
        m_price: 75.0,
        m_qty: 150,
        m_side: 'B',
        requestType: RequestType.Modify,
      };

      const result = rateLimiter.processOrder(modifyOrder);
      expect(result).toBe(false);
    });
  });

  describe('queue statistics', () => {
    it('should provide accurate queue statistics', () => {
      mockConfigManager.setRateLimit(1);
      rateLimiter = new RateLimiter(mockConfigManager, mockSendCallback);

      for (let i = 1; i <= 3; i++) {
        rateLimiter.processOrder({
          m_orderId: i,
          m_symbolId: 100,
          m_price: 50.0,
          m_qty: 100,
          m_side: 'B',
          requestType: RequestType.New,
        });
      }

      const stats = rateLimiter.getQueueStats();
      expect(stats.queueLength).toBe(2);
      expect(stats.ordersThisSecond).toBe(1);
      expect(stats.rateLimit).toBe(1);
      expect(stats.remainingCapacity).toBe(0);
    });
  });

  describe('order tracking', () => {
    it('should track order presence in queue', () => {
      mockConfigManager.setRateLimit(1);
      rateLimiter = new RateLimiter(mockConfigManager, mockSendCallback);

      rateLimiter.processOrder({
        m_orderId: 1,
        m_symbolId: 100,
        m_price: 50.0,
        m_qty: 100,
        m_side: 'B',
        requestType: RequestType.New,
      });

      rateLimiter.processOrder({
        m_orderId: 2,
        m_symbolId: 100,
        m_price: 50.0,
        m_qty: 100,
        m_side: 'B',
        requestType: RequestType.New,
      });

      expect(rateLimiter.isOrderInQueue(1)).toBe(false);
      expect(rateLimiter.isOrderInQueue(2)).toBe(true);
      expect(rateLimiter.isOrderInQueue(999)).toBe(false);

      expect(rateLimiter.getOrderQueuePosition(2)).toBe(0);
      expect(rateLimiter.getOrderQueuePosition(999)).toBe(-1);
    });
  });

  describe('queue management', () => {
    it('should clear queue completely', () => {
      mockConfigManager.setRateLimit(1);
      rateLimiter = new RateLimiter(mockConfigManager, mockSendCallback);

      for (let i = 1; i <= 5; i++) {
        rateLimiter.processOrder({
          m_orderId: i,
          m_symbolId: 100,
          m_price: 50.0,
          m_qty: 100,
          m_side: 'B',
          requestType: RequestType.New,
        });
      }

      const clearedCount = rateLimiter.clearQueue();
      expect(clearedCount).toBe(4);
      expect(rateLimiter.getQueueStats().queueLength).toBe(0);
    });
  });
});
