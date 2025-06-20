import { validateOrderRequest } from '../src/utils';
import { OrderRequest, RequestType } from '../src/types';

describe('validateOrderRequest', () => {
  const validNewOrder: OrderRequest = {
    m_orderId: 1,
    m_symbolId: 100,
    m_price: 50.0,
    m_qty: 100,
    m_side: 'B',
    requestType: RequestType.New,
  };

  describe('New orders', () => {
    it('should accept valid new orders', () => {
      expect(() => validateOrderRequest(validNewOrder)).not.toThrow();
    });

    it('should reject orders with zero price', () => {
      const invalidOrder = { ...validNewOrder, m_price: 0 };
      expect(() => validateOrderRequest(invalidOrder)).toThrow(
        'Invalid or missing price'
      );
    });

    it('should reject orders with zero quantity', () => {
      const invalidOrder = { ...validNewOrder, m_qty: 0 };
      expect(() => validateOrderRequest(invalidOrder)).toThrow(
        'Invalid or missing quantity'
      );
    });

    it('should reject orders with invalid order ID', () => {
      const invalidOrder = { ...validNewOrder, m_orderId: 0 };
      expect(() => validateOrderRequest(invalidOrder)).toThrow(
        'Invalid or missing order ID'
      );
    });

    it('should reject orders with invalid symbol ID', () => {
      const invalidOrder = { ...validNewOrder, m_symbolId: 0 };
      expect(() => validateOrderRequest(invalidOrder)).toThrow(
        'Invalid or missing symbol ID'
      );
    });

    it('should reject orders with invalid side', () => {
      const invalidOrder = { ...validNewOrder, m_side: 'X' as any };
      expect(() => validateOrderRequest(invalidOrder)).toThrow(
        'Invalid side - must be B (Buy) or S (Sell)'
      );
    });
  });

  describe('Cancel orders', () => {
    it('should accept cancel orders with zero price and quantity', () => {
      const cancelOrder: OrderRequest = {
        m_orderId: 1,
        m_symbolId: 100,
        m_price: 0,
        m_qty: 0,
        m_side: 'B',
        requestType: RequestType.Cancel,
      };

      expect(() => validateOrderRequest(cancelOrder)).not.toThrow();
    });

    it('should accept cancel orders with non-zero price and quantity', () => {
      const cancelOrder: OrderRequest = {
        m_orderId: 1,
        m_symbolId: 100,
        m_price: 50.0,
        m_qty: 100,
        m_side: 'B',
        requestType: RequestType.Cancel,
      };

      expect(() => validateOrderRequest(cancelOrder)).not.toThrow();
    });
    it('should still validate order ID and symbol ID for cancel orders', () => {
      const invalidCancelOrder: OrderRequest = {
        m_orderId: 0,
        m_symbolId: 100,
        m_price: 0,
        m_qty: 0,
        m_side: 'B',
        requestType: RequestType.Cancel,
      };

      expect(() => validateOrderRequest(invalidCancelOrder)).toThrow(
        'Invalid or missing order ID'
      );
    });
  });

  describe('Modify orders', () => {
    it('should reject modify orders with zero price', () => {
      const modifyOrder: OrderRequest = {
        m_orderId: 1,
        m_symbolId: 100,
        m_price: 0,
        m_qty: 100,
        m_side: 'B',
        requestType: RequestType.Modify,
      };

      expect(() => validateOrderRequest(modifyOrder)).toThrow(
        'Invalid or missing price'
      );
    });

    it('should reject modify orders with zero quantity', () => {
      const modifyOrder: OrderRequest = {
        m_orderId: 1,
        m_symbolId: 100,
        m_price: 50.0,
        m_qty: 0,
        m_side: 'B',
        requestType: RequestType.Modify,
      };

      expect(() => validateOrderRequest(modifyOrder)).toThrow(
        'Invalid or missing quantity'
      );
    });

    it('should accept valid modify orders', () => {
      const modifyOrder: OrderRequest = {
        m_orderId: 1,
        m_symbolId: 100,
        m_price: 75.0,
        m_qty: 150,
        m_side: 'B',
        requestType: RequestType.Modify,
      };

      expect(() => validateOrderRequest(modifyOrder)).not.toThrow();
    });
  });
});
