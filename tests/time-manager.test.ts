import { TimeManager } from '../src/time-manager';
import { ConfigManager } from '../src/config-manager';

class MockConfigManager extends ConfigManager {
  private mockConfig = {
    tradingHours: {
      start: '10:00',
      end: '15:30',
      timezone: 'Asia/Kolkata',
    },
    rateLimit: {
      ordersPerSecond: 100,
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

  public setTradingHours(
    start: string,
    end: string,
    timezone: string = 'Asia/Kolkata'
  ) {
    this.mockConfig.tradingHours = { start, end, timezone };
  }
}

describe('TimeManager', () => {
  let mockConfigManager: MockConfigManager;
  let timeManager: TimeManager;

  beforeEach(() => {
    mockConfigManager = new MockConfigManager();
    timeManager = new TimeManager(mockConfigManager);
  });

  describe('parseTimeString', () => {
    it('should parse valid time strings correctly', () => {
      const timeManager_any = timeManager as any;

      const result = timeManager_any.parseTimeString('09:30');
      expect(result.hour).toBe(9);
      expect(result.minute).toBe(30);
    });

    it('should handle edge cases', () => {
      const timeManager_any = timeManager as any;

      const midnight = timeManager_any.parseTimeString('00:00');
      expect(midnight.hour).toBe(0);
      expect(midnight.minute).toBe(0);

      const noon = timeManager_any.parseTimeString('12:00');
      expect(noon.hour).toBe(12);
      expect(noon.minute).toBe(0);

      const endOfDay = timeManager_any.parseTimeString('23:59');
      expect(endOfDay.hour).toBe(23);
      expect(endOfDay.minute).toBe(59);
    });    it('should throw error for invalid time format', () => {
      const timeManager_any = timeManager as any;

      expect(() => {
        timeManager_any.parseTimeString('invalid');
      }).toThrow('Invalid time format');

      expect(() => {
        timeManager_any.parseTimeString('25:00'); // 25:00 is invalid (hours should be 0-23)
      }).toThrow('Invalid time format');

      expect(() => {
        timeManager_any.parseTimeString('12:60'); // 60 minutes is invalid (should be 0-59)
      }).toThrow('Invalid time format');
    });
  });

  describe('session state management', () => {
    it('should handle logon/logout state correctly', () => {
      expect(timeManager.getTradingSessionState().isLoggedIn).toBe(false);

      timeManager.setLoggedIn(true);
      expect(timeManager.getTradingSessionState().isLoggedIn).toBe(true);

      timeManager.setLoggedIn(false);
      expect(timeManager.getTradingSessionState().isLoggedIn).toBe(false);
    });

    it('should determine when logon/logout is needed', () => {
      jest.spyOn(timeManager, 'isWithinTradingHours').mockReturnValue(true);

      let sessionState = timeManager.getTradingSessionState();
      expect(sessionState.shouldLogon).toBe(true);
      expect(sessionState.shouldLogout).toBe(false);

      timeManager.setLoggedIn(true);
      sessionState = timeManager.getTradingSessionState();
      expect(sessionState.shouldLogon).toBe(false);
      expect(sessionState.shouldLogout).toBe(false);

      jest.spyOn(timeManager, 'isWithinTradingHours').mockReturnValue(false);

      sessionState = timeManager.getTradingSessionState();
      expect(sessionState.shouldLogon).toBe(false);
      expect(sessionState.shouldLogout).toBe(true);
    });
  });

  describe('trading active status', () => {
    it('should return true only when logged in and within trading hours', () => {
      jest.spyOn(timeManager, 'isWithinTradingHours').mockReturnValue(true);
      expect(timeManager.isTradingActive()).toBe(false);

      timeManager.setLoggedIn(true);
      expect(timeManager.isTradingActive()).toBe(true);

      jest.spyOn(timeManager, 'isWithinTradingHours').mockReturnValue(false);
      expect(timeManager.isTradingActive()).toBe(false);

      timeManager.setLoggedIn(false);
      expect(timeManager.isTradingActive()).toBe(false);
    });
  });

  describe('timezone conversion', () => {
    it('should handle IST timezone correctly', () => {
      const timeManager_any = timeManager as any;
      const testDate = new Date('2024-01-01T12:00:00Z');

      const istTime = timeManager_any.convertToTradingTimezone(
        testDate,
        'Asia/Kolkata'
      );
      expect(istTime.getHours()).toBe(17);
      expect(istTime.getMinutes()).toBe(30);
    });
    it('should handle UTC timezone correctly', () => {
      const timeManager_any = timeManager as any;
      const testDate = new Date('2024-01-01T12:00:00Z');

      const utcTime = timeManager_any.convertToTradingTimezone(testDate, 'UTC');
      expect(utcTime.getTime()).toBe(testDate.getTime());
    });
  });

  describe('next trading event', () => {
    it('should calculate next trading event correctly', () => {
      expect(() => {
        timeManager.getNextTradingEvent();
      }).not.toThrow();
    });
  });

  describe('current trading time formatting', () => {
    it('should format current trading time correctly', () => {
      const result = timeManager.getCurrentTradingTime();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });
  });
});
