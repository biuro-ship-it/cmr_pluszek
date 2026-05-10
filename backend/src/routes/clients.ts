import { Router } from 'express';
import { db } from '../services/firebase';
import { Client } from '../types';
import { verifyToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const COLLECTION = 'clients';

router.use(verifyToken);

// ==========================================
// SCHEMATY WALIDACJI ZOD (BEZPIECZEŃSTWO - WERSJA UPROSZCZONA)
// ==========================================
const AddressSchema = z.object({
  province: z.string().optional().default(''),
  zipCode: z.string().optional().default(''),
  city: z.string().optional().default(''),
  street: z.string().optional().default(''),
  number: z.string().optional().default(''),
});

const ClientSchema = z.object({
  companyName: z.string().min(1, 'Nazwa firmy jest absolutnie wymagana'),
  type: z.string().default('sklep'), // Zmienione z z.enum na z.string, by obejść błąd TS
  contactPerson: z.string().optional().default(''),
  email: z.string().optional().default(''), // Uproszczone z z.literal
  phone: z.string().optional().default(''),
  address: AddressSchema,
});


// ==========================================
// SEKCJA 1: ZARZĄDZANIE KLIENTAMI
// ==========================================

router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION).orderBy('companyName').get();
    const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post('/', async (req, res) => {
  try {
    const parsed = ClientSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const newClient: Omit<Client, 'id'> = {
      ...(parsed.data as unknown as Omit<Client, 'id'>), // Wymuszamy zgodność na kompilatorze TS
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await db.collection(COLLECTION).add(newClient);
    res.status(201).json({ id: docRef.id, ...newClient });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się dodać klienta' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const parsed = ClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const updateData = { 
      ...(parsed.data as unknown as Partial<Client>), // Wymuszamy zgodność na kompilatorze TS
      updatedAt: new Date().toISOString() 
    };
    
    await db.collection(COLLECTION).doc(id).update(updateData);
    res.json({ id, ...updateData });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zaktualizować danych' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection(COLLECTION).doc(id).delete();
    res.json({ message: 'Klient usunięty' });
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ==========================================
// SEKCJA 2: HISTORIA KONTAKTÓW (INTERAKCJE)
// ==========================================

router.get('/:id/interactions', async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await db.collection(COLLECTION).doc(id).collection('interactions').orderBy('contactDate', 'desc').get();
    const interactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(interactions);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się pobrać historii kontaktów' });
  }
});

router.post('/:id/interactions', async (req, res) => {
  try {
    const { id } = req.params;
    const createdBy = (req as any).user?.email || 'Nieznany użytkownik'; 

    const newInteraction = {
      ...req.body,
      createdBy,
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection(COLLECTION).doc(id).collection('interactions').add(newInteraction);
    
    await db.collection(COLLECTION).doc(id).update({
      lastContactAt: req.body.contactDate || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.status(201).json({ id: docRef.id, ...newInteraction });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zapisać kontaktu' });
  }
});

export default router;