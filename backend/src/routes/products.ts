import { Router, Response } from 'express';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { db } from '../services/firebase';

const router = Router();
router.use(verifyToken);

const COLLECTION = 'products';

// GET /api/products
router.get('/', async (_req, res: Response) => {
  try {
    const snapshot = await db.collection(COLLECTION).orderBy('name').get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(products);
  } catch {
    res.status(500).json({ error: 'Nie udało się pobrać produktów' });
  }
});

// POST /api/products
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, priceNetto, imageUrl } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Pole name jest wymagane' });
      return;
    }
    const docRef = await db.collection(COLLECTION).add({
      name,
      code: code ?? '',
      priceNetto: priceNetto ?? 0,
      imageUrl: imageUrl ?? '',
      createdAt: new Date().toISOString(),
    });
    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch {
    res.status(500).json({ error: 'Nie udało się dodać produktu' });
  }
});

// PUT /api/products/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, priceNetto, imageUrl } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Pole name jest wymagane' });
      return;
    }
    const ref = db.collection(COLLECTION).doc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      res.status(404).json({ error: 'Produkt nie istnieje' });
      return;
    }
    const updated = {
      name,
      code: code ?? '',
      priceNetto: priceNetto ?? 0,
      imageUrl: imageUrl ?? '',
      updatedAt: new Date().toISOString(),
    };
    await ref.update(updated);
    res.json({ id, ...existing.data(), ...updated });
  } catch {
    res.status(500).json({ error: 'Nie udało się zaktualizować produktu' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.collection(COLLECTION).doc(id).delete();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Nie udało się usunąć produktu' });
  }
});

export default router;
