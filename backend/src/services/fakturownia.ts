// Serwis integracji z Fakturownią (tylko odczyt).
// Token i subdomena pochodzą z .env — nigdy nie trafiają do frontendu.
//   FAKTUROWNIA_DOMAIN=pluszek        (subdomena: pluszek.fakturownia.pl)
//   FAKTUROWNIA_TOKEN=xxxxxxxxxxxxxxx (Ustawienia → Konto → Integracja → Kod API)

import { isPluszekInvoice, normalizeVat } from './fakturowniaSync';

// Czytamy env leniwie (w funkcjach), bo dotenv.config() w index.ts wykonuje się
// PO zaimportowaniu tego modułu — odczyt na górze złapałby puste wartości.
const getDomain = (): string => process.env.FAKTUROWNIA_DOMAIN || '';
const getToken = (): string => process.env.FAKTUROWNIA_TOKEN || '';

export const isFakturowniaConfigured = (): boolean => Boolean(getDomain() && getToken());

const baseUrl = (): string => `https://${getDomain()}.fakturownia.pl`;

export interface FakturowniaClient {
  id: number;
  name: string;
  taxNo: string;
  email: string;
  phone: string;
  person: string;
  street: string;
  city: string;
  postCode: string;
  bankAccount: string;
}

export interface FakturowniaInvoice {
  id: number;
  number: string;
  issueDate: string;
  sellDate: string;
  paymentTo: string;
  priceNet: number;
  priceGross: number;
  currency: string;
  status: string; // np. issued / sent / paid / partial
  kind: string;   // np. vat, proforma, correction
}

const toNumber = (v: unknown): number => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Znajduje klienta w Fakturowni po NIP (tax_no). Zwraca pierwszego pasującego lub null. */
export const getClientByNip = async (nip: string): Promise<FakturowniaClient | null> => {
  const nipClean = nip.replace(/[-\s]/g, '');
  const url = `${baseUrl()}/clients.json?tax_no=${encodeURIComponent(nipClean)}&api_token=${getToken()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Fakturownia clients: ${res.status}`);
  const arr = (await res.json()) as any[];
  const c = Array.isArray(arr) ? arr[0] : null;
  if (!c) return null;
  return {
    id: c.id,
    name: c.name || '',
    taxNo: c.tax_no || '',
    email: c.email || '',
    phone: c.phone || '',
    person: c.person || '',
    street: c.street || '',
    city: c.city || '',
    postCode: c.post_code || '',
    bankAccount: c.bank_account || '',
  };
};

