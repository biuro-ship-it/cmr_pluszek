import { Router, Response } from 'express';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { db } from '../services/firebase';
import { z } from 'zod';

const router = Router();
router.use(verifyToken);

const COLLECTION = 'foam_stock';

// ==========================================
// SCHEMATY WALIDACJI ZOD
// ==========================================
const ColorSchema = z.object({
  name: z.string().min(1, 'Nazwa koloru jest wymagana').max(60),
  hex: z.string().optional().default('#64748b'),
  quantity: z.number().int().min(0).optional().default(0),
  minQuantity: z.number().int().min(0).optional().default(0),
});

const AdjustSchema = z.object({
  delta: z.number().int().refine(v => v !== 0, 'Podaj wartość różną od zera'),
  reason: z.string().max(300).optional().default(''),
});

// Przykładowe kolory wgrywane jednorazowo przy pierwszym uruchomieniu
const SEED_COLORS: { name: string; hex: string }[] = [
  { name: 'Niebieski', hex: '#3b82f6' },
  { name: 'Fioletowy', hex: '#8b5cf6' },
  { name: 'Zielony', hex: '#22c55e' },
  { name: 'Czerwony', hex: '#ef4444' },
  { name: 'Różowy', hex: '#ec4899' },
  { name: 'Pomarańczowy', hex: '#f97316' },
  { name: 'Żółty', hex: '#eab308' },
  { name: 'Dwukolorowy', hex: '#64748b' },
  { name: 'Przejściówka', hex: '#14b8a6' },
];

// POST /api/foam-stock/seed — jednorazowe wgranie kolorów (idempotentne)
router.post('/seed', async (req: AuthRequest, res: Response) => {
  try {
    const markerRef = db.collection('foam_stock_meta').doc('seed');
    const marker = await markerRef.get();
    if (marker.exists) {
      res.json({ seeded: false });
      return;
    }

    const now = new Date().toISOString();
    const batch = db.batch();
    SEED_COLORS.forEach((color, index) => {
      const ref = db.collection(COLLECTION).doc();
      batch.set(ref, {
        name: color.name,
        hex: color.hex,
        quantity: 0,
        minQuantity: 0,
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
        updatedBy: req.user?.email || 'seed',
      });
    });
    batch.set(markerRef, { seededAt: now, by: req.user?.email || 'seed' });
    await batch.commit();

    res.json({ seeded: true, count: SEED_COLORS.length });
  } catch (error) {
    console.error('[foam-stock] POST /seed błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się wgrać przykładowych kolorów' });
  }
});

// GET /api/foam-stock — lista kolorów
router.get('/', async (_req, res: Response) => {
  try {
    const snapshot = await db.collection(COLLECTION).orderBy('sortOrder').get();
    const colors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(colors);
  } catch (error) {
    console.error('[foam-stock] GET / błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się pobrać stanu magazynu' });
  }
});

// POST /api/foam-stock — nowy kolor
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = ColorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    // Nowy kolor trafia na koniec listy
    const last = await db.collection(COLLECTION).orderBy('sortOrder', 'desc').limit(1).get();
    const nextOrder = last.empty ? 0 : ((last.docs[0].data().sortOrder ?? 0) + 1);

    const now = new Date().toISOString();
    const newColor = {
      name: parsed.data.name,
      hex: parsed.data.hex,
      quantity: parsed.data.quantity,
      minQuantity: parsed.data.minQuantity,
      sortOrder: nextOrder,
      createdAt: now,
      updatedAt: now,
      updatedBy: req.user?.email || 'Nieznany',
    };

    const docRef = await db.collection(COLLECTION).add(newColor);
    res.status(201).json({ id: docRef.id, ...newColor });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się dodać koloru' });
  }
});

// PUT /api/foam-stock/:id — edycja metadanych koloru (nazwa/hex/próg)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = ColorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const ref = db.collection(COLLECTION).doc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      res.status(404).json({ error: 'Kolor nie istnieje' });
      return;
    }

    // Uwaga: ilości NIE zmieniamy tutaj — od tego jest /adjust
    const updateData = {
      name: parsed.data.name,
      hex: parsed.data.hex,
      minQuantity: parsed.data.minQuantity,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || 'Nieznany',
    };

    await ref.update(updateData);
    res.json({ id, ...existing.data(), ...updateData });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zaktualizować koloru' });
  }
});

// DELETE /api/foam-stock/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.collection(COLLECTION).doc(id).delete();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się usunąć koloru' });
  }
});

// PATCH /api/foam-stock/:id/adjust — przyjęcie (+) / wydanie (−) z historią
router.patch('/:id/adjust', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = AdjustSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const { delta, reason } = parsed.data;
    const by = req.user?.email || 'Nieznany';
    const now = new Date().toISOString();
    const ref = db.collection(COLLECTION).doc(id);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return { error: 'notfound' as const };
      }
      const current = (snap.data()?.quantity ?? 0) as number;
      const newQuantity = current + delta;
      if (newQuantity < 0) {
        return { error: 'negative' as const, current };
      }

      tx.update(ref, { quantity: newQuantity, updatedAt: now, updatedBy: by });

      const moveRef = ref.collection('movements').doc();
      tx.set(moveRef, {
        delta,
        reason: reason || (delta > 0 ? 'Przyjęcie' : 'Wydanie do produkcji'),
        resultingQuantity: newQuantity,
        by,
        at: now,
      });

      return { newQuantity };
    });

    if ('error' in result) {
      if (result.error === 'notfound') {
        res.status(404).json({ error: 'Kolor nie istnieje' });
        return;
      }
      res.status(400).json({
        error: `Nie można wydać więcej niż jest na stanie (dostępne: ${result.current} szt.)`,
      });
      return;
    }

    res.json({ id, quantity: result.newQuantity, updatedAt: now, updatedBy: by });
  } catch (error) {
    console.error('[foam-stock] PATCH /:id/adjust błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się zmienić stanu' });
  }
});

// GET /api/foam-stock/:id/movements — historia ruchów koloru
router.get('/:id/movements', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const snapshot = await db
      .collection(COLLECTION)
      .doc(id)
      .collection('movements')
      .orderBy('at', 'desc')
      .limit(100)
      .get();
    const movements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się pobrać historii ruchów' });
  }
});

export default router;
