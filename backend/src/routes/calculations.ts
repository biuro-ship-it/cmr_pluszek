import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../services/firebase';
import { verifyToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(verifyToken);

const COLLECTION = 'calculations';

const CalcComponentSchema = z.object({
  id: z.string(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  materialId: z.string().optional(),
  materialName: z.string().default(''),
  unitPrice: z.number().nonnegative().default(0),
  priceUnit: z.string().default('szt'),
  consumption: z.number().nonnegative().default(0),
  consumptionUnit: z.string().default('szt'),
  included: z.boolean().default(true),
});

const TransportBracketSchema = z.object({
  id: z.string(),
  maxQty: z.number().nonnegative().default(0),
  cost: z.number().nonnegative().default(0),
  costMode: z.enum(['total', 'perUnit']).default('total'),
  color: z.string().default('#3b82f6'),
});

const CalculationSchema = z.object({
  name: z.string().min(1, 'Nazwa kalkulacji jest wymagana'),
  components: z.array(CalcComponentSchema).default([]),
  margin1: z.number().nonnegative().default(0),
  margin2: z.number().nonnegative().default(0),
  transportBrackets: z.array(TransportBracketSchema).default([]),
  productionQty: z.number().nonnegative().default(1),
  notes: z.string().optional(),
});

// --- KALKULACJE ---

router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const snapshot = await db.collection(COLLECTION).orderBy('createdAt', 'desc').get();
    const calculations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(calculations);
  } catch {
    res.status(500).json({ error: 'Błąd pobierania kalkulacji' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = CalculationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

  try {
    const now = new Date().toISOString();
    const data = { ...parsed.data, createdBy: req.user?.email || 'Nieznany', createdAt: now, updatedAt: now };
    const docRef = await db.collection(COLLECTION).add(data);
    res.status(201).json({ id: docRef.id, ...data });
  } catch {
    res.status(500).json({ error: 'Błąd zapisu kalkulacji' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const parsed = CalculationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

  try {
    const updateData = { ...parsed.data, updatedAt: new Date().toISOString() };
    await db.collection(COLLECTION).doc(id).update(updateData);
    const updated = await db.collection(COLLECTION).doc(id).get();
    res.json({ id: updated.id, ...updated.data() });
  } catch {
    res.status(500).json({ error: 'Błąd aktualizacji kalkulacji' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Błąd usuwania kalkulacji' });
  }
});

export default router;
