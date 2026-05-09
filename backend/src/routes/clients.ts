import { Router } from 'express';
import { db } from '../services/firebase';
import { Client } from '../types';
import { verifyToken } from '../middleware/auth';

const router = Router();
const COLLECTION = 'clients';

// ZABEZPIECZENIE: Ta jedna linijka sprawia, że wszystkie poniższe endpointy wymagają logowania
router.use(verifyToken);

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
/**
 * POBIERANIE HISTORII KONTAKTÓW DLA DANEGO KLIENTA
 */
router.get('/:id/interactions', async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await db.collection(COLLECTION).doc(id).collection('interactions').orderBy('contactDate', 'desc').get();
    
    const interactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(interactions);
  } catch (error) {
    console.error("Błąd podczas pobierania interakcji:", error);
    res.status(500).json({ error: 'Nie udało się pobrać historii kontaktów' });
  }
});

/**
 * DODAWANIE NOWEGO KONTAKTU (NOTATKI) DO KLIENTA
 */
router.post('/:id/interactions', async (req, res) => {
  try {
    const { id } = req.params;
    // req.user pochodzi z naszego middleware verifyToken
    const createdBy = (req as any).user?.email || 'Nieznany użytkownik'; 

    const newInteraction = {
      ...req.body,
      createdBy,
      createdAt: new Date().toISOString()
    };

    // Zapisujemy interakcję w subkolekcji 'interactions' danego klienta
    const docRef = await db.collection(COLLECTION).doc(id).collection('interactions').add(newInteraction);
    
    // Opcjonalnie: Aktualizujemy datę ostatniego kontaktu na głównym dokumencie klienta
    await db.collection(COLLECTION).doc(id).update({
      lastContactAt: req.body.contactDate || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.status(201).json({ id: docRef.id, ...newInteraction });
  } catch (error) {
    console.error("Błąd podczas dodawania interakcji:", error);
    res.status(500).json({ error: 'Nie udało się zapisać kontaktu' });
  }
});

export default router;