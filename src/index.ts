import { OrderManagement } from './order-management';
import {
  OrderRequest,
  OrderResponse,
  RequestType,
  ResponseType,
} from './types';

/**
 * Main entry point for the Order Management System
 **/

async function main(): Promise<void> {
  console.log('=== Order Management System ===');
  console.log('Initializing system...\n');

  const orderManager = new OrderManagement();

  try {
    await orderManager.initialize();

    console.log('System initialized successfully!\n');

    displaySystemStatus(orderManager);
    await demonstrateOrderFlow(orderManager);

    console.log('\nSystem running... (Press Ctrl+C to stop)');
    console.log('Starting interactive CLI for manual testing...\n');

    setupGracefulShutdown(orderManager);

    setupCLI(orderManager);

    const statusInterval = setInterval(() => {
      console.log('\n--- System Status Update ---');
      displaySystemStatus(orderManager);
    }, 30000);

    process.on('SIGINT', () => {
      clearInterval(statusInterval);
    });
  } catch (error) {
    console.error('Failed to initialize system:', error);
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
      status.nextTradingEvent.timeUntilEvent / 60000
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

  for (const order of orders) {
    console.log(
      `Sending order ${order.m_orderId}: ${order.m_side} ${order.m_qty} shares of symbol ${order.m_symbolId} @ $${order.m_price}`
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

  console.log('\nOrder flow demonstration complete!\n');
}

function setupGracefulShutdown(orderManager: OrderManagement): void {
  const shutdown = () => {
    console.log('\n\nShutting down system...');
    orderManager.shutdown();
    console.log('Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGUSR2', shutdown);

  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    orderManager.emergencyStop();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    orderManager.emergencyStop();
    process.exit(1);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Command line interface for testing
 */
function setupCLI(orderManager: OrderManagement): void {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n--- CLI Commands ---');
  console.log('status - Show system status');
  console.log('order <id> <symbol> <price> <qty> <side> - Send new order');
  console.log('modify <id> <price> <qty> - Modify order');
  console.log('cancel <id> - Cancel order');
  console.log('response <id> <accept|reject> - Simulate exchange response');
  console.log('emergency - Emergency stop');
  console.log('quit - Shutdown system');
  console.log('');

  const processCommand = (input: string) => {
    const args = input.trim().split(' ');
    const command = args[0]?.toLowerCase();

    try {
      switch (command) {
        case 'status':
          displaySystemStatus(orderManager);
          break;

        case 'order':
          if (args.length !== 6) {
            console.log('Usage: order <id> <symbol> <price> <qty> <side>');
            break;
          }
          const newOrder: OrderRequest = {
            m_orderId: parseInt(args[1]!),
            m_symbolId: parseInt(args[2]!),
            m_price: parseFloat(args[3]!),
            m_qty: parseInt(args[4]!),
            m_side: args[5]! as 'B' | 'S',
            requestType: RequestType.New,
          };
          orderManager.onData(newOrder);
          console.log(`Order ${newOrder.m_orderId} sent`);
          break;

        case 'modify':
          if (args.length !== 4) {
            console.log('Usage: modify <id> <price> <qty>');
            break;
          }
          const modOrder: OrderRequest = {
            m_orderId: parseInt(args[1]!),
            m_symbolId: 0,
            m_price: parseFloat(args[2]!),
            m_qty: parseInt(args[3]!),
            m_side: 'B',
            requestType: RequestType.Modify,
          };
          orderManager.onData(modOrder);
          console.log(`Order ${modOrder.m_orderId} modified`);
          break;

        case 'cancel':
          if (args.length !== 2) {
            console.log('Usage: cancel <id>');
            break;
          }
          const cancelOrder: OrderRequest = {
            m_orderId: parseInt(args[1]!),
            m_symbolId: 0,
            m_price: 0,
            m_qty: 0,
            m_side: 'B',
            requestType: RequestType.Cancel,
          };
          orderManager.onData(cancelOrder);
          console.log(`Order ${cancelOrder.m_orderId} cancelled`);
          break;

        case 'response':
          if (args.length !== 3) {
            console.log('Usage: response <id> <accept|reject>');
            break;
          }
          const response: OrderResponse = {
            m_orderId: parseInt(args[1]!),
            m_responseType:
              args[2]!.toLowerCase() === 'accept'
                ? ResponseType.Accept
                : ResponseType.Reject,
          };
          orderManager.onData(response);
          console.log(`Response for order ${response.m_orderId} processed`);
          break;

        case 'emergency':
          orderManager.emergencyStop();
          return;

        case 'quit':
          orderManager.shutdown();
          rl.close();
          return;

        case '':
          break;

        default:
          console.log('Unknown command. Type "quit" to exit.');
      }
    } catch (error) {
      console.error('Command error:', error);
    }

    rl.prompt();
  };

  rl.on('line', processCommand);
  rl.on('close', () => {
    console.log('CLI closed');
    process.exit(0);
  });

  rl.prompt();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Application error:', error);
    process.exit(1);
  });
}
