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

// Analizy dotyczą tylko faktur z kategorii przychodu o tej nazwie (dział CRM Pluszek).
const CATEGORY_NAME = process.env.FAKTUROWNIA_CATEGORY || 'CRM-Pluszek';
let cachedCategoryId: number | null | undefined; // undefined = jeszcze nie rozwiązane

// Zwraca id kategorii Fakturowni o nazwie CATEGORY_NAME (cache w pamięci), lub null gdy brak.
const resolveCategoryId = async (): Promise<number | null> => {
  if (cachedCategoryId !== undefined) return cachedCategoryId;
  const url = `${baseUrl()}/categories.json?api_token=${getToken()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Fakturownia categories: ${res.status}`);
  const arr = (await res.json()) as any[];
  const found = Array.isArray(arr)
    ? arr.find(c => String(c.name || '').trim().toLowerCase() === CATEGORY_NAME.toLowerCase())
    : null;
  cachedCategoryId = found ? Number(found.id) : null;
  return cachedCategoryId;
};

interface CategoryClient { id: number; name: string; nip: string }

// Firmy przypisane do kategorii (paginacja). Kategoria jest na KLIENCIE, nie na fakturze.
const getClientsInCategory = async (categoryId: number): Promise<CategoryClient[]> => {
  const out: CategoryClient[] = [];
  for (let page = 1; page <= 50; page++) {
    const url = `${baseUrl()}/clients.json?category_id=${categoryId}&page=${page}&per_page=100&api_token=${getToken()}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Fakturownia clients: ${res.status}`);
    const arr = (await res.json()) as any[];
    if (!Array.isArray(arr) || arr.length === 0) break;
    for (const c of arr) {
      out.push({ id: Number(c.id), name: String(c.name || '').trim(), nip: String(c.tax_no || '').replace(/[-\s]/g, '') });
    }
    if (arr.length < 100) break;
  }
  return out;
};

// Surowe faktury danego klienta za okres (paginacja).
const fetchClientInvoicesRaw = async (clientId: number, period: string): Promise<any[]> => {
  const out: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${baseUrl()}/invoices.json?client_id=${clientId}&period=${encodeURIComponent(period)}&page=${page}&per_page=100&api_token=${getToken()}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Fakturownia invoices: ${res.status}`);
    const arr = (await res.json()) as any[];
    if (!Array.isArray(arr) || arr.length === 0) break;
    out.push(...arr);
    if (arr.length < 100) break;
  }
  return out;
};

// Uruchamia fn dla elementów z ograniczoną współbieżnością (żeby nie zalać API).
const mapLimit = async <T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> => {
  const ret = new Array<R>(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      ret[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return ret;
};

/**
 * Obrót firm z kategorii CRM-Pluszek za dany okres (period: all/this_year/last_year/…).
 * Kategoria jest przypisana do KLIENTA — pobieramy firmy z kategorii i sumujemy ich faktury.
 * Obrót NETTO, proformy i wyceny pomijane. Grupowanie po firmie (dane z karty klienta).
 */
export const getInvoiceStats = async (period: string): Promise<FakturowniaStats> => {
  const categoryId = await resolveCategoryId();
  if (categoryId == null) {
    throw new Error(`Nie znaleziono kategorii „${CATEGORY_NAME}" w Fakturowni`);
  }

  const clients = await getClientsInCategory(categoryId);
  const empty: FakturowniaStats = { period, category: CATEGORY_NAME, totalNet: 0, invoiceCount: 0, companyCount: 0, companies: [], byYear: [] };
  if (clients.length === 0) return empty;

  const years = new Map<string, { net: number; count: number }>();

  const perClient = await mapLimit(clients, 6, async (cl): Promise<FakturowniaCompanyStat> => {
    const invs = await fetchClientInvoicesRaw(cl.id, period);
    let net = 0, count = 0, min = Infinity, max = -Infinity, lastIssueDate = '';
    for (const inv of invs) {
      if (EXCLUDED_KINDS.has(String(inv.kind || ''))) continue;
      const n = toNumber(inv.price_net);
      net += n; count += 1;
      min = Math.min(min, n); max = Math.max(max, n);
      const iss = String(inv.issue_date || '');
      if (iss > lastIssueDate) lastIssueDate = iss;
      const y = iss.slice(0, 4) || '—';
      const yr = years.get(y) ?? { net: 0, count: 0 };
      yr.net += n; yr.count += 1; years.set(y, yr);
    }
    return {
      key: cl.nip || String(cl.id),
      name: cl.name || '(brak nazwy)',
      nip: cl.nip,
      net, count,
      avg: count ? net / count : 0,
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 0 : max,
      lastIssueDate,
    };
  });

  const companies = perClient.filter(c => c.count > 0).sort((a, b) => b.net - a.net);
  const totalNet = companies.reduce((s, c) => s + c.net, 0);
  const invoiceCount = companies.reduce((s, c) => s + c.count, 0);
  const byYear = [...years.entries()]
    .map(([year, v]) => ({ year, net: v.net, count: v.count }))
    .sort((a, b) => b.year.localeCompare(a.year));

  return { period, category: CATEGORY_NAME, totalNet, invoiceCount, companyCount: companies.length, companies, byYear };
};

/** Pobiera PDF faktury jako bufor (token po stronie serwera). */
export const getInvoicePdf = async (invoiceId: number): Promise<Buffer> => {
  const url = `${baseUrl()}/invoices/${invoiceId}.pdf?api_token=${getToken()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fakturownia PDF: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
};
