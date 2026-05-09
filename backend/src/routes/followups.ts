import { Router } from 'express';
import { db } from '../services/firebase';
import { verifyToken } from '../middleware/auth';

const router = Router();
const COLLECTION = 'followups';

// Zabezpieczenie endpointów
router.use(verifyToken);

/**
 * POBIERANIE ZADAŃ "NA DZIŚ I ZALEGŁYCH" (GLOBALNIE)
 * Użyjemy tego na głównym ekranie Dashboardu
 */
router.get('/summary', async (req, res) => {
  try {
    // Pobieramy z bazy tylko te, które są 'zaplanowane'
    const snapshot = await db.collection(COLLECTION).where('status', '==', 'zaplanowane').get();
    const followups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filtrujemy, aby pokazać tylko dzisiejsze i zaległe
    const today = new Date().toISOString().split('T')[0];
    const summary = followups
      .filter((f: any) => f.dueDate <= today)
      .sort((a: any, b: any) => a.dueDate.localeCompare(b.dueDate)); // Sortowanie od najstarszych

    res.json(summary);
  } catch (error) {
    console.error("Błąd pobierania zadań:", error);
    res.status(500).json({ error: 'Nie udało się pobrać przypomnień' });
  }
});

/**
 * DODAWANIE PRZYPOMNIENIA DLA KLIENTA
 */
router.post('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const newFollowup = {
      ...req.body,
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

/**
 * ZMIANA STATUSU (np. oznacz jako Zrealizowane)
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updateData = {
      status,
      completedAt: status === 'zrealizowane' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    };
    await db.collection(COLLECTION).doc(id).update(updateData);
    res.json({ id, ...updateData });
  } catch (error) {
    res.status(500).json({ error: 'Błąd podczas zmiany statusu zadania' });
  }
});

export default router;