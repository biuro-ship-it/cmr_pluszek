import { Router } from 'express';
import { db } from '../services/firebase';
import { Client } from '../types';
import { verifyToken } from '../middleware/auth';
import { z } from 'zod'; // NOWE: Importujemy Zod

const router = Router();
const COLLECTION = 'clients';

router.use(verifyToken);

// ==========================================
// SCHEMATY WALIDACJI ZOD (BEZPIECZEŃSTWO)
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
  type: z.enum(['hurt', 'sklep']),
  contactPerson: z.string().optional().default(''),
  // Pozwalamy na pusty string lub poprawny adres e-mail
  email: z.string().email('Niepoprawny format e-mail').optional().or(z.literal('')),
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
    // WALIDACJA: Sprawdzamy czy dane z frontendu pasują do naszego schematu
    const parsed = ClientSchema.safeParse(req.body);
    
    if (!parsed.success) {
      // Jeśli dane są złe, odrzucamy je od razu i wysyłamy powód
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const newClient: Omit<Client, 'id'> = {
      ...parsed.data, // Używamy przefiltrowanych, bezpiecznych danych
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
    
    // WALIDACJA RÓWNIEŻ PRZY EDYCJI
    const parsed = ClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const updateData = { 
      ...parsed.data, 
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