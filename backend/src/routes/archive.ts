import { Router, Response } from 'express';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { db } from '../services/firebase';

const router = Router();
router.use(verifyToken);

type AnyDoc = Record<string, any>;
const docsToObjects = (snap: FirebaseFirestore.QuerySnapshot): AnyDoc[] =>
  snap.docs.map(d => ({ id: d.id, ...d.data() }));

// GET /api/archive — pełna kopia wszystkich danych (do pobrania na komputer).
// Podkolekcje (interactions, movements) pobieramy przez collectionGroup zamiast
// pętli N+1. UWAGA: collectionGroup jest globalny po NAZWIE — nazwy 'interactions'
// i 'movements' występują w tym projekcie wyłącznie pod clients/* i foam_stock/*.
// Nie używamy orderBy w collectionGroup, by nie wymuszać composite indexu —
// sortujemy w pamięci.
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [
      clientsSnap, productsSnap, promotionsSnap, notesSnap,
      foamSnap, followupsSnap, interactionsSnap, movementsSnap,
    ] = await Promise.all([
      db.collection('clients').orderBy('companyName').get(),
      db.collection('products').orderBy('name').get(),
      db.collection('promotions').get(),
      db.collection('notes').get(),
      db.collection('foam_stock').orderBy('sortOrder').get(),
      db.collection('followups').get(),
      db.collectionGroup('interactions').get(),
      db.collectionGroup('movements').get(),
    ]);

    const clients = docsToObjects(clientsSnap);
    const products = docsToObjects(productsSnap);
    const promotions = docsToObjects(promotionsSnap);
    const notes = docsToObjects(notesSnap);
    const foamStock = docsToObjects(foamSnap);
    const followups = docsToObjects(followupsSnap);

    // Mapy nazw do wzbogacenia rekordów z podkolekcji o czytelną referencję.
    const clientNameById = new Map(clients.map(c => [c.id, c.companyName]));
    const foamNameById = new Map(foamStock.map(f => [f.id, f.name]));

    const interactions = interactionsSnap.docs
      .map(d => {
        const clientId = d.ref.parent.parent?.id ?? null;
        return {
          id: d.id,
          clientId,
          clientName: clientId ? (clientNameById.get(clientId) ?? '') : '',
          ...d.data(),
        };
      })
      .sort((a: any, b: any) => String(b.contactDate ?? '').localeCompare(String(a.contactDate ?? '')));

    const foamMovements = movementsSnap.docs
      .map(d => {
        const foamId = d.ref.parent.parent?.id ?? null;
        return {
          id: d.id,
          foamId,
          foamName: foamId ? (foamNameById.get(foamId) ?? '') : '',
          ...d.data(),
        };
      })
      .sort((a: any, b: any) => String(b.at ?? '').localeCompare(String(a.at ?? '')));

    res.json({
      meta: {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user?.email ?? 'nieznany',
        version: 1,
        counts: {
          clients: clients.length,
          interactions: interactions.length,
          products: products.length,
          promotions: promotions.length,
          notes: notes.length,
          foamStock: foamStock.length,
          foamMovements: foamMovements.length,
          followups: followups.length,
        },
      },
      clients,
      interactions,
      products,
      promotions,
      notes,
      foamStock,
      foamMovements,
      followups,
    });
  } catch (error) {
    console.error('[archive] GET / błąd Firestore:', error);
    res.status(500).json({ error: 'Nie udało się przygotować archiwum', detail: String(error) });
  }
});

export default router;
