import { useEffect, useState } from "react";

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function CalendarView({ token }: { token: string }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_URL}/api/calendar/events`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setEvents(data))
      .finally(() => setLoading(false));
  }, [token]);

  const syncAll = async () => {
    // Simple sync endpoint – could be expanded to send specific follow‑ups
    await fetch(`${API_URL}/api/calendar/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    // Refresh events after sync
    setLoading(true);
    const res = await fetch(`${API_URL}/api/calendar/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setEvents(data);
    setLoading(false);
  };

  return (
    <section className="calendar-view">
      <h2>Kalendarz (Google)</h2>
      <button onClick={syncAll} className="primary-btn">
        Synchronizuj z Google Calendar
      </button>
      {loading ? (
        <p>Ładowanie wydarzeń…</p>
      ) : (
        <ul className="event-list">
          {events.map((ev) => (
            <li key={ev.id} className="event-item">
              <strong>{ev.summary}</strong> – {new Date(ev.start).toLocaleString()} – {new Date(ev.end).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
