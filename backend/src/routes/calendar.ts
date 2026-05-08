// backend/src/routes/calendar.ts
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "../services/googleCalendar.js";

const router = Router();

// Get all calendar events for the authenticated user
router.get("/events", requireAuth, async (req: Request, res: Response) => {
  try {
    const events = await getCalendarEvents(req.user.uid);
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Create a new calendar event
router.post("/events", requireAuth, async (req: Request, res: Response) => {
  const { summary, start, end, description } = req.body;
  try {
    const event = await createCalendarEvent(req.user.uid, { summary, start, end, description });
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// Update an existing event
router.patch("/events/:eventId", requireAuth, async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const updates = req.body;
  try {
    const updated = await updateCalendarEvent(req.user.uid, eventId, updates);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

// Delete an event
router.delete("/events/:eventId", requireAuth, async (req: Request, res: Response) => {
  const { eventId } = req.params;
  try {
    await deleteCalendarEvent(req.user.uid, eventId);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

export default router;
