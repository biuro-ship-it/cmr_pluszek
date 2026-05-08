import { describe, it, expect, vi } from 'vitest';
import { getCalendarEvents } from './googleCalendar';

// Mock googleapis
vi.mock('googleapis', () => {
  return {
    google: {
      auth: {
        OAuth2: vi.fn().mockImplementation(() => ({
          setCredentials: vi.fn(),
        })),
      },
      calendar: vi.fn().mockImplementation(() => ({
        events: {
          list: vi.fn().mockResolvedValue({
            data: {
              items: [
                { id: '1', summary: 'Test Event', start: { dateTime: '2026-05-08T10:00:00Z' }, end: { dateTime: '2026-05-08T11:00:00Z' } }
              ]
            }
          })
        }
      })),
    }
  };
});

describe('googleCalendar service', () => {
  it('should fetch calendar events', async () => {
    const events = await getCalendarEvents('test-uid');
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Test Event');
  });
});
