import { ConfigManager } from './config-manager';
import { TimeOfDay } from './types';
import {
  TIMEZONE_OFFSETS,
  MILLISECONDS_PER_HOUR,
  MILLISECONDS_PER_MINUTE,
  TIME_FORMAT_REGEX,
} from './constants';

export class TimeManager {
  private configManager: ConfigManager;
  private isLoggedIn: boolean = false;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }
  public isWithinTradingHours(): boolean {
    const config = this.configManager.getTradingHours();
    const currentTime = this.getCurrentTimeInTradingTz(config.timezone);
    const { start, end } = this.getTradingWindow(config);

    return this.isTimeWithinWindow(currentTime, start, end);
  }

  private getCurrentTimeInTradingTz(timezone: string): TimeOfDay {
    const now = new Date();
    const tradingTime = this.convertToTradingTimezone(now, timezone);
    return {
      hour: tradingTime.getHours(),
      minute: tradingTime.getMinutes(),
    };
  }

  private getTradingWindow(config: { start: string; end: string }): {
    start: TimeOfDay;
    end: TimeOfDay;
  } {
    return {
      start: this.parseTimeString(config.start),
      end: this.parseTimeString(config.end),
    };
  }

  private isTimeWithinWindow(
    current: TimeOfDay,
    start: TimeOfDay,
    end: TimeOfDay
  ): boolean {
    const currentMinutes = this.convertToMinutes(current);
    const startMinutes = this.convertToMinutes(start);
    const endMinutes = this.convertToMinutes(end);

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  private convertToMinutes(time: TimeOfDay): number {
    return time.hour * 60 + time.minute;
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
    const currentTimeInTz = this.convertToTradingTimezone(
      new Date(),
      config.timezone
    );

    const { todayStart, todayEnd } = this.getTodayTradingTimes(
      currentTimeInTz,
      config
    );

    if (this.isWithinTradingHours()) {
      return this.createTradingEvent(
        'close',
        todayEnd.getTime() - currentTimeInTz.getTime(),
        todayEnd
      );
    } else {
      const nextOpen = this.getNextOpenTime(currentTimeInTz, todayStart);
      return this.createTradingEvent(
        'open',
        nextOpen.getTime() - currentTimeInTz.getTime(),
        nextOpen
      );
    }
  }

  private getTodayTradingTimes(
    currentTime: Date,
    config: { start: string; end: string }
  ): { todayStart: Date; todayEnd: Date } {
    const startTime = this.parseTimeString(config.start);
    const endTime = this.parseTimeString(config.end);

    const todayStart = new Date(currentTime);
    todayStart.setHours(startTime.hour, startTime.minute, 0, 0);

    const todayEnd = new Date(currentTime);
    todayEnd.setHours(endTime.hour, endTime.minute, 0, 0);

    if (this.isEndTimeNextDay(startTime, endTime)) {
      todayEnd.setDate(todayEnd.getDate() + 1);
    }

    return { todayStart, todayEnd };
  }

  private isEndTimeNextDay(start: TimeOfDay, end: TimeOfDay): boolean {
    return (
      end.hour < start.hour ||
      (end.hour === start.hour && end.minute < start.minute)
    );
  }

  private getNextOpenTime(currentTime: Date, todayStart: Date): Date {
    if (currentTime.getTime() > todayStart.getTime()) {
      const nextOpen = new Date(todayStart);
      nextOpen.setDate(nextOpen.getDate() + 1);
      return nextOpen;
    }
    return todayStart;
  }

  private createTradingEvent(
    eventType: 'open' | 'close',
    timeUntilEvent: number,
    eventTime: Date
  ): { eventType: 'open' | 'close'; timeUntilEvent: number; eventTime: Date } {
    return { eventType, timeUntilEvent, eventTime };
  }
  private convertToTradingTimezone(date: Date, timezone: string): Date {
    if (timezone === 'UTC') {
      return new Date(date.getTime());
    }

    const utcTime =
      date.getTime() + date.getTimezoneOffset() * MILLISECONDS_PER_MINUTE;
    const offset =
      TIMEZONE_OFFSETS[timezone as keyof typeof TIMEZONE_OFFSETS] || 0;

    return new Date(utcTime + offset * MILLISECONDS_PER_HOUR);
  }

  private parseTimeString(timeString: string): TimeOfDay {
    if (!TIME_FORMAT_REGEX.test(timeString)) {
      throw new Error(`Invalid time format: ${timeString}. Expected HH:MM`);
    }

    const [hourStr, minuteStr] = timeString.split(':');
    return {
      hour: parseInt(hourStr!, 10),
      minute: parseInt(minuteStr!, 10),
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