/** Faktury Pluszka danego klienta (po client_id, tylko materace), z paginacją (per_page=100, max 5 stron). */
export const getInvoicesByClientId = async (clientId: number): Promise<FakturowniaInvoice[]> => {
  const all: FakturowniaInvoice[] = [];
  const MAX_PAGES = 5;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${baseUrl()}/invoices.json?client_id=${clientId}&include_positions=true&page=${page}&per_page=100&api_token=${getToken()}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Fakturownia invoices: ${res.status}`);
    const arr = (await res.json()) as any[];
    if (!Array.isArray(arr) || arr.length === 0) break;
    for (const inv of arr) {
      if (!isPluszekInvoice(inv.positions)) continue;
      all.push({
        id: inv.id,
        number: inv.number || '',
        issueDate: inv.issue_date || '',
        sellDate: inv.sell_date || '',
        paymentTo: inv.payment_to || '',
        priceNet: toNumber(inv.price_net),
        priceGross: toNumber(inv.price_gross),
        currency: inv.currency || 'PLN',
        status: inv.status || '',
        kind: inv.kind || '',
      });
    }
    if (arr.length < 100) break;
  }
  // Najnowsze u góry
  all.sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
  return all;
};

/** Faktura z danymi nabywcy — do hurtowego dopasowania po NIP. */
export interface FakturowniaSalesInvoice extends FakturowniaInvoice {
  buyerTaxNo: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerPerson: string;
}

/**
 * Wszystkie faktury sprzedaży Pluszka z konta za okres (domyślnie period=all), strona po stronie.
 * Faktury kosztowe (income=0) i faktury bez materacy (ramy, antyramy…) pomijamy. Przy przekroczeniu
 * bezpiecznika rzucamy błąd, żeby nie zapisać klientom niepełnej listy.
 */
export const getAllSalesInvoices = async (period = 'all'): Promise<FakturowniaSalesInvoice[]> => {
  const byId = new Map<number, FakturowniaSalesInvoice>();
  const MAX_PAGES = 200; // 20 000 faktur
  for (let page = 1; ; page++) {
    if (page > MAX_PAGES) throw new Error('Fakturownia: zbyt wiele faktur do pobrania naraz');
    const url = `${baseUrl()}/invoices.json?period=${encodeURIComponent(period)}&include_positions=true&page=${page}&per_page=100&api_token=${getToken()}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Fakturownia invoices: ${res.status}`);
    const arr = (await res.json()) as any[];
    if (!Array.isArray(arr) || arr.length === 0) break;
    for (const inv of arr) {
      if (inv.income === false || String(inv.income) === '0') continue;
      if (!isPluszekInvoice(inv.positions)) continue;
      byId.set(inv.id, {
        id: inv.id,
        number: inv.number || '',
        issueDate: inv.issue_date || '',
        sellDate: inv.sell_date || '',
        paymentTo: inv.payment_to || '',
        priceNet: toNumber(inv.price_net),
        priceGross: toNumber(inv.price_gross),
        currency: inv.currency || 'PLN',
        status: inv.status || '',
        kind: inv.kind || '',
        buyerTaxNo: inv.buyer_tax_no || '',
        buyerName: inv.buyer_name || '',
        buyerEmail: inv.buyer_email || '',
        buyerPhone: inv.buyer_phone || '',
        buyerPerson: inv.buyer_person || '',
      });
    }
    if (arr.length < 100) break;
  }
  return Array.from(byId.values());
};

export interface FakturowniaCompanyStat {
  key: string;
  name: string;
  nip: string;
  net: number;
  count: number;
  avg: number;
  min: number;
  max: number;
  lastIssueDate: string;
}

export interface FakturowniaStats {
  period: string;
  category: string;
  totalNet: number;
  invoiceCount: number;
  companyCount: number;
  companies: FakturowniaCompanyStat[];
  byYear: { year: string; net: number; count: number }[];
}

// Rodzaje pomijane w obrocie (to nie sprzedaż): proformy i wyceny/szacunki.
const EXCLUDED_KINDS = new Set(['proforma', 'estimate', 'client_order', 'kp', 'kw']);

// Etykieta zakresu analiz (pole `category` w odpowiedzi — pokazywane w panelu).
const STATS_SCOPE = 'materace MAXI/MIDI';

/**
 * Obrót z materacy za dany okres (period: all/this_year/last_year/…) — wszystkie faktury Pluszka
 * z konta (te same co przy pobieraniu hurtowym), bez względu na kategorię klienta w Fakturowni.
 * Obrót NETTO, proformy i wyceny pomijane. Grupowanie po NIP nabywcy (bez prefiksu kraju).
 */
export const getInvoiceStats = async (period: string): Promise<FakturowniaStats> => {
  const invoices = (await getAllSalesInvoices(period)).filter(inv => !EXCLUDED_KINDS.has(inv.kind));

  const years = new Map<string, { net: number; count: number }>();
  const byCompany = new Map<string, FakturowniaCompanyStat>();
  for (const inv of invoices) {
    const nip = normalizeVat(inv.buyerTaxNo);
    const key = nip || `name:${inv.buyerName.trim().toUpperCase()}`;
    const n = inv.priceNet;
    const c = byCompany.get(key) ?? {
      key, name: '', nip, net: 0, count: 0, avg: 0, min: Infinity, max: -Infinity, lastIssueDate: '',
    };
    c.net += n; c.count += 1;
    c.min = Math.min(c.min, n); c.max = Math.max(c.max, n);
    // Nazwa z najnowszej faktury
    if (inv.issueDate >= c.lastIssueDate) { c.lastIssueDate = inv.issueDate; c.name = inv.buyerName.trim() || '(brak nazwy)'; }
    byCompany.set(key, c);

    const y = inv.issueDate.slice(0, 4) || '—';
    const yr = years.get(y) ?? { net: 0, count: 0 };
    yr.net += n; yr.count += 1; years.set(y, yr);
  }

  const companies = [...byCompany.values()]
    .map(c => ({ ...c, avg: c.count ? c.net / c.count : 0 }))
    .sort((a, b) => b.net - a.net);
  const totalNet = companies.reduce((s, c) => s + c.net, 0);
  const byYear = [...years.entries()]
    .map(([year, v]) => ({ year, net: v.net, count: v.count }))
    .sort((a, b) => b.year.localeCompare(a.year));

  return { period, category: STATS_SCOPE, totalNet, invoiceCount: invoices.length, companyCount: companies.length, companies, byYear };
};

/** Pobiera PDF faktury jako bufor (token po stronie serwera). */
export const getInvoicePdf = async (invoiceId: number): Promise<Buffer> => {
  const url = `${baseUrl()}/invoices/${invoiceId}.pdf?api_token=${getToken()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fakturownia PDF: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
};
