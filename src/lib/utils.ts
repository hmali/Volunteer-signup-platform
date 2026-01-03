import { formatInTimeZone } from 'date-fns-tz';
import { addDays, eachDayOfInterval } from 'date-fns';

/**
 * Generate days for a month, excluding Thursday and Friday
 */
export function generateMonthDays(
  startDate: Date,
  endDate: Date,
  timezone: string = 'America/New_York'
): Array<{ date: Date; dayOfWeek: number; skip: boolean; reason?: string }> {
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return days.map(date => {
    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
    const isThursday = dayOfWeek === 4;
    const isFriday = dayOfWeek === 5;

    return {
      date,
      dayOfWeek,
      skip: isThursday || isFriday,
      reason: isThursday
        ? 'Thursday excluded by temple policy'
        : isFriday
        ? 'Friday excluded by temple policy'
        : undefined,
    };
  });
}

/**
 * Format date for display
 */
export function formatDisplayDate(date: Date, timezone: string = 'America/New_York'): string {
  return formatInTimeZone(date, timezone, 'EEEE, MMMM d, yyyy');
}

/**
 * Get day of week name
 */
export function getDayOfWeekName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
}

/**
 * Validate that a date is not Thursday or Friday
 */
export function isValidVolunteerDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek !== 4 && dayOfWeek !== 5;
}

/**
 * Generate Google Calendar URL
 */
export function generateGoogleCalendarUrl(params: {
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
}): string {
  const formatDateTime = (date: Date) => {
    return formatInTimeZone(date, params.timezone, "yyyyMMdd'T'HHmmss");
  };

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', params.title);
  url.searchParams.set('details', params.description);
  url.searchParams.set('location', params.location);
  url.searchParams.set(
    'dates',
    `${formatDateTime(params.startTime)}/${formatDateTime(params.endTime)}`
  );
  url.searchParams.set('ctz', params.timezone);

  return url.toString();
}

/**
 * Parse shift label to extract times
 * e.g., "6:30 PM – 8:30 PM" => { start: "18:30", end: "20:30" }
 */
export function parseShiftLabel(shiftLabel: string): { start: string; end: string } {
  const parts = shiftLabel.split('–').map(s => s.trim());
  
  if (parts.length !== 2) {
    // Fallback to default times
    return { start: '18:30', end: '20:30' };
  }

  const convertTo24Hour = (time: string): string => {
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return '18:30'; // Fallback

    let [, hours, minutes, meridiem] = match;
    let h = parseInt(hours);
    
    if (meridiem.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (meridiem.toUpperCase() === 'AM' && h === 12) h = 0;

    return `${h.toString().padStart(2, '0')}:${minutes}`;
  };

  return {
    start: convertTo24Hour(parts[0]),
    end: convertTo24Hour(parts[1]),
  };
}

/**
 * Sanitize user input (prevent XSS)
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Generate a short, human-readable ID
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Retry utility with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError!;
}

/**
 * Create logger with structured output
 */
export const logger = {
  info: (message: string, meta?: Record<string, any>) => {
    console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() }));
  },
  warn: (message: string, meta?: Record<string, any>) => {
    console.warn(JSON.stringify({ level: 'warn', message, ...meta, timestamp: new Date().toISOString() }));
  },
  error: (message: string, meta?: Record<string, any>) => {
    console.error(JSON.stringify({ level: 'error', message, ...meta, timestamp: new Date().toISOString() }));
  },
  debug: (message: string, meta?: Record<string, any>) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(JSON.stringify({ level: 'debug', message, ...meta, timestamp: new Date().toISOString() }));
    }
  },
};
