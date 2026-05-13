import { Router } from 'express';
import { db } from '../services/firebase';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const COLLECTION = 'followups';

router.use(verifyToken);

// P2-1: Schematy walidacji dla zadań
const FollowUpSchema = z.object({
  clientName: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  reminderText: z.string().optional().default(''),
});

const StatusSchema = z.enum(['zrealizowane', 'przesunięte']);

router.get('/summary', async (req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION).where('status', '==', 'zaplanowane').get();
    const followups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const today = new Date().toISOString().split('T')[0];
    const summary = followups
      .filter((f: any) => f.dueDate <= today)
      .sort((a: any, b: any) => a.dueDate.localeCompare(b.dueDate));

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się pobrać przypomnień' });
  }
});

router.post('/client/:clientId', async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    
    // Walidacja przypomnienia
    const parsed = FollowUpSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const newFollowup = {
      ...parsed.data,
      clientId,
      status: 'zaplanowane',
      createdAt: new Date().toISOString()
    };
    
    const docRef = await db.collection(COLLECTION).add(newFollowup);
    res.status(201).json({ id: docRef.id, ...newFollowup });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zaplanować kontaktu' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Walidacja statusu
    const parsed = StatusSchema.safeParse(req.body.status);
    if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowy status' });

    const updateData = {
      status: parsed.data,
      completedAt: parsed.data === 'zrealizowane' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    };
    
    await db.collection(COLLECTION).doc(id).update(updateData);
    res.json({ id, ...updateData });
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas zmiany statusu zadania' });
  }
});

export default router;