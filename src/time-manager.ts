import { ConfigManager } from './config-manager';

/**
 * TimeManager handles trading window management and timezone operations
 **/
export class TimeManager {
  private configManager: ConfigManager;
  private isLoggedIn: boolean = false;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }
  public isWithinTradingHours(): boolean {
    const config = this.configManager.getTradingHours();
    const now = new Date();

    const currentTimeInTradingTz = this.convertToTradingTimezone(
      now,
      config.timezone
    );

    const startTime = this.parseTimeString(config.start);
    const endTime = this.parseTimeString(config.end);

    const currentHour = currentTimeInTradingTz.getHours();
    const currentMinute = currentTimeInTradingTz.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const startTimeMinutes = startTime.hour * 60 + startTime.minute;
    const endTimeMinutes = endTime.hour * 60 + endTime.minute;

    if (startTimeMinutes <= endTimeMinutes) {
      return (
        currentTimeMinutes >= startTimeMinutes &&
        currentTimeMinutes <= endTimeMinutes
      );
    }

    // Handle overnight trading window (crosses midnight)
    return (
      currentTimeMinutes >= startTimeMinutes ||
      currentTimeMinutes <= endTimeMinutes
    );
  }
  getTradingSessionState(): {
    isWithinTradingHours: boolean;
    isLoggedIn: boolean;
    shouldLogon: boolean;
    shouldLogout: boolean;
  } {
    const withinTradingHours = this.isWithinTradingHours();

    const shouldLogon = withinTradingHours && !this.isLoggedIn;
    const shouldLogout = !withinTradingHours && this.isLoggedIn;

    return {
      isWithinTradingHours: withinTradingHours,
      isLoggedIn: this.isLoggedIn,
      shouldLogon,
      shouldLogout,
    };
  }
  public setLoggedIn(loggedIn: boolean): void {
    this.isLoggedIn = loggedIn;
  }

  public isTradingActive(): boolean {
    return this.isLoggedIn && this.isWithinTradingHours();
  }

  public getNextTradingEvent(): {
    eventType: 'open' | 'close';
    timeUntilEvent: number;
    eventTime: Date;
  } {
    const config = this.configManager.getTradingHours();
    const now = new Date();
    const currentTimeInTz = this.convertToTradingTimezone(now, config.timezone);

    const startTime = this.parseTimeString(config.start);
    const endTime = this.parseTimeString(config.end);

    const todayStart = new Date(currentTimeInTz);
    todayStart.setHours(startTime.hour, startTime.minute, 0, 0);

    const todayEnd = new Date(currentTimeInTz);
    todayEnd.setHours(endTime.hour, endTime.minute, 0, 0);

    // If end time is before start time, it means trading ends next day
    if (
      endTime.hour < startTime.hour ||
      (endTime.hour === startTime.hour && endTime.minute < startTime.minute)
    ) {
      todayEnd.setDate(todayEnd.getDate() + 1);
    }

    const withinTradingHours = this.isWithinTradingHours();

    if (withinTradingHours) {
      return {
        eventType: 'close',
        timeUntilEvent: todayEnd.getTime() - currentTimeInTz.getTime(),
        eventTime: todayEnd,
      };
    } else {
      let nextOpen = todayStart;

      // If today's start time has passed, next open is tomorrow
      if (currentTimeInTz.getTime() > todayStart.getTime()) {
        nextOpen = new Date(todayStart);
        nextOpen.setDate(nextOpen.getDate() + 1);
      }

      return {
        eventType: 'open',
        timeUntilEvent: nextOpen.getTime() - currentTimeInTz.getTime(),
        eventTime: nextOpen,
      };
    }
  }
  private convertToTradingTimezone(date: Date, timezone: string): Date {
    // For UTC, return the original date without any conversion
    if (timezone === 'UTC') {
      return new Date(date.getTime());
    }

    // Convert to UTC first, then apply target timezone offset
    const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;

    let offset = 0;
    switch (timezone) {
      case 'Asia/Kolkata':
      case 'Asia/Calcutta':
        offset = 5.5;
        break;
      case 'America/New_York':
        offset = -5;
        break;
      case 'Europe/London':
        offset = 0;
        break;
      default:
        offset = 0;
        break;
    }

    return new Date(utcTime + offset * 3600000);
  }

  private parseTimeString(timeString: string): {
    hour: number;
    minute: number;
  } {
    const [hourStr, minuteStr] = timeString.split(':');
    if (!hourStr || !minuteStr) {
      throw new Error(`Invalid time format: ${timeString}. Expected HH:MM`);
    }
    return {
      hour: parseInt(hourStr, 10),
      minute: parseInt(minuteStr, 10),
    };
  }

  public getCurrentTradingTime(): string {
    const config = this.configManager.getTradingHours();
    const now = new Date();
    const tradingTime = this.convertToTradingTimezone(now, config.timezone);

    return tradingTime.toLocaleTimeString('en-US', {
      hour12: false,
      timeZone: config.timezone,
    });
  }
}
