"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_1 = require("../services/firebase");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const COLLECTION = 'followups';
router.use(auth_1.verifyToken);
// P2-1: Schematy walidacji dla zadań
const FollowUpSchema = zod_1.z.object({
    clientName: zod_1.z.string().min(1),
    dueDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    reminderText: zod_1.z.string().optional().default(''),
});
const StatusSchema = zod_1.z.enum(['zrealizowane', 'przesunięte']);
router.get('/summary', async (req, res) => {
    try {
        const snapshot = await firebase_1.db.collection(COLLECTION).where('status', '==', 'zaplanowane').get();
        const followups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const today = new Date().toISOString().split('T')[0];
        const summary = followups
            .filter((f) => f.dueDate <= today)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        res.json(summary);
    }
    catch (error) {
        res.status(500).json({ error: 'Nie udało się pobrać przypomnień' });
    }
});
router.post('/client/:clientId', async (req, res) => {
    try {
        const { clientId } = req.params;
        // Walidacja przypomnienia
        const parsed = FollowUpSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
        const newFollowup = {
            ...parsed.data,
            clientId,
            status: 'zaplanowane',
            createdAt: new Date().toISOString()
        };
        const docRef = await firebase_1.db.collection(COLLECTION).add(newFollowup);
        res.status(201).json({ id: docRef.id, ...newFollowup });
    }
    catch (error) {
        res.status(500).json({ error: 'Nie udało się zaplanować kontaktu' });
    }
});
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        // Walidacja statusu
        const parsed = StatusSchema.safeParse(req.body.status);
        if (!parsed.success)
            return res.status(400).json({ error: 'Nieprawidłowy status' });
        const updateData = {
            status: parsed.data,
            completedAt: parsed.data === 'zrealizowane' ? new Date().toISOString() : null,
            updatedAt: new Date().toISOString()
        };
        await firebase_1.db.collection(COLLECTION).doc(id).update(updateData);
        res.json({ id, ...updateData });
    }
    catch (error) {
        res.status(500).json({ error: 'Błąd podczas zmiany statusu zadania' });
    }
});
exports.default = router;
