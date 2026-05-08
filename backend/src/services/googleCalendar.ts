import { google } from 'googleapis';
import * as admin from 'firebase-admin';
import { CalendarEvent } from '../types';

// Initialize Google OAuth2 client – expects env vars GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);

oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

/**
 * Retrieve calendar events for a given Firebase UID.
 * For MVP we use a single calendar per user (the primary calendar).
 */
export async function createCalendarEvent(uid: string | undefined, event: { summary: string; start: string; end: string; description?: string; }): Promise<any> {
  if (!uid) throw new Error('User UID missing');
  const eventBody = {
    summary: event.summary,
    description: event.description ?? '',
    start: { dateTime: event.start },
    end: { dateTime: event.end }
  };
  const res = await calendar.events.insert({ calendarId: 'primary', requestBody: eventBody });
  return res.data;
}

export async function updateCalendarEvent(uid: string | undefined, eventId: string, updates: any): Promise<any> {
  if (!uid) throw new Error('User UID missing');
  const res = await calendar.events.patch({ calendarId: 'primary', eventId, requestBody: updates });
  return res.data;
}

export async function deleteCalendarEvent(uid: string | undefined, eventId: string): Promise<void> {
  if (!uid) throw new Error('User UID missing');
  await calendar.events.delete({ calendarId: 'primary', eventId });
}
export async function getCalendarEvents(uid: string | undefined): Promise<CalendarEvent[]> {
  if (!uid) throw new Error('User UID missing');
  // In a real implementation we would map uid -> calendarId stored in Firestore.
  const res = await calendar.events.list({ calendarId: 'primary', maxResults: 2500, singleEvents: true });
  const items = res.data.items || [];
  return items.map(item => ({
    id: item.id ?? '',
    summary: item.summary ?? '',
    start: item.start?.dateTime ?? item.start?.date ?? '',
    end: item.end?.dateTime ?? item.end?.date ?? '',
    description: item.description ?? ''
  }));
}

/**
 * Create or update a Google Calendar event based on a follow‑up record.
 * For simplicity we always create a new event – idempotency can be added later.
 */
export async function syncEventToGoogle(uid: string | undefined, followUpId: string): Promise<void> {
  if (!uid) throw new Error('User UID missing');
  // Fetch follow‑up data from Firestore (placeholder – replace with real call)
  const db = admin.firestore();
  const followUpSnap = await db.collection('followUps').doc(followUpId).get();
  if (!followUpSnap.exists) throw new Error('Follow‑up not found');
  const followUp = followUpSnap.data();
  const event = {
    summary: followUp?.title ?? 'Follow‑up',
    description: followUp?.notes ?? '',
    start: { dateTime: followUp?.dueDate },
    end: { dateTime: new Date(new Date(followUp?.dueDate).getTime() + 30 * 60000).toISOString() }, // 30 min default
  };
  await calendar.events.insert({ calendarId: 'primary', requestBody: event });
}
