import { Router, Response } from 'express';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { db } from '../services/firebase';
import { z } from 'zod';

const router = Router();
router.use(verifyToken);

const COLLECTION = 'notes';

// ==========================================
// SCHEMAT WALIDACJI ZOD
// ==========================================
const NoteSchema = z.object({
  title: z.string().min(1, 'Temat notatki jest wymagany').max(200),
  content: z.string().optional().default(''),
  color: z.string().optional().default('bg-yellow-100'),
  isImportant: z.boolean().optional().default(false),
  isUrgent: z.boolean().optional().default(false),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format daty: YYYY-MM-DD').optional(),
});

// Przykładowe notatki wgrywane jednorazowo przy pierwszym uruchomieniu
const SEED_NOTES = [
  {
    title: 'Procedura obsługi trudnego klienta',
    content: '<p>Pamiętaj o <strong>uśmiechu</strong> i zachowaniu spokoju. Kroki postępowania:</p><ol><li>Wysłuchaj</li><li>Zaproponuj rozwiązanie</li></ol>',
    date: '2026-05-20',
    color: 'bg-rose-100',
    isImportant: true,
    isUrgent: false,
  },
  {
    title: 'AWARIA: Problem z logowaniem na FTP',
    content: '<p>Trzeba to naprawić natychmiast!</p>',
    date: '2026-05-20',
    color: 'bg-slate-100',
    isImportant: false,
    isUrgent: true,
  },
  {
    title: 'Pomysły na nową kampanię',
    content: '<p>Wrzucić więcej postów na social media z użyciem nowych antyram.</p>',
    date: '2026-05-19',
    color: 'bg-yellow-100',
    isImportant: false,
    isUrgent: false,
  },
];

// POST /api/notes/seed — jednorazowe wgranie przykładów (idempotentne, chronione znacznikiem)
router.post('/seed', async (req: AuthRequest, res: Response) => {
  try {
    const markerRef = db.collection('notes_meta').doc('seed');
    const marker = await markerRef.get();
    if (marker.exists) {
      res.json({ seeded: false });
      return;
    }

    const now = new Date().toISOString();
    const batch = db.batch();
    for (const note of SEED_NOTES) {
      const ref = db.collection(COLLECTION).doc();
      batch.set(ref, {
        ...note,
        createdBy: req.user?.email || 'seed',
        createdAt: now,
        updatedAt: now,
      });
    }
    batch.set(markerRef, { seededAt: now, by: req.user?.email || 'seed' });
    await batch.commit();

    res.json({ seeded: true, count: SEED_NOTES.length });
  } catch (error) {
    console.error('[notes] POST /seed błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się wgrać przykładowych notatek' });
  }
});

// GET /api/notes
router.get('/', async (_req, res: Response) => {
  try {
    const snapshot = await db.collection(COLLECTION).orderBy('createdAt', 'desc').get();
    const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(notes);
  } catch (error) {
    console.error('[notes] GET / błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się pobrać notatek' });
  }
});

// POST /api/notes
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = NoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const now = new Date().toISOString();
    const newNote = {
      title: parsed.data.title,
      content: parsed.data.content,
      color: parsed.data.color,
      isImportant: parsed.data.isImportant,
      isUrgent: parsed.data.isUrgent,
      date: parsed.data.date || now.split('T')[0],
      createdBy: req.user?.email || 'Nieznany',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection(COLLECTION).add(newNote);
    res.status(201).json({ id: docRef.id, ...newNote });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się dodać notatki' });
  }
});

// PUT /api/notes/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = NoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const ref = db.collection(COLLECTION).doc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      res.status(404).json({ error: 'Notatka nie istnieje' });
      return;
    }

    const updateData = {
      title: parsed.data.title,
      content: parsed.data.content,
      color: parsed.data.color,
      isImportant: parsed.data.isImportant,
      isUrgent: parsed.data.isUrgent,
      ...(parsed.data.date ? { date: parsed.data.date } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || 'Nieznany',
    };

    await ref.update(updateData);
    res.json({ id, ...existing.data(), ...updateData });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zaktualizować notatki' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.collection(COLLECTION).doc(id).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się usunąć notatki' });
  }
});

export default router;
