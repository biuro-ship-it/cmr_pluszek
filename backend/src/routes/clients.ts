import { Router } from 'express';
import { db } from '../services/firebase';
import { Client } from '../types';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const COLLECTION = 'clients';

router.use(verifyToken);

// ==========================================
// SCHEMATY WALIDACJI ZOD (BEZPIECZEŃSTWO PEŁNE)
// ==========================================
const AddressSchema = z.object({
  province: z.string().optional().default(''),
  zipCode: z.string().optional().default(''),
  city: z.string().optional().default(''),
  street: z.string().optional().default(''),
  number: z.string().optional().default(''),
});

const ClientSchema = z.object({
  companyName: z.string().min(1, 'Nazwa firmy jest absolutnie wymagana').max(200),
  type: z.enum(['hurt', 'sklep']), // P2-2: Przywrócono twardy enum
  contactPerson: z.string().optional().default(''),
  email: z.union([z.string().email('Niepoprawny format e-mail'), z.literal('')]).optional().default(''), // P2-3: Walidacja e-mail
  phone: z.string().optional().default(''),
  address: AddressSchema,
});

// P2-1: Walidacja dla nowych interakcji
const InteractionSchema = z.object({
  contactDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format daty: YYYY-MM-DD'),
  channel: z.enum(['telefon', 'mail', 'spotkanie', 'inne']),
  notes: z.string().min(1, 'Notatka jest wymagana').max(2000),
  tradeNotes: z.string().optional().default(''),
  products: z.array(z.string()).optional().default([]),
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

router.post('/', async (req: AuthRequest, res) => {
  try {
    const parsed = ClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const newClient: Omit<Client, 'id'> = {
      companyName: parsed.data.companyName,
      type: parsed.data.type,
      contactPerson: parsed.data.contactPerson,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await db.collection(COLLECTION).add(newClient);
    res.status(201).json({ id: docRef.id, ...newClient });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się dodać klienta' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const parsed = ClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const updateData = { 
      companyName: parsed.data.companyName,
      type: parsed.data.type,
      contactPerson: parsed.data.contactPerson,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || 'Nieznany' // J1: Ślad autora edycji
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

router.post('/:id/interactions', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // P2-1: Walidacja nowej interakcji
    const parsed = InteractionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const createdBy = req.user?.email || 'Nieznany użytkownik'; // J2: Użycie req.user bez "any"

    const newInteraction = {
      ...parsed.data,
      createdBy,
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection(COLLECTION).doc(id).collection('interactions').add(newInteraction);
    
    await db.collection(COLLECTION).doc(id).update({
      lastContactAt: parsed.data.contactDate || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.status(201).json({ id: docRef.id, ...newInteraction });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zapisać kontaktu' });
  }
});

export default router;