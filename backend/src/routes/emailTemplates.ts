import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../services/firebase';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { EmailTemplate } from '../types';

const router = Router();
router.use(verifyToken);

const COLLECTION = 'emailTemplates';

const TemplateSchema = z.object({
  name: z.string().min(1, 'Nazwa szablonu jest wymagana'),
  category: z.string().min(1, 'Kategoria jest wymagana'),
  subject: z.string().min(1, 'Temat maila jest wymagany'),
  body: z.string().min(1, 'Treść szablonu jest wymagana'),
});

// GET /api/email-templates — lista szablonów (najnowsze na górze)
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const snapshot = await db.collection(COLLECTION).orderBy('createdAt', 'desc').get();
    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(templates);
  } catch (error) {
    console.error('[email-templates] GET / błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się pobrać szablonów maili' });
  }
});

// POST /api/email-templates — nowy szablon
router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = TemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const now = new Date().toISOString();
  const templateData: Omit<EmailTemplate, 'id'> = {
    ...parsed.data,
    createdBy: req.user?.email || 'system',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = await db.collection(COLLECTION).add(templateData);
    res.status(201).json({ id: docRef.id, ...templateData });
  } catch (error) {
    console.error('[email-templates] POST / błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się zapisać szablonu' });
  }
});

// PUT /api/email-templates/:id — aktualizacja szablonu
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = TemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { id } = req.params;
  const now = new Date().toISOString();

  try {
    const docRef = db.collection(COLLECTION).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Szablon nie istnieje' });
      return;
    }
    await docRef.update({ ...parsed.data, updatedAt: now });
    res.json({ id, ...snap.data(), ...parsed.data, updatedAt: now });
  } catch (error) {
    console.error('[email-templates] PUT /:id błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się zaktualizować szablonu' });
  }
});

// DELETE /api/email-templates/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await db.collection(COLLECTION).doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('[email-templates] DELETE /:id błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się usunąć szablonu' });
  }
});

// Uwaga: wysyłka maili odbywa się po stronie klienta (mailto: w EmailSendModal),
// otwierając domyślny program pocztowy użytkownika. Backend trzyma tylko szablony.

export default router;
