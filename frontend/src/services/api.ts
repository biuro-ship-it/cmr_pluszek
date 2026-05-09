import { getAuth } from 'firebase/auth';

// --- INTERFEJSY I MODELE DANYCH ---

export interface Address {
  province: string;
  zipCode: string;
  city: string;
  street: string;
  number: string;
}

export interface Client {
  id: string;
  companyName: string;
  type: 'hurt' | 'sklep';
  contactPerson: string;
  email: string;
  phone: string;
  address: Address;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientFormData {
  companyName: string;
  type: 'hurt' | 'sklep';
  contactPerson: string;
  email: string;
  phone: string;
  address: Address;
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
  createdAt: string;
}

// --- KONFIGURACJA API ---

// Pobiera adres z pliku .env, a w przypadku jego braku używa localhost:4000
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const CLIENTS_URL = `${API_URL}/api/clients`;

/**
 * Funkcja pomocnicza: Pobiera aktualny token zalogowanego użytkownika z Firebase
 * Pozwala to zabezpieczyć endpointy na backendzie (wymóg P1-2)
 */
const getHeaders = async () => {
  const auth = getAuth();
  // Jeśli użytkownik jest zalogowany, pobierz jego token
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` // Nagłówek dla middleware verifyToken
  };
};


// --- FUNKCJE FETCH (CRUD) ---

/**
 * Pobiera listę wszystkich klientów
 */
export const getClients = async (): Promise<Client[]> => {
  const headers = await getHeaders();
  const response = await fetch(CLIENTS_URL, { headers });
  
  if (!response.ok) {
    throw new Error('Nie udało się pobrać listy klientów z serwera');
  }
  
  return response.json();
};

/**
 * Dodaje nowego klienta do bazy
 */
export const createClient = async (data: ClientFormData): Promise<Client> => {
  const headers = await getHeaders();
  const response = await fetch(CLIENTS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error('Nie udało się zapisać klienta');
  }
  
  return response.json();
};

/**
 * Aktualizuje dane istniejącego klienta
 */
export const updateClient = async (id: string, data: ClientFormData): Promise<Client> => {
  const headers = await getHeaders();
  const response = await fetch(`${CLIENTS_URL}/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error('Nie udało się zaktualizować danych klienta');
  }
  
  return response.json();
};

/**
 * Usuwa klienta z bazy
 */
export const deleteClient = async (id: string): Promise<void> => {
  const headers = await getHeaders();
  const response = await fetch(`${CLIENTS_URL}/${id}`, {
    method: 'DELETE',
    headers
  });
  
  if (!response.ok) {
    throw new Error('Nie udało się usunąć klienta');
  }
};
/**
 * Pobiera historię kontaktów dla konkretnego klienta
 */
export const getClientInteractions = async (clientId: string): Promise<Interaction[]> => {
  const headers = await getHeaders();
  const response = await fetch(`${CLIENTS_URL}/${clientId}/interactions`, { headers });
  
  if (!response.ok) throw new Error('Nie udało się pobrać historii kontaktów');
  return response.json();
};

/**
 * Dodaje nowy wpis do historii kontaktów klienta
 */
export const createClientInteraction = async (clientId: string, data: InteractionFormData): Promise<Interaction> => {
  const headers = await getHeaders();
  const response = await fetch(`${CLIENTS_URL}/${clientId}/interactions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  
  if (!response.ok) throw new Error('Nie udało się zapisać kontaktu');
  return response.json();
};
/**
 * Pobiera listę produktów z oferty
 */
export const getProductsList = async (): Promise<Product[]> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/products`, { headers });
  
  if (!response.ok) throw new Error('Nie udało się pobrać produktów');
  return response.json();
};