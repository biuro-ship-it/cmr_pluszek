export interface Client {
  id: string;
  companyName: string;
  contactPersonName: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
  updatedAt: string;
  lastContactAt?: string;
}

export interface CreateClientInput {
  companyName: string;
  contactPersonName: string;
  email: string;
  phone: string;
  address: string;
}

export interface Interaction {
  id: string;
  clientId: string;
  contactDate: string;
  channel: "telefon" | "email" | "spotkanie" | "inne";
  notes: string;
  pricingNotes: string;
  products: string;
  createdAt: string;
  createdBy?: string;
}

export interface CreateInteractionInput {
  contactDate: string;
  channel: "telefon" | "email" | "spotkanie" | "inne";
  notes: string;
  pricingNotes?: string;
  products?: string;
}

export interface FollowUp {
  id: string;
  clientId: string;
  dueDate: string;
  note: string;
  status: "zaplanowane" | "zrealizowane" | "przesuniete";
  createdAt: string;
  updatedAt: string;
}

export interface CreateFollowUpInput {
  dueDate: string;
  note?: string;
}
