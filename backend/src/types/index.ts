export interface Address {
  province: string;
  zipCode: string;
  city: string;
  street: string;
  number: string;
}

export interface Client {
  id?: string;
  companyName: string;
  type: 'hurt' | 'sklep';
  contactPerson: string;
  email: string;
  phone: string;
  address: Address;
  lastContactAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Interaction {
  id?: string;
  clientId: string;
  contactDate: string;
  channel: 'telefon' | 'mail' | 'spotkanie' | 'inne';
  notes: string;
  tradeNotes?: string;
  products?: string[];
  createdBy: string;
}

export interface Product {
  id?: string;
  name: string;
  createdAt: string;
}

export interface EmailTemplate {
  id?: string;
  name: string;
  subject: string;
  body: string;
  type: 'welcome' | 'order_thanks' | 'promo';
}

// NOWE: Struktura Przypomnienia (FollowUp)
export interface FollowUp {
  id?: string;
  clientId: string;
  clientName: string; // Zapisujemy nazwę firmy, żeby ładnie wyglądało na Dashboardzie
  dueDate: string;    // Data planowanego kontaktu
  reminderText: string; // Notatka do przypomnienia
  status: 'zaplanowane' | 'zrealizowane' | 'przesunięte';
  createdAt: string;
  completedAt?: string;
}