import { OrderManagement } from '../src/order-management';
import { OrderRequest, RequestType } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

describe('Rate Limiting Integration Tests', () => {
  let orderManager: OrderManagement;
  let testConfigPath: string;
  let testLogDir: string;

  beforeEach(async () => {
    testConfigPath = path.join(__dirname, 'test-rate-limit-config.json');
    testLogDir = path.join(__dirname, 'test-logs');

    const testConfig = {
      tradingHours: {
        start: '00:00',
        end: '23:59',
        timezone: 'UTC',
      },
      rateLimit: {
        ordersPerSecond: 2,
      },
      credentials: {
        username: 'test_trader',
        password: 'test_password',
      },
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true });
    }
    orderManager = new OrderManagement(testConfigPath, testLogDir, true);
    await orderManager.initialize();
  });

  afterEach(() => {
    if (orderManager) {
      orderManager.shutdown();
    }

    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }

    if (fs.existsSync(testLogDir)) {
      const files = fs.readdirSync(testLogDir);
      files.forEach((file) => {
        fs.unlinkSync(path.join(testLogDir, file));
      });
      fs.rmdirSync(testLogDir);
    }
  });

  describe('Rate limiting demonstration', () => {
    it('should demonstrate rate limiting with immediate and queued orders', async () => {
      const orders: OrderRequest[] = [];

      for (let i = 1; i <= 5; i++) {
        orders.push({
          m_orderId: i,
          m_symbolId: 100 + i,
          m_price: 50.0 + i,
          m_qty: 100,
          m_side: i % 2 === 0 ? 'S' : 'B',
          requestType: RequestType.New,
        });
      }

      const sentOrders: number[] = [];
      const originalSend = orderManager.send.bind(orderManager);
      orderManager.send = (request: OrderRequest) => {
        sentOrders.push(request.m_orderId);
        originalSend(request);
      };

      orders.forEach((order) => {
        orderManager.onData(order);
      });

      const initialStatus = orderManager.getSystemStatus();

      expect(sentOrders.length).toBe(2);
      expect(initialStatus.queueStats?.queueLength).toBe(3);
      expect(initialStatus.queueStats?.ordersThisSecond).toBe(2);
      expect(initialStatus.queueStats?.remainingCapacity).toBe(0);

      await new Promise((resolve) => setTimeout(resolve, 1200));

      const finalStatus = orderManager.getSystemStatus();

      expect(sentOrders.length).toBeGreaterThan(2);
      expect(finalStatus.queueStats?.queueLength).toBeLessThan(3);
    });
    it('should demonstrate modify and cancel operations on queued orders', async () => {
      const testConfigLowRate = {
        tradingHours: {
          start: '00:00',
          end: '23:59',
          timezone: 'UTC',
        },
        rateLimit: {
          ordersPerSecond: 1,
        },
        credentials: {
          username: 'test_trader',
          password: 'test_password',
        },
      };

      const lowRateConfigPath = path.join(
        __dirname,
        'test-low-rate-config.json'
      );
      fs.writeFileSync(
        lowRateConfigPath,
        JSON.stringify(testConfigLowRate, null, 2)
      );
      orderManager.shutdown();
      orderManager = new OrderManagement(lowRateConfigPath, testLogDir, true);
      await orderManager.initialize();

      const orders: OrderRequest[] = [
        {
          m_orderId: 1001,
          m_symbolId: 100,
          m_price: 50.0,
          m_qty: 100,
          m_side: 'B',
          requestType: RequestType.New,
        },
        {
          m_orderId: 1002,
          m_symbolId: 101,
          m_price: 60.0,
          m_qty: 200,
          m_side: 'S',
          requestType: RequestType.New,
        },
        {
          m_orderId: 1003,
          m_symbolId: 102,
          m_price: 70.0,
          m_qty: 150,
          m_side: 'B',
          requestType: RequestType.New,
        },
      ];

      orders.forEach((order) => {
        orderManager.onData(order);
      });

      let status = orderManager.getSystemStatus();
      expect(status.queueStats?.queueLength).toBe(2);

      const modifyOrder: OrderRequest = {
        m_orderId: 1002,
        m_symbolId: 101,
        m_price: 65.0,
        m_qty: 250,
        m_side: 'S',
        requestType: RequestType.Modify,
      };

      orderManager.onData(modifyOrder);

      status = orderManager.getSystemStatus();
      expect(status.queueStats?.queueLength).toBe(2);

      const cancelOrder: OrderRequest = {
        m_orderId: 1003,
        m_symbolId: 102,
        m_price: 0,
        m_qty: 0,
        m_side: 'B',
        requestType: RequestType.Cancel,
      };

      orderManager.onData(cancelOrder);

      status = orderManager.getSystemStatus();
      expect(status.queueStats?.queueLength).toBe(1);
      if (fs.existsSync(lowRateConfigPath)) {
        fs.unlinkSync(lowRateConfigPath);
      }
    });
    it('should demonstrate system behavior under sustained load', async () => {
      const sentOrders: number[] = [];
      const originalSend = orderManager.send.bind(orderManager);
      orderManager.send = (request: OrderRequest) => {
        sentOrders.push(request.m_orderId);
        originalSend(request);
      };

      const totalOrders = 6;
      const batchSize = 2;

      for (let batch = 0; batch < Math.ceil(totalOrders / batchSize); batch++) {
        for (
          let i = 0;
          i < batchSize && batch * batchSize + i < totalOrders;
          i++
        ) {
          const orderId = batch * batchSize + i + 1;
          const order: OrderRequest = {
            m_orderId: orderId,
            m_symbolId: 100,
            m_price: 50.0 + orderId,
            m_qty: 100,
            m_side: orderId % 2 === 0 ? 'S' : 'B',
            requestType: RequestType.New,
          };

          orderManager.onData(order);
        }

        const status = orderManager.getSystemStatus();
        expect(status.queueStats?.rateLimit).toBe(2);

        if (batch < Math.ceil(totalOrders / batchSize) - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const finalStatus = orderManager.getSystemStatus();

      expect(sentOrders.length).toBeGreaterThan(totalOrders * 0.7);
      expect(finalStatus.queueStats?.queueLength).toBeLessThanOrEqual(1);
    }, 8000);
  });
});
