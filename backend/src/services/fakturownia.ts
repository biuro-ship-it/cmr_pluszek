// Serwis integracji z Fakturownią (tylko odczyt).
// Token i subdomena pochodzą z .env — nigdy nie trafiają do frontendu.
//   FAKTUROWNIA_DOMAIN=pluszek        (subdomena: pluszek.fakturownia.pl)
//   FAKTUROWNIA_TOKEN=xxxxxxxxxxxxxxx (Ustawienia → Konto → Integracja → Kod API)

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

/** Pobiera faktury danego klienta (po client_id), z paginacją (per_page=100, max 5 stron). */
export const getInvoicesByClientId = async (clientId: number): Promise<FakturowniaInvoice[]> => {
  const all: FakturowniaInvoice[] = [];
  const MAX_PAGES = 5;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${baseUrl()}/invoices.json?client_id=${clientId}&page=${page}&per_page=100&api_token=${getToken()}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Fakturownia invoices: ${res.status}`);
    const arr = (await res.json()) as any[];
    if (!Array.isArray(arr) || arr.length === 0) break;
    for (const inv of arr) {
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

export interface FakturowniaCompanyStat {
  key: string;
  name: string;
  nip: string;
  net: number;
  count: number;
  avg: number;
  min: number;
  max: number;
}

export interface FakturowniaStats {
  period: string;
  totalNet: number;
  invoiceCount: number;
  companyCount: number;
  companies: FakturowniaCompanyStat[];
  byYear: { year: string; net: number; count: number }[];
}

// Rodzaje pomijane w obrocie (to nie sprzedaż): proformy i wyceny/szacunki.
const EXCLUDED_KINDS = new Set(['proforma', 'estimate', 'client_order', 'kp', 'kw']);

/**
 * Agreguje faktury z całej Fakturowni za dany okres (period: all/this_year/last_year/…).
 * Obrót liczony NETTO. Grupowanie po firmie (NIP, w razie braku po nazwie nabywcy).
 * Proformy i wyceny pomijane.
 */
export const getInvoiceStats = async (period: string): Promise<FakturowniaStats> => {
  const raw: any[] = [];
  const MAX_PAGES = 100; // do 10 000 faktur — bezpieczny limit
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${baseUrl()}/invoices.json?period=${encodeURIComponent(period)}&page=${page}&per_page=100&api_token=${getToken()}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Fakturownia invoices: ${res.status}`);
    const arr = (await res.json()) as any[];
    if (!Array.isArray(arr) || arr.length === 0) break;
    raw.push(...arr);
    if (arr.length < 100) break;
  }

  const companies = new Map<string, FakturowniaCompanyStat>();
  const years = new Map<string, { net: number; count: number }>();
  let totalNet = 0;
  let invoiceCount = 0;

  for (const inv of raw) {
    if (EXCLUDED_KINDS.has(String(inv.kind || ''))) continue;
    const net = toNumber(inv.price_net);
    const nip = String(inv.buyer_tax_no || '').replace(/[-\s]/g, '');
    const name = String(inv.buyer_name || '').trim();
    const key = nip || name || `client-${inv.client_id ?? 'brak'}`;

    totalNet += net;
    invoiceCount += 1;

    const c = companies.get(key) ?? { key, name: name || '(brak nazwy)', nip, net: 0, count: 0, avg: 0, min: Infinity, max: -Infinity };
    c.net += net;
    c.count += 1;
    c.min = Math.min(c.min, net);
    c.max = Math.max(c.max, net);
    if ((!c.name || c.name === '(brak nazwy)') && name) c.name = name;
    if (!c.nip && nip) c.nip = nip;
    companies.set(key, c);

    const y = String(inv.issue_date || '').slice(0, 4) || '—';
    const yr = years.get(y) ?? { net: 0, count: 0 };
    yr.net += net;
    yr.count += 1;
    years.set(y, yr);
  }

  const companiesArr = [...companies.values()]
    .map(c => ({
      ...c,
      avg: c.count ? c.net / c.count : 0,
      min: c.min === Infinity ? 0 : c.min,
      max: c.max === -Infinity ? 0 : c.max,
    }))
    .sort((a, b) => b.net - a.net);

  const byYear = [...years.entries()]
    .map(([year, v]) => ({ year, net: v.net, count: v.count }))
    .sort((a, b) => b.year.localeCompare(a.year));

  return { period, totalNet, invoiceCount, companyCount: companiesArr.length, companies: companiesArr, byYear };
};

/** Pobiera PDF faktury jako bufor (token po stronie serwera). */
export const getInvoicePdf = async (invoiceId: number): Promise<Buffer> => {
  const url = `${baseUrl()}/invoices/${invoiceId}.pdf?api_token=${getToken()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fakturownia PDF: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
};
