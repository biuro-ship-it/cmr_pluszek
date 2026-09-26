// Hurtowa aktualizacja klientów z Fakturowni — czysta logika (bez Firebase),
// żeby dało się ją przetestować. Zasady te same co przy przycisku na karcie klienta:
// każda faktura trafia do Historii Kontaktów jako wpis „🧾 Faktura {nr}: {netto} zł netto"
// (dedup po numerze), dane kontaktowe uzupełniamy tylko gdy są puste.

import { FakturowniaInvoice, FakturowniaSalesInvoice } from './fakturownia';

export interface SyncClient {
  id: string;
  companyName?: string;
  nip?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  lastContactAt?: string | null;
}

export interface NewInteraction {
  contactDate: string;
  channel: 'inne';
  notes: string;
  tradeNotes: string;
  products: string[];
}

export interface ClientSyncUpdate {
  id: string;
  data: Record<string, unknown>;
  newInteractions: NewInteraction[];
}

export interface BulkSyncSummary {
  invoicesFetched: number;
  invoicesMatched: number;
  invoicesWithoutNip: number;       // np. osoby prywatne
  updatedClients: number;           // klienci z fakturami (odświeżona lista faktur)
  newInteractions: number;          // nowe wpisy w Historii Kontaktów
  noNip: string[];                  // klienci CRM bez NIP
  noInvoices: string[];             // klienci z NIP, bez faktur w Fakturowni
  unmatchedBuyers: { nip: string; name: string; count: number }[]; // nabywcy spoza CRM
}

export interface BulkSyncPlan {
  updates: ClientSyncUpdate[];
  summary: BulkSyncSummary;
}

/**
 * Klucz dopasowania NIP/VAT: wielkie litery, bez myślników i spacji, bez prefiksu kraju
 * („PL…", „CZ…") — w Fakturowni ten sam nabywca bywa raz z prefiksem, raz bez.
 * Pusty string, gdy numer jest za krótki.
 */
export const normalizeVat = (v: string | undefined): string => {
  const key = (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^[A-Z]{2}(?=\d)/, '');
  return key.length >= 5 ? key : '';
};

/** Numer faktury z wpisu w historii (ten sam wzorzec co w ClientCard). */
export const invoiceNumberFromNote = (notes: string | undefined): string =>
  notes?.match(/Faktura\s+(.+?):/)?.[1]?.trim() || '';

export const invoiceNote = (inv: FakturowniaInvoice): string =>
  `🧾 Faktura ${inv.number}: ${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(inv.priceNet)} zł netto`;

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const stripBuyer = (inv: FakturowniaSalesInvoice): FakturowniaInvoice => ({
  id: inv.id,
  number: inv.number,
  issueDate: inv.issueDate,
  sellDate: inv.sellDate,
  paymentTo: inv.paymentTo,
  priceNet: inv.priceNet,
  priceGross: inv.priceGross,
  currency: inv.currency,
  status: inv.status,
  kind: inv.kind,
});

/** Faktury pogrupowane po kluczu NIP nabywcy. */
export const groupInvoicesByNip = (invoices: FakturowniaSalesInvoice[]) => {
  const byNip = new Map<string, FakturowniaSalesInvoice[]>();
  let withoutNip = 0;
  for (const inv of invoices) {
    const nip = normalizeVat(inv.buyerTaxNo);
    if (!nip) { withoutNip++; continue; }
    const list = byNip.get(nip);
    if (list) list.push(inv); else byNip.set(nip, [inv]);
  }
  return { byNip, withoutNip };
};

/**
 * @param existingNumbers numery faktur już obecne w historii danego klienta (klucz: id klienta)
 * @param now   znacznik czasu ISO zapisu
 * @param today data „dziś" (YYYY-MM-DD, Europe/Warsaw) — dla faktur bez daty wystawienia
 */
export const planBulkSync = (
  clients: SyncClient[],
  invoices: FakturowniaSalesInvoice[],
  existingNumbers: Map<string, Set<string>>,
  now: string,
  today: string,
): BulkSyncPlan => {
  const { byNip, withoutNip } = groupInvoicesByNip(invoices);

  const updates: ClientSyncUpdate[] = [];
  const noNip: string[] = [];
  const noInvoices: string[] = [];
  const crmNips = new Set<string>();
  let invoicesMatched = 0;
  let newInteractionsCount = 0;

  for (const client of clients) {
    const name = client.companyName || client.id;
    const nip = normalizeVat(client.nip);
    if (!nip) { noNip.push(name); continue; }
    crmNips.add(nip);
    const list = byNip.get(nip);
    if (!list) { noInvoices.push(name); continue; }

    // Najnowsze u góry — jak przy pobieraniu z karty klienta
    const sorted = [...list].sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));

    const seen = new Set(existingNumbers.get(client.id) ?? []);
    const newInteractions: NewInteraction[] = [];
    for (const inv of sorted) {
      if (!inv.number || seen.has(inv.number)) continue;
      seen.add(inv.number);
      newInteractions.push({
        contactDate: /^\d{4}-\d{2}-\d{2}$/.test(inv.issueDate) ? inv.issueDate : today,
        channel: 'inne',
        notes: invoiceNote(inv),
        tradeNotes: '',
        products: [],
      });
    }

    const data: Record<string, unknown> = {
      fakturowniaInvoices: sorted.map(stripBuyer),
      fakturowniaSyncedAt: now,
    };

    // „Ostatni kontakt" tylko do przodu — zaległa faktura nie może go cofnąć.
    const newest = newInteractions.reduce((m, i) => (i.contactDate > m ? i.contactDate : m), '');
    const current = (client.lastContactAt || '').slice(0, 10);
    if (newest && newest > current) data.lastContactAt = newest;
    if (newInteractions.length > 0) data.updatedAt = now;

    const firstNonEmpty = (pick: (i: FakturowniaSalesInvoice) => string, ok: (v: string) => boolean = () => true) =>
      sorted.map(i => pick(i).trim()).find(v => v !== '' && ok(v)) || '';
    if (!client.email) {
      const v = firstNonEmpty(i => i.buyerEmail, v => EMAIL_RE.test(v));
      if (v) data.email = v;
    }
    if (!client.phone) {
      const v = firstNonEmpty(i => i.buyerPhone);
      if (v) data.phone = v;
    }
    if (!client.contactPerson) {
      const v = firstNonEmpty(i => i.buyerPerson);
      if (v) data.contactPerson = v;
    }

    updates.push({ id: client.id, data, newInteractions });
    invoicesMatched += list.length;
    newInteractionsCount += newInteractions.length;
  }

  const unmatchedBuyers = Array.from(byNip.entries())
    .filter(([nip]) => !crmNips.has(nip))
    .map(([nip, list]) => ({ nip, name: list[0].buyerName, count: list.length }))
    .sort((a, b) => b.count - a.count);

  return {
    updates,
    summary: {
      invoicesFetched: invoices.length,
      invoicesMatched,
      invoicesWithoutNip: withoutNip,
      updatedClients: updates.length,
      newInteractions: newInteractionsCount,
      noNip,
      noInvoices,
      unmatchedBuyers,
    },
  };
};
