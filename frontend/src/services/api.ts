import { getAuth } from 'firebase/auth';

// ─── INTERFEJSY I MODELE DANYCH ─────────────────────────────────────────────

export interface Address {
  province: string;
  zipCode: string;
  city: string;
  street: string;
  number: string;
}

export const emptyAddress = (): Address => ({
  street: '', number: '', city: '', zipCode: '', province: ''
});

export type ClientType = 'hurt' | 'sklep';

export interface Client {
  id: string;
  companyName: string;
  type: ClientType;
  nip?: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: Address;
  shippingAddress?: Address;
  relationshipColor?: string; // DODANE: Kolor relacji
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientFormData {
  companyName: string;
  type: ClientType;
  nip: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: Address;
  shippingAddress?: Address;
  relationshipColor?: string; // DODANE: Kolor relacji
}

export interface Interaction {
  id: string;
  contactDate: string;
  channel: 'telefon' | 'mail' | 'spotkanie' | 'inne';
  notes: string;
  tradeNotes?: string;
  products?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface InteractionFormData {
  contactDate: string;
  channel: 'telefon' | 'mail' | 'spotkanie' | 'inne';
  notes: string;
  tradeNotes: string;
  products: string[];
}

export interface Product {
  id: string;
  name: string;
  code: string;
  priceNetto: number;
  imageUrl: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductFormData {
  name: string;
  code: string;
  priceNetto: number;
  imageUrl: string;
}

export interface FollowUp {
  id: string;
  clientId: string;
  clientName: string;
  dueDate: string;
  reminderText: string;
  status: 'zaplanowane' | 'zrealizowane' | 'przesunięte';
  createdAt: string;
  completedAt?: string;
}

export interface FollowUpFormData {
  clientName: string;
  dueDate: string;
  reminderText: string;
}

export interface PromotionProduct {
  id: string;
  name: string;
  code?: string;
  priceNetto?: number;
  imageUrl?: string;
}

export interface Promotion {
  id: string;
  clientIds: string[];
  clientNames: string[];
  products: PromotionProduct[];
  discountType: 'none' | 'percent' | 'flat';
  discountValue: number;
  emailSubject: string;
  emailBody: string;
  scheduledFor: string | null;
  status: 'draft' | 'scheduled' | 'sent';
  sentAt?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface PromotionFormData {
  clientIds: string[];
  clientNames: string[];
  products: PromotionProduct[];
  discountType: 'none' | 'percent' | 'flat';
  discountValue: number;
  emailSubject: string;
  emailBody: string;
  scheduledFor: string | null;
  status: 'draft' | 'scheduled' | 'sent';
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  date: string;
  isImportant: boolean;
  isUrgent: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface NoteFormData {
  title: string;
  content: string;
  color: string;
  isImportant: boolean;
  isUrgent: boolean;
  date?: string;
}

export interface FoamColor {
  id: string;
  name: string;
  hex: string;
  quantity: number;
  minQuantity: number;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface FoamColorFormData {
  name: string;
  hex: string;
  minQuantity: number;
}

export interface FoamMovement {
  id: string;
  delta: number;
  reason: string;
  resultingQuantity: number;
  by: string;
  at: string;
}

// ─── KONFIGURACJA API ────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const CLIENTS_URL = `${API_URL}/api/clients`;

const getHeaders = async () => {
  const auth = getAuth();
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

// ─── KLIENCI ─────────────────────────────────────────────────────────────────

export const getClients = async (): Promise<Client[]> => {
  const headers = await getHeaders();
  const response = await fetch(CLIENTS_URL, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać listy klientów z serwera');
  return response.json();
};

export const createClient = async (data: ClientFormData): Promise<Client> => {
  const headers = await getHeaders();
  const response = await fetch(CLIENTS_URL, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się zapisać klienta');
  return response.json();
};

export const updateClient = async (id: string, data: ClientFormData): Promise<Client> => {
  const headers = await getHeaders();
  const response = await fetch(`${CLIENTS_URL}/${id}`, {
    method: 'PUT', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się zaktualizować danych klienta');
  return response.json();
};

export const deleteClient = async (id: string): Promise<void> => {
  const headers = await getHeaders();
  const response = await fetch(`${CLIENTS_URL}/${id}`, { method: 'DELETE', headers });
  if (!response.ok) throw new Error('Nie udało się usunąć klienta');
};

// ─── FAKTUROWNIA (tylko odczyt, przez backend) ───────────────────────────────

export interface FakturowniaInvoice {
  id: number;
  number: string;
  issueDate: string;
  sellDate: string;
  paymentTo: string;
  priceNet: number;
  priceGross: number;
  currency: string;
  status: string;
  kind: string;
}

export interface FakturowniaClientInfo {
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

export interface FakturowniaLookup {
  client: FakturowniaClientInfo;
  invoices: FakturowniaInvoice[];
}

/** Pobiera z Fakturowni dane klienta i jego faktury po NIP. */
export const fakturowniaLookup = async (nip: string): Promise<FakturowniaLookup> => {
  const nipClean = nip.replace(/[-\s]/g, '');
  if (!/^\d{10}$/.test(nipClean)) throw new Error('NIP musi mieć 10 cyfr');
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/fakturownia/lookup/${nipClean}`, { headers });
  if (response.status === 404) throw new Error('Nie znaleziono klienta o tym NIP w Fakturowni');
  if (response.status === 503) throw new Error('Integracja z Fakturownią nie jest skonfigurowana');
  if (!response.ok) throw new Error('Błąd komunikacji z Fakturownią');
  return response.json();
};

/** Otwiera PDF faktury w nowej karcie (token zostaje po stronie backendu). */
export const openFakturowniaPdf = async (invoiceId: number): Promise<void> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/fakturownia/invoice/${invoiceId}/pdf`, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać PDF faktury');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// ─── INTERAKCJE ───────────────────────────────────────────────────────────────

export const getClientInteractions = async (clientId: string): Promise<Interaction[]> => {
  const headers = await getHeaders();
  const response = await fetch(`${CLIENTS_URL}/${clientId}/interactions`, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać historii kontaktów');
  return response.json();
};

export const createClientInteraction = async (clientId: string, data: InteractionFormData): Promise<Interaction> => {
  const headers = await getHeaders();
  const response = await fetch(`${CLIENTS_URL}/${clientId}/interactions`, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się zapisać kontaktu');
  return response.json();
};

export const updateClientInteraction = async (clientId: string, interactionId: string, data: InteractionFormData): Promise<Interaction> => {
  const headers = await getHeaders();
  const response = await fetch(`${CLIENTS_URL}/${clientId}/interactions/${interactionId}`, {
    method: 'PUT', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się zaktualizować notatki');
  return response.json();
};

// ─── UPLOAD ZDJĘĆ ────────────────────────────────────────────────────────────

export const uploadImage = async (file: File): Promise<string> => {
  const auth = getAuth();
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) throw new Error('Nie udało się wgrać zdjęcia');
  const data = await response.json();
  return data.url;
};

// ─── PRODUKTY ─────────────────────────────────────────────────────────────────

export const getProductsList = async (): Promise<Product[]> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/products`, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać produktów');
  return response.json();
};

export const createProduct = async (data: ProductFormData): Promise<Product> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/products`, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się dodać produktu');
  return response.json();
};

export const updateProduct = async (id: string, data: ProductFormData): Promise<Product> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/products/${id}`, {
    method: 'PUT', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się zaktualizować produktu');
  return response.json();
};

export const deleteProduct = async (id: string): Promise<void> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/products/${id}`, { method: 'DELETE', headers });
  if (!response.ok) throw new Error('Nie udało się usunąć produktu');
};

// ─── FOLLOW-UPS ───────────────────────────────────────────────────────────────

export const getFollowUpSummary = async (): Promise<FollowUp[]> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/followups/summary`, { headers });
  if (!response.ok) throw new Error('Błąd pobierania zadań');
  return response.json();
};

export const createFollowUp = async (clientId: string, data: FollowUpFormData): Promise<FollowUp> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/followups/client/${clientId}`, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Błąd dodawania przypomnienia');
  return response.json();
};

export const updateFollowUpStatus = async (id: string, status: 'zrealizowane' | 'przesunięte'): Promise<void> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/followups/${id}/status`, {
    method: 'PATCH', headers, body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Błąd serwera (${response.status})`);
  }
};

// ─── PROMOCJE ─────────────────────────────────────────────────────────────────

export const getPromotions = async (): Promise<Promotion[]> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/promotions`, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać promocji');
  return response.json();
};

export const createPromotion = async (data: PromotionFormData): Promise<Promotion> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/promotions`, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się zapisać promocji');
  return response.json();
};

export const updatePromotionStatus = async (id: string, status: 'draft' | 'scheduled' | 'sent'): Promise<void> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/promotions/${id}/status`, {
    method: 'PATCH', headers, body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error('Błąd zmiany statusu promocji');
};

export const deletePromotion = async (id: string): Promise<void> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/promotions/${id}`, { method: 'DELETE', headers });
  if (!response.ok) throw new Error('Nie udało się usunąć promocji');
};

// ─── NOTATKI ──────────────────────────────────────────────────────────────────

export const getNotes = async (): Promise<Note[]> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/notes`, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać notatek');
  return response.json();
};

export const createNote = async (data: NoteFormData): Promise<Note> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/notes`, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się dodać notatki');
  return response.json();
};

export const updateNote = async (id: string, data: NoteFormData): Promise<Note> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/notes/${id}`, {
    method: 'PUT', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się zaktualizować notatki');
  return response.json();
};

export const deleteNote = async (id: string): Promise<void> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/notes/${id}`, { method: 'DELETE', headers });
  if (!response.ok) throw new Error('Nie udało się usunąć notatki');
};

// Jednorazowe wgranie przykładowych notatek (po stronie serwera idempotentne)
export const seedNotes = async (): Promise<void> => {
  const headers = await getHeaders();
  await fetch(`${API_URL}/api/notes/seed`, { method: 'POST', headers });
};

// ─── MAGAZYN PIANEK ───────────────────────────────────────────────────────────

const FOAM_URL = `${API_URL}/api/foam-stock`;

export const getFoamStock = async (): Promise<FoamColor[]> => {
  const headers = await getHeaders();
  const response = await fetch(FOAM_URL, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać stanu magazynu');
  return response.json();
};

export const createFoamColor = async (data: FoamColorFormData): Promise<FoamColor> => {
  const headers = await getHeaders();
  const response = await fetch(FOAM_URL, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się dodać koloru');
  return response.json();
};

export const updateFoamColor = async (id: string, data: FoamColorFormData): Promise<FoamColor> => {
  const headers = await getHeaders();
  const response = await fetch(`${FOAM_URL}/${id}`, {
    method: 'PUT', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się zaktualizować koloru');
  return response.json();
};

export const deleteFoamColor = async (id: string): Promise<void> => {
  const headers = await getHeaders();
  const response = await fetch(`${FOAM_URL}/${id}`, { method: 'DELETE', headers });
  if (!response.ok) throw new Error('Nie udało się usunąć koloru');
};

export const adjustFoamStock = async (
  id: string,
  delta: number,
  reason?: string
): Promise<{ id: string; quantity: number }> => {
  const headers = await getHeaders();
  const response = await fetch(`${FOAM_URL}/${id}/adjust`, {
    method: 'PATCH', headers, body: JSON.stringify({ delta, reason }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Nie udało się zmienić stanu (${response.status})`);
  }
  return response.json();
};

export const getFoamMovements = async (id: string): Promise<FoamMovement[]> => {
  const headers = await getHeaders();
  const response = await fetch(`${FOAM_URL}/${id}/movements`, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać historii ruchów');
  return response.json();
};

// Jednorazowe wgranie startowych kolorów (po stronie serwera idempotentne)
export const seedFoamStock = async (): Promise<void> => {
  const headers = await getHeaders();
  await fetch(`${FOAM_URL}/seed`, { method: 'POST', headers });
};

// ─── ARCHIWUM / EKSPORT ──────────────────────────────────────────────────────

export interface ArchiveData {
  meta: { exportedAt: string; exportedBy: string; version: number; counts: Record<string, number> };
  clients: any[];
  interactions: any[];
  products: any[];
  promotions: any[];
  notes: any[];
  foamStock: any[];
  foamMovements: any[];
  followups: any[];
}

export const getArchive = async (): Promise<ArchiveData> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/archive`, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać archiwum danych');
  return response.json();
};

// ─── SZABLONY MAILI ──────────────────────────────────────────────────────────

const EMAIL_TEMPLATES_URL = `${API_URL}/api/email-templates`;

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailTemplateFormData {
  name: string;
  category: string;
  subject: string;
  body: string;
}

export const getEmailTemplates = async (): Promise<EmailTemplate[]> => {
  const headers = await getHeaders();
  const response = await fetch(EMAIL_TEMPLATES_URL, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać szablonów maili');
  return response.json();
};

export const createEmailTemplate = async (data: EmailTemplateFormData): Promise<EmailTemplate> => {
  const headers = await getHeaders();
  const response = await fetch(EMAIL_TEMPLATES_URL, { method: 'POST', headers, body: JSON.stringify(data) });
  if (!response.ok) throw new Error('Nie udało się zapisać szablonu');
  return response.json();
};

export const updateEmailTemplate = async (id: string, data: EmailTemplateFormData): Promise<EmailTemplate> => {
  const headers = await getHeaders();
  const response = await fetch(`${EMAIL_TEMPLATES_URL}/${id}`, { method: 'PUT', headers, body: JSON.stringify(data) });
  if (!response.ok) throw new Error('Nie udało się zaktualizować szablonu');
  return response.json();
};

export const deleteEmailTemplate = async (id: string): Promise<void> => {
  const headers = await getHeaders();
  const response = await fetch(`${EMAIL_TEMPLATES_URL}/${id}`, { method: 'DELETE', headers });
  if (!response.ok) throw new Error('Nie udało się usunąć szablonu');
};

// Podstawia placeholdery {{firma}}, {{osoba}}, {{email}}, {{telefon}}, {{nip}}, {{miasto}} danymi klienta.
export const applyPlaceholders = (text: string, client: Client): string => {
  const map: Record<string, string> = {
    firma: client.companyName ?? '',
    osoba: client.contactPerson ?? '',
    email: client.email ?? '',
    telefon: client.phone ?? '',
    nip: client.nip ?? '',
    miasto: client.address?.city ?? '',
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (full, key) => (key in map ? map[key] : full));
};

// ─── DOSTAWCY ────────────────────────────────────────────────────────────────

export interface SupplierAddress {
  street: string;
  zipCode: string;
  city: string;
}

export interface SupplierContactNames {
  company: string;
  sales: string;
  owner: string;
}

export interface SupplierAgreements {
  discount: string;
  paymentTerm: string;
  deliveryFreq: string;
}

export interface SupplierFile {
  id: string;
  name: string;
  url: string;
  size?: string;
  uploadedAt: string;
}

export interface SupplierMaterial {
  id: string;
  name: string;
  unit: 'szt' | 'kpl' | 'ark.' | 'm²' | 'mb' | 'm' | 'kg' | 'g' | 'l' | 'ml';
  price: number; // cena netto za jednostkę
}

export interface Supplier {
  id: string;
  companyName: string;
  nip?: string;
  category: string;
  email: string;
  phoneCompany: string;
  phoneSales: string;
  phoneOwner: string;
  whatsapp?: string;
  messenger?: string;
  notes: string;
  relationshipColor: string;
  files: SupplierFile[];
  materials?: SupplierMaterial[];
  lastContactAt?: string | null;
  createdAt: string;
  updatedAt: string;
  address?: SupplierAddress;
  contactNames?: SupplierContactNames;
  agreements?: SupplierAgreements;
}

export type SupplierFormData = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'lastContactAt'>;

const SUPPLIERS_URL = `${API_URL}/api/suppliers`;

export const getSuppliers = async (): Promise<Supplier[]> => {
  const headers = await getHeaders();
  const response = await fetch(SUPPLIERS_URL, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać dostawców');
  return response.json();
};

export const createSupplier = async (data: SupplierFormData): Promise<Supplier> => {
  const headers = await getHeaders();
  const response = await fetch(SUPPLIERS_URL, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się dodać dostawcy');
  return response.json();
};

export const updateSupplier = async (id: string, data: SupplierFormData): Promise<Supplier> => {
  const headers = await getHeaders();
  const response = await fetch(`${SUPPLIERS_URL}/${id}`, {
    method: 'PUT', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się zaktualizować dostawcy');
  return response.json();
};

export const deleteSupplier = async (id: string): Promise<void> => {
  const headers = await getHeaders();
  const response = await fetch(`${SUPPLIERS_URL}/${id}`, { method: 'DELETE', headers });
  if (!response.ok) throw new Error('Nie udało się usunąć dostawcy');
};

export const getSupplierInteractions = async (supplierId: string): Promise<Interaction[]> => {
  const headers = await getHeaders();
  const response = await fetch(`${SUPPLIERS_URL}/${supplierId}/interactions`, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać historii dostawcy');
  return response.json();
};

export const createSupplierInteraction = async (supplierId: string, data: InteractionFormData): Promise<Interaction> => {
  const headers = await getHeaders();
  const response = await fetch(`${SUPPLIERS_URL}/${supplierId}/interactions`, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się dodać notatki');
  return response.json();
};

export const updateSupplierInteraction = async (supplierId: string, interactionId: string, data: InteractionFormData): Promise<Interaction> => {
  const headers = await getHeaders();
  const response = await fetch(`${SUPPLIERS_URL}/${supplierId}/interactions/${interactionId}`, {
    method: 'PUT', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się zaktualizować notatki');
  return response.json();
};

// ─── KALKULACJE ──────────────────────────────────────────────────────────────

export interface CalcComponent {
  id: string;
  supplierId?: string;
  supplierName?: string;
  materialId?: string;
  materialName: string;
  unitPrice: number;
  priceUnit: string;
  consumption: number;
  consumptionUnit: string;
  included: boolean;
}

export interface TransportBracket {
  id: string;
  maxQty: number;
  cost: number;
}

export interface Calculation {
  id?: string;
  name: string;
  components: CalcComponent[];
  margin1: number;
  margin2: number;
  transportBrackets: TransportBracket[];
  productionQty: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type CalculationFormData = Omit<Calculation, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

const CALCULATIONS_URL = `${API_URL}/api/calculations`;

export const getCalculations = async (): Promise<Calculation[]> => {
  const headers = await getHeaders();
  const response = await fetch(CALCULATIONS_URL, { headers });
  if (!response.ok) throw new Error('Nie udało się pobrać kalkulacji');
  return response.json();
};

export const createCalculation = async (data: CalculationFormData): Promise<Calculation> => {
  const headers = await getHeaders();
  const response = await fetch(CALCULATIONS_URL, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się zapisać kalkulacji');
  return response.json();
};

export const updateCalculation = async (id: string, data: CalculationFormData): Promise<Calculation> => {
  const headers = await getHeaders();
  const response = await fetch(`${CALCULATIONS_URL}/${id}`, {
    method: 'PUT', headers, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nie udało się zaktualizować kalkulacji');
  return response.json();
};

export const deleteCalculation = async (id: string): Promise<void> => {
  const headers = await getHeaders();
  const response = await fetch(`${CALCULATIONS_URL}/${id}`, { method: 'DELETE', headers });
  if (!response.ok) throw new Error('Nie udało się usunąć kalkulacji');
};