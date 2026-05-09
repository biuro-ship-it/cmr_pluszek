import { Router } from 'express';
import { db } from '../services/firebase';
import { Client } from '../types';

const router = Router();
const COLLECTION = 'clients';

/**
 * POBIERANIE WSZYSTKICH KLIENTÓW
 */
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION).orderBy('companyName').get();
    const clients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(clients);
  } catch (error) {
    console.error("Błąd podczas pobierania klientów:", error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

/**
 * DODAWANIE NOWEGO KLIENTA
 * Obsługuje nową strukturę: type (hurt/sklep) oraz obiekt address
 */
router.post('/', async (req, res) => {
  try {
    const newClient: Omit<Client, 'id'> = {
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await db.collection(COLLECTION).add(newClient);
    res.status(201).json({ id: docRef.id, ...newClient });
  } catch (error) {
    console.error("Błąd podczas dodawania klienta:", error);
    res.status(500).json({ error: 'Nie udało się dodać klienta' });
  }
});

/**
 * AKTUALIZACJA KLIENTA
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    await db.collection(COLLECTION).doc(id).update(updateData);
    res.json({ id, ...updateData });
  } catch (error) {
    console.error("Błąd podczas aktualizacji klienta:", error);
    res.status(500).json({ error: 'Nie udało się zaktualizować danych' });
  }
});

/**
 * USUWANIE KLIENTA
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection(COLLECTION).doc(id).delete();
    res.json({ message: 'Klient usunięty' });
  } catch (error) {
    console.error("Błąd podczas usuwania klienta:", error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

export default router;