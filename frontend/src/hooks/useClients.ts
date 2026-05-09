import { useState, useEffect, useCallback } from 'react';
import { clientsApi, Client, ClientFormData } from '../services/api';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clientsApi.getAll();
      setClients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd pobierania klientów');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const createClient = async (data: ClientFormData): Promise<void> => {
    const newClient = await clientsApi.create(data);
    setClients((prev) => [...prev, newClient].sort((a, b) =>
      a.company_name.localeCompare(b.company_name, 'pl')
    ));
  };

  const updateClient = async (id: string, data: Partial<ClientFormData>): Promise<void> => {
    const updated = await clientsApi.update(id, data);
    setClients((prev) =>
      prev.map((c) => (c.id === id ? updated : c))
    );
  };

  const deleteClient = async (id: string): Promise<void> => {
    await clientsApi.delete(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  return { clients, loading, error, fetchClients, createClient, updateClient, deleteClient };
}
