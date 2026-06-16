import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../services/firebase';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { EmailTemplate } from '../types';
import { sendEmail } from '../services/gmail';

const router = Router();
router.use(verifyToken);

const COLLECTION = 'emailTemplates';

const TemplateSchema = z.object({
  name: z.string().min(1, 'Nazwa szablonu jest wymagana'),
  category: z.string().min(1, 'Kategoria jest wymagana'),
  subject: z.string().min(1, 'Temat maila jest wymagany'),
  body: z.string().min(1, 'Treść szablonu jest wymagana'),
});

const SendSchema = z.object({
  to: z.string().email('Nieprawidłowy adres email'),
  subject: z.string().min(1, 'Temat jest wymagany'),
  body: z.string().min(1, 'Treść jest wymagana'),
});

// GET /api/email-templates — lista szablonów (najnowsze na górze)
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const snapshot = await db.collection(COLLECTION).orderBy('createdAt', 'desc').get();
    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(templates);
  } catch (error) {
    console.error('[email-templates] GET / błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się pobrać szablonów maili' });
  }
});

// POST /api/email-templates — nowy szablon
router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = TemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const now = new Date().toISOString();
  const templateData: Omit<EmailTemplate, 'id'> = {
    ...parsed.data,
    createdBy: req.user?.email || 'system',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = await db.collection(COLLECTION).add(templateData);
    res.status(201).json({ id: docRef.id, ...templateData });
  } catch (error) {
    console.error('[email-templates] POST / błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się zapisać szablonu' });
  }
});

// PUT /api/email-templates/:id — aktualizacja szablonu
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = TemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { id } = req.params;
  const now = new Date().toISOString();

  try {
    const docRef = db.collection(COLLECTION).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Szablon nie istnieje' });
      return;
    }
    await docRef.update({ ...parsed.data, updatedAt: now });
    res.json({ id, ...snap.data(), ...parsed.data, updatedAt: now });
  } catch (error) {
    console.error('[email-templates] PUT /:id błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się zaktualizować szablonu' });
  }
});

// DELETE /api/email-templates/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await db.collection(COLLECTION).doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('[email-templates] DELETE /:id błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się usunąć szablonu' });
  }
});

// POST /api/email-templates/:id/send — wyślij gotowy mail (subject/body już z podstawionymi danymi klienta)
router.post('/:id/send', async (req: AuthRequest, res: Response) => {
  const parsed = SendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { to, subject, body } = parsed.data;

  const htmlBody = `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <tr><td style="background:#2563eb;padding:28px 36px">
          <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px">Pluszek</div>
        </td></tr>

        <tr><td style="padding:32px 36px;color:#334155;font-size:15px;line-height:1.8">
          ${body.replace(/\n/g, '<br>')}
        </td></tr>

        <tr><td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#94a3b8">
            Z poważaniem,<br>
            <strong style="color:#334155">Zespół Pluszek</strong>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await sendEmail({ to, subject, htmlBody });
    res.json({ success: true, message: 'Mail wysłany' });
  } catch (error) {
    console.error('[email-templates] POST /:id/send błąd wysyłki:', error);
    const message = error instanceof Error ? error.message : 'Błąd wysyłki maila';
    res.status(500).json({ error: message });
  }
});

export default router;
