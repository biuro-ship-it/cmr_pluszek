import { auth } from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function getToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Brak zalogowanego użytkownika');
  return user.getIdToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Błąd sieci' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// Clients API
export interface Client {
  id: string;
  company_name: string;
  contact_person_name: string;
  email: string;
  phone: string;
  address: string;
  lastContactAt: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientFormData {
  company_name: string;
  contact_person_name: string;
  email: string;
  phone: string;
  address: string;
}

export const clientsApi = {
  getAll: () => request<Client[]>('/api/clients'),
  getOne: (id: string) => request<Client>(`/api/clients/${id}`),
  create: (data: ClientFormData) =>
    request<Client>('/api/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<ClientFormData>) =>
    request<Client>(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/api/clients/${id}`, { method: 'DELETE' }),
};
