import { Router } from 'express';
import { db } from '../services/firebase';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const COLLECTION = 'promotions';

router.use(verifyToken);

// ─── Schematy walidacji ─────────────────────────────────────────────────────

const PromotionProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional().default(''),
  priceNetto: z.number().optional().default(0),
  imageUrl: z.string().optional().default(''),
});

const PromotionSchema = z.object({
  clientIds: z.array(z.string()).min(1, 'Wybierz co najmniej jednego klienta'),
  clientNames: z.array(z.string()),
  products: z.array(PromotionProductSchema).min(1, 'Wybierz co najmniej jeden produkt'),
  discountType: z.enum(['none', 'percent', 'flat']).default('none'),
  discountValue: z.number().min(0).default(0),
  emailSubject: z.string().min(1, 'Temat e-maila jest wymagany'),
  emailBody: z.string().min(1, 'Treść e-maila jest wymagana'),
  scheduledFor: z.string().nullable().optional(),
  status: z.enum(['draft', 'scheduled', 'sent']).default('draft'),
});

// ─── GET /api/promotions — lista promocji ───────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const promotions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się pobrać listy promocji' });
  }
});

// ─── POST /api/promotions — utwórz promocję ─────────────────────────────────

router.post('/', async (req: AuthRequest, res) => {
  try {
    const parsed = PromotionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const now = new Date().toISOString();
    const status = parsed.data.scheduledFor ? 'scheduled' : parsed.data.status;

    const newPromotion = {
      ...parsed.data,
      status,
      sentAt: status === 'sent' ? now : null,
      createdBy: req.user?.email || 'Nieznany',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection(COLLECTION).add(newPromotion);
    res.status(201).json({ id: docRef.id, ...newPromotion });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zapisać promocji' });
  }
});

// ─── PATCH /api/promotions/:id/status — zmień status ───────────────────────

router.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const StatusSchema = z.enum(['draft', 'scheduled', 'sent']);
    const parsed = StatusSchema.safeParse(req.body.status);
    if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowy status' });

    const now = new Date().toISOString();
    const updateData = {
      status: parsed.data,
      sentAt: parsed.data === 'sent' ? now : null,
      updatedAt: now,
      updatedBy: req.user?.email || 'Nieznany',
    };

    await db.collection(COLLECTION).doc(id).update(updateData);
    res.json({ id, ...updateData });
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas zmiany statusu promocji' });
  }
});

// ─── DELETE /api/promotions/:id — usuń promocję ─────────────────────────────

router.delete('/:id', async (_req, res) => {
  try {
    const { id } = _req.params;
    await db.collection(COLLECTION).doc(id).delete();
    res.json({ message: 'Promocja usunięta' });
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

export default router;
