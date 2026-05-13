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
  nip?: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: Address;
  shippingAddress?: Address;        // oddzielny adres do wysyłki
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
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Product {
  id?: string;
  name: string;
  code?: string;
  priceNetto?: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EmailTemplate {
  id?: string;
  name: string;
  subject: string;
  body: string;
  type: 'welcome' | 'order_thanks' | 'promo';
}

export interface FollowUp {
  id?: string;
  clientId: string;
  clientName: string;
  dueDate: string;
  reminderText: string;
  status: 'zaplanowane' | 'zrealizowane' | 'przesunięte';
  createdAt: string;
  completedAt?: string;
}

export interface PromotionProduct {
  id: string;
  name: string;
  code?: string;
  priceNetto?: number;
  imageUrl?: string;
}

export interface Promotion {
  id?: string;
  clientIds: string[];
  clientNames: string[];
  products: PromotionProduct[];
  discountType: 'none' | 'percent' | 'flat';
  discountValue: number;
  emailSubject: string;
  emailBody: string;
  scheduledFor: string | null;    // null = natychmiastowe
  status: 'draft' | 'scheduled' | 'sent';
  sentAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}
