import { Router } from 'express';
import { db } from '../services/firebase';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const COLLECTION = 'clients';

router.use(verifyToken);

// ==========================================
// SCHEMATY WALIDACJI ZOD
// ==========================================
const AddressSchema = z.object({
  province: z.string().optional().default(''),
  zipCode: z.string().optional().default(''),
  city: z.string().optional().default(''),
  street: z.string().optional().default(''),
  number: z.string().optional().default(''),
});

const ClientFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  size: z.string().optional(),
  uploadedAt: z.string(),
});

const ClientSchema = z.object({
  companyName: z.string().min(1, 'Nazwa firmy jest wymagana').max(200),
  type: z.enum(['hurt', 'sklep']),
  nip: z.string().optional().default(''),
  contactPerson: z.string().optional().default(''),
  email: z.union([z.string().email('Niepoprawny format e-mail'), z.literal('')]).optional().default(''),
  phone: z.string().optional().default(''),
  address: AddressSchema,
  shippingAddress: AddressSchema.optional(),
  relationshipColor: z.string().optional().default('slate'), // DODANE: obsługa koloru relacji
  files: z.array(ClientFileSchema).optional().default([]),   // załączone dokumenty
});

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

router.get('/', async (_req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION).orderBy('companyName').get();
    const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(clients);
  } catch (error) {
    console.error('[clients] GET / błąd Firestore:', error);
    res.status(500).json({ error: 'Błąd serwera', detail: String(error) });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const parsed = ClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const now = new Date().toISOString();
    const newClient = {
      companyName: parsed.data.companyName,
      type: parsed.data.type,
      nip: parsed.data.nip,
      contactPerson: parsed.data.contactPerson,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      relationshipColor: parsed.data.relationshipColor, // DODANE: Zapis koloru do bazy
      files: parsed.data.files,                          // DODANE: załączone dokumenty
      ...(parsed.data.shippingAddress ? { shippingAddress: parsed.data.shippingAddress } : {}),
      createdAt: now,
      updatedAt: now,
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
      nip: parsed.data.nip,
      contactPerson: parsed.data.contactPerson,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      relationshipColor: parsed.data.relationshipColor, // DODANE: Zapis koloru do bazy
      files: parsed.data.files,                          // DODANE: załączone dokumenty
      ...(parsed.data.shippingAddress ? { shippingAddress: parsed.data.shippingAddress } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || 'Nieznany',
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
    const snapshot = await db
      .collection(COLLECTION)
      .doc(id)
      .collection('interactions')
      .orderBy('contactDate', 'desc')
      .get();
    const interactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(interactions);
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się pobrać historii kontaktów' });
  }
});

router.post('/:id/interactions', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const parsed = InteractionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const createdBy = req.user?.email || 'Nieznany użytkownik';
    const now = new Date().toISOString();

    const newInteraction = {
      ...parsed.data,
      createdBy,
      createdAt: now,
    };

    const docRef = await db
      .collection(COLLECTION)
      .doc(id)
      .collection('interactions')
      .add(newInteraction);

    await db.collection(COLLECTION).doc(id).update({
      lastContactAt: parsed.data.contactDate || now,
      updatedAt: now,
    });

    res.status(201).json({ id: docRef.id, ...newInteraction });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zapisać kontaktu' });
  }
});

// Aktualizacja istniejącej notatki
router.put('/:id/interactions/:interactionId', async (req: AuthRequest, res) => {
  try {
    const { id, interactionId } = req.params;
    const parsed = InteractionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const updateData = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.email || 'Nieznany',
    };

    await db
      .collection(COLLECTION)
      .doc(id)
      .collection('interactions')
      .doc(interactionId)
      .update(updateData);

    res.json({ id: interactionId, ...updateData });
  } catch (error) {
    res.status(500).json({ error: 'Nie udało się zaktualizować notatki' });
  }
});

export default router;