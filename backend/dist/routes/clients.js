"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_1 = require("../services/firebase");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const COLLECTION = 'clients';
router.use(auth_1.verifyToken);
// ==========================================
// SCHEMATY WALIDACJI ZOD (BEZPIECZEŃSTWO PEŁNE)
// ==========================================
const AddressSchema = zod_1.z.object({
    province: zod_1.z.string().optional().default(''),
    zipCode: zod_1.z.string().optional().default(''),
    city: zod_1.z.string().optional().default(''),
    street: zod_1.z.string().optional().default(''),
    number: zod_1.z.string().optional().default(''),
});
const ClientSchema = zod_1.z.object({
    companyName: zod_1.z.string().min(1, 'Nazwa firmy jest absolutnie wymagana').max(200),
    type: zod_1.z.enum(['hurt', 'sklep']), // P2-2: Przywrócono twardy enum
    contactPerson: zod_1.z.string().optional().default(''),
    email: zod_1.z.union([zod_1.z.string().email('Niepoprawny format e-mail'), zod_1.z.literal('')]).optional().default(''), // P2-3: Walidacja e-mail
    phone: zod_1.z.string().optional().default(''),
    address: AddressSchema,
});
// P2-1: Walidacja dla nowych interakcji
const InteractionSchema = zod_1.z.object({
    contactDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format daty: YYYY-MM-DD'),
    channel: zod_1.z.enum(['telefon', 'mail', 'spotkanie', 'inne']),
    notes: zod_1.z.string().min(1, 'Notatka jest wymagana').max(2000),
    tradeNotes: zod_1.z.string().optional().default(''),
    products: zod_1.z.array(zod_1.z.string()).optional().default([]),
});
// ==========================================
// SEKCJA 1: ZARZĄDZANIE KLIENTAMI
// ==========================================
router.get('/', async (req, res) => {
    try {
        const snapshot = await firebase_1.db.collection(COLLECTION).orderBy('companyName').get();
        const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(clients);
    }
    catch (error) {
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
router.post('/', async (req, res) => {
    try {
        const parsed = ClientSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
        const newClient = {
            companyName: parsed.data.companyName,
            type: parsed.data.type,
            contactPerson: parsed.data.contactPerson,
            email: parsed.data.email,
            phone: parsed.data.phone,
            address: parsed.data.address,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const docRef = await firebase_1.db.collection(COLLECTION).add(newClient);
        res.status(201).json({ id: docRef.id, ...newClient });
    }
    catch (error) {
        res.status(500).json({ error: 'Nie udało się dodać klienta' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const parsed = ClientSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
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
        await firebase_1.db.collection(COLLECTION).doc(id).update(updateData);
        res.json({ id, ...updateData });
    }
    catch (error) {
        res.status(500).json({ error: 'Nie udało się zaktualizować danych' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await firebase_1.db.collection(COLLECTION).doc(id).delete();
        res.json({ message: 'Klient usunięty' });
    }
    catch (error) {
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
// ==========================================
// SEKCJA 2: HISTORIA KONTAKTÓW (INTERAKCJE)
// ==========================================
router.get('/:id/interactions', async (req, res) => {
    try {
        const { id } = req.params;
        const snapshot = await firebase_1.db.collection(COLLECTION).doc(id).collection('interactions').orderBy('contactDate', 'desc').get();
        const interactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(interactions);
    }
    catch (error) {
        res.status(500).json({ error: 'Nie udało się pobrać historii kontaktów' });
    }
});
router.post('/:id/interactions', async (req, res) => {
    try {
        const { id } = req.params;
        // P2-1: Walidacja nowej interakcji
        const parsed = InteractionSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
        const createdBy = req.user?.email || 'Nieznany użytkownik'; // J2: Użycie req.user bez "any"
        const newInteraction = {
            ...parsed.data,
            createdBy,
            createdAt: new Date().toISOString()
        };
        const docRef = await firebase_1.db.collection(COLLECTION).doc(id).collection('interactions').add(newInteraction);
        await firebase_1.db.collection(COLLECTION).doc(id).update({
            lastContactAt: parsed.data.contactDate || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        res.status(201).json({ id: docRef.id, ...newInteraction });
    }
    catch (error) {
        res.status(500).json({ error: 'Nie udało się zapisać kontaktu' });
    }
});
exports.default = router;
