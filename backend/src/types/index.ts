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
  type: 'hurt' | 'sklep'; // Nowy znacznik
  contactPerson: string;
  email: string;
  phone: string;
  address: Address; // Strukturalny adres
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
  tradeNotes?: string; // Ustalenia cenowe
  products?: string[]; // Wybrane produkty z rozmowy
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