import React, { useEffect, useState } from 'react';
import { useClients } from '../hooks/useClients';
import ClientForm from '../components/ClientForm';
import ClientList from '../components/ClientList';
import { Client, ClientFormData } from '../services/api';

interface DashboardProps {
  user: any;
  onSignOut: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onSignOut }) => {
  const { clients, loading, error, fetchClients, createClient, updateClient, removeClient } = useClients();
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Pobieranie listy klientów przy pierwszym uruchomieniu Dashboardu
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleAddClick = () => {
    setEditClient(null);
    setShowForm(true);
  };

  const handleEditClick = (client: Client) => {
    setEditClient(client);
    setShowForm(true);
  };

  // Dodano bezpieczne try/catch (Punkt P3-1 z audytu)
  const handleSubmit = async (data: ClientFormData) => {
    setSubmitError(null);
    try {
      if (editClient) {
        await updateClient(editClient.id, data);
      } else {
        await createClient(data);
      }
      setShowForm(false);
      setEditClient(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Błąd zapisu. Spróbuj ponownie.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Pasek nawigacyjny */}
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📦</span>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
            CRM Pluszek
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 hidden sm:block">{user?.email}</span>
          <button 
            onClick={onSignOut} 
            className="text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
          >
            Wyloguj
          </button>
        </div>
      </nav>

      {/* Główna sekcja zawartości */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900">Twoi Klienci</h2>
            <p className="text-slate-500">{clients.length} zarejestrowanych podmiotów</p>
          </div>
          <button 
            onClick={showForm ? () => setShowForm(false) : handleAddClick} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
          >
            {showForm ? '✕ Zamknij formularz' : '＋ Dodaj klienta'}
          </button>
        </div>

        {/* Wyświetlanie błędów */}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">⚠️ {error}</div>}
        {submitError && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">⚠️ {submitError}</div>}

        {/* Renderowanie warunkowe: Ładowanie / Formularz / Lista */}
        {loading ? (
          <div className="text-center text-slate-500 py-10 font-bold animate-pulse">Ładowanie danych z bazy...</div>
        ) : showForm ? (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            <ClientForm 
              onSubmit={handleSubmit} 
              onCancel={() => setShowForm(false)} 
              initial={editClient} 
            />
          </div>
        ) : (
          <ClientList 
            clients={clients} 
            onEdit={handleEditClick} 
            onDelete={removeClient} 
          />
        )}
      </main>
    </div>
  );
};

export default Dashboard;