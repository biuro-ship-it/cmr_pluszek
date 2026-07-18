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
  category: string;          // 'oferta' | 'follow-up' | 'podziękowanie' | 'inne'
  subject: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
  unit: 'szt' | 'm2' | 'ark.' | 'kpl';
  price: number; // cena netto za jednostke
}

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

export interface Supplier {
  id?: string;
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

export type TransportCostMode = 'total' | 'perUnit';

export interface TransportBracket {
  id: string;
  maxQty: number;
  cost: number;
  costMode: TransportCostMode;
  color: string;
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
