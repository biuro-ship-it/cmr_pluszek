import { Router, Response } from 'express';
import { verifyToken, AuthRequest } from '../middleware/auth';
import {
  isFakturowniaConfigured,
  getClientByNip,
  getInvoicesByClientId,
  getInvoicePdf,
  getInvoiceStats,
  getAllSalesInvoices,
} from '../services/fakturownia';
import {
  groupInvoicesByNip,
  invoiceNumberFromNote,
  normalizeVat,
  planBulkSync,
  SyncClient,
} from '../services/fakturowniaSync';
import { db } from '../services/firebase';

const router = Router();
router.use(verifyToken);

// Hurtowa aktualizacja: wszystkie faktury sprzedaży → klienci CRM dopasowani po NIP.
// Każda nowa faktura trafia do Historii Kontaktów (jak przycisk na karcie klienta).
router.post('/sync-all', async (req: AuthRequest, res: Response) => {
  if (!isFakturowniaConfigured()) {
    res.status(503).json({ error: 'Integracja z Fakturownią nie jest skonfigurowana (brak FAKTUROWNIA_DOMAIN/TOKEN).' });
    return;
  }
  try {
    const invoices = await getAllSalesInvoices();
    const snapshot = await db.collection('clients').get();
    const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as SyncClient);

    // Numery faktur już obecne w historii — czytamy tylko klientów, którzy mają faktury.
    const { byNip } = groupInvoicesByNip(invoices);
    const matched = clients.filter(c => byNip.has(normalizeVat(c.nip)));
    const existingNumbers = new Map<string, Set<string>>();
    await Promise.all(matched.map(async c => {
      const hist = await db.collection('clients').doc(c.id).collection('interactions').get();
      existingNumbers.set(c.id, new Set(
        hist.docs.map(d => invoiceNumberFromNote(d.get('notes'))).filter(Boolean),
      ));
    }));

    const now = new Date().toISOString();
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date());
    const { updates, summary } = planBulkSync(clients, invoices, existingNumbers, now, today);

    // Firestore: max 500 operacji w jednym batchu. Przerwany zapis można bezpiecznie
    // powtórzyć — wpisy są deduplikowane po numerze faktury.
    const createdBy = req.user?.email || 'Fakturownia';
    const LIMIT = 400;
    let batch = db.batch();
    let ops = 0;
    const count = async () => {
      if (++ops >= LIMIT) { await batch.commit(); batch = db.batch(); ops = 0; }
    };
    for (const u of updates) {
      const ref = db.collection('clients').doc(u.id);
      for (const i of u.newInteractions) {
        batch.set(ref.collection('interactions').doc(), { ...i, createdBy, createdAt: now });
        await count();
      }
      batch.update(ref, u.data);
      await count();
    }
    if (ops > 0) await batch.commit();

    res.json(summary);
  } catch (err) {
    console.error('Fakturownia sync-all error:', err);
    res.status(502).json({ error: 'Błąd hurtowej aktualizacji z Fakturowni.' });
  }
});

// Analityka obrotu — agregacja faktur z całej Fakturowni po firmach.
router.get('/stats', async (req: AuthRequest, res: Response) => {
  if (!isFakturowniaConfigured()) {
    res.status(503).json({ error: 'Integracja z Fakturownią nie jest skonfigurowana.' });
    return;
  }
  const allowed = new Set(['all', 'this_year', 'last_year', 'this_month', 'last_month']);
  const q = String(req.query.period || 'all');
  const period = allowed.has(q) ? q : 'all';
  try {
    const stats = await getInvoiceStats(period);
    res.json(stats);
  } catch (err) {
    console.error('Fakturownia stats error:', err);
    res.status(502).json({ error: 'Błąd pobierania statystyk z Fakturowni.' });
  }
});

// Klient + jego faktury po NIP (tylko odczyt z Fakturowni).
router.get('/lookup/:nip', async (req: AuthRequest, res: Response) => {
  if (!isFakturowniaConfigured()) {
    res.status(503).json({ error: 'Integracja z Fakturownią nie jest skonfigurowana (brak FAKTUROWNIA_DOMAIN/TOKEN).' });
    return;
  }
  // Akceptujemy też zagraniczne numery VAT (np. czeskie „CZ…"), nie tylko 10-cyfrowy PL NIP.
  const nipClean = req.params.nip.replace(/[-\s]/g, '');
  if (!/^[A-Za-z0-9]{5,20}$/.test(nipClean)) {
    res.status(400).json({ error: 'Nieprawidłowy numer NIP/VAT.' });
    return;
  }
  try {
    const client = await getClientByNip(nipClean);
    if (!client) {
      res.status(404).json({ error: 'Nie znaleziono klienta o tym NIP w Fakturowni.' });
      return;
    }
    const invoices = await getInvoicesByClientId(client.id);
    res.json({ client, invoices });
  } catch (err) {
    console.error('Fakturownia lookup error:', err);
    res.status(502).json({ error: 'Błąd komunikacji z Fakturownią.' });
  }
});

// Proxy PDF faktury — token zostaje po stronie serwera.
router.get('/invoice/:id/pdf', async (req: AuthRequest, res: Response) => {
  if (!isFakturowniaConfigured()) {
    res.status(503).json({ error: 'Integracja z Fakturownią nie jest skonfigurowana.' });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Nieprawidłowe ID faktury.' });
    return;
  }
  try {
    const pdf = await getInvoicePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="faktura-${id}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('Fakturownia PDF error:', err);
    res.status(502).json({ error: 'Nie udało się pobrać PDF z Fakturowni.' });
  }
});

export default router;
