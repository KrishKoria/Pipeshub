import { OrderManagement } from './order-management';
import {
  OrderRequest,
  OrderResponse,
  RequestType,
  ResponseType,
} from './types';
import { MILLISECONDS_PER_MINUTE } from './constants';
import { logError } from './utils';

/**
 * Main entry point for the Order Management System
 **/

async function main(): Promise<void> {
  console.log('=== Order Management System Demo ===');
  console.log('Initializing system...\n');

  const orderManager = new OrderManagement();

  try {
    await orderManager.initialize();

    console.log('System initialized successfully!\n');

    displaySystemStatus(orderManager);
    await demonstrateOrderFlow(orderManager);

    console.log('\nDemo complete. Shutting down system...');
    orderManager.shutdown();
    console.log('System shut down successfully.\n');

    console.log('=== Demo Summary ===');
    console.log('The Order Management System has demonstrated:');
    console.log('✓ Time-based trading window management');
    console.log('✓ Rate-limited order queue processing');
    console.log('✓ Order lifecycle management (new, modify, cancel)');
    console.log('✓ Response tracking with latency measurement');
    console.log('✓ Persistent logging to files');
    console.log('✓ System status monitoring');
    console.log('\nCheck the logs/ directory for detailed execution logs.');
  } catch (error) {
    logError('Failed to initialize or run system', error);
    orderManager.emergencyStop();
    process.exit(1);
  }
}

function displaySystemStatus(orderManager: OrderManagement): void {
  const status = orderManager.getSystemStatus();

  console.log('--- System Status ---');
  console.log(`Initialized: ${status.isInitialized}`);
  console.log(`Trading Active: ${status.isTradingActive}`);

  if (status.queueStats) {
    console.log(`Queue Length: ${status.queueStats.queueLength}`);
    console.log(
      `Orders This Second: ${status.queueStats.ordersThisSecond}/${status.queueStats.rateLimit}`
    );
    console.log(`Remaining Capacity: ${status.queueStats.remainingCapacity}`);
  }

  if (status.trackingStats) {
    console.log(`Pending Orders: ${status.trackingStats.pendingOrders}`);
    if (status.trackingStats.oldestPendingOrder) {
      console.log(
        `Oldest Pending: Order ${status.trackingStats.oldestPendingOrder.orderId} (${status.trackingStats.oldestPendingOrder.ageMs}ms ago)`
      );
    }
  }
  if (status.nextTradingEvent) {
    const eventTime = new Date(
      status.nextTradingEvent.eventTime
    ).toLocaleTimeString();
    const minutesUntil = Math.round(
      status.nextTradingEvent.timeUntilEvent / MILLISECONDS_PER_MINUTE
    );
    console.log(
      `Next Event: ${status.nextTradingEvent.eventType} at ${eventTime} (in ${minutesUntil} minutes)`
    );
  }

  console.log('');
}

async function demonstrateOrderFlow(
  orderManager: OrderManagement
): Promise<void> {
  console.log('--- Demonstrating Order Flow ---');

  const orders: OrderRequest[] = [
    {
      m_orderId: 1001,
      m_symbolId: 100,
      m_price: 150.5,
      m_qty: 100,
      m_side: 'B',
      requestType: RequestType.New,
    },
    {
      m_orderId: 1002,
      m_symbolId: 101,
      m_price: 75.25,
      m_qty: 200,
      m_side: 'S',
      requestType: RequestType.New,
    },
    {
      m_orderId: 1003,
      m_symbolId: 102,
      m_price: 200.0,
      m_qty: 50,
      m_side: 'B',
      requestType: RequestType.New,
    },
  ];

  console.log('Sending new orders...');
  for (const order of orders) {
    console.log(
      `  Order ${order.m_orderId}: ${order.m_side} ${order.m_qty} shares of symbol ${order.m_symbolId} @ $${order.m_price}`
    );
    orderManager.onData(order);
    await sleep(500);
  }

  console.log('\n--- Demonstrating Modify Operation ---');
  const modifyOrder: OrderRequest = {
    m_orderId: 1001,
    m_symbolId: 100,
    m_price: 155.0,
    m_qty: 150,
    m_side: 'B',
    requestType: RequestType.Modify,
  };

  console.log(
    `Modifying order ${modifyOrder.m_orderId}: new price $${modifyOrder.m_price}, new qty ${modifyOrder.m_qty}`
  );
  orderManager.onData(modifyOrder);

  console.log('\n--- Demonstrating Cancel Operation ---');
  const cancelOrder: OrderRequest = {
    m_orderId: 1002,
    m_symbolId: 101,
    m_price: 0,
    m_qty: 0,
    m_side: 'S',
    requestType: RequestType.Cancel,
  };

  console.log(`Canceling order ${cancelOrder.m_orderId}`);
  orderManager.onData(cancelOrder);

  console.log('\n--- Simulating Exchange Responses ---');
  await sleep(2000);

  const responses: OrderResponse[] = [
    {
      m_orderId: 1001,
      m_responseType: ResponseType.Accept,
    },
    {
      m_orderId: 1003,
      m_responseType: ResponseType.Accept,
    },
  ];

  for (const response of responses) {
    console.log(
      `Processing response for order ${response.m_orderId}: ${response.m_responseType === ResponseType.Accept ? 'ACCEPT' : 'REJECT'}`
    );
    orderManager.onData(response);
    await sleep(1000);
  }

  console.log('\nOrder flow demonstration complete!');
  await sleep(1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (require.main === module) {
  main().catch((error) => {
    logError('Application error', error);
    process.exit(1);
  });
}
