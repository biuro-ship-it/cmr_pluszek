import React, { useEffect, useState, useCallback } from 'react';
import { useClients } from '../hooks/useClients';
import ClientForm from '../components/ClientForm';
import ClientList from '../components/ClientList';
import ClientCard from '../components/ClientCard';
import { Client, ClientFormData, FollowUp, getFollowUpSummary, updateFollowUpStatus } from '../services/api';

interface DashboardProps {
  user: any;
  onSignOut: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onSignOut }) => {
  const { clients, loading, error, fetchClients, createClient, updateClient, removeClient } = useClients();
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<FollowUp[]>([]);

  const loadTasks = useCallback(async () => {
    try {
      const summary = await getFollowUpSummary();
      setTasks(summary);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchClients();
    loadTasks();
  }, [fetchClients, loadTasks]);

  const handleAddClick = () => {
    setEditClient(null);
    setViewClient(null);
    setShowForm(true);
  };

  const handleEditClick = (client: Client) => {
    setEditClient(client);
    setViewClient(null);
    setShowForm(true);
  };

  const handleViewClick = (client: Client) => {
    setShowForm(false);
    setViewClient(client);
  };

  const handleSubmit = async (data: ClientFormData) => {
    setSubmitError(null);
    try {
      if (editClient) {
        const updated = await updateClient(editClient.id, data);
        if (viewClient?.id === updated.id) setViewClient(updated); 
      } else {
        await createClient(data);
      }
      setShowForm(false);
      setEditClient(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Błąd zapisu. Spróbuj ponownie.');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await updateFollowUpStatus(taskId, 'zrealizowane');
      loadTasks();
    } catch (err) {
      alert("Błąd podczas kończenia zadania.");
    }
  };

  const isOverdue = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📦</span>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
            CRM Pluszek
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 hidden sm:block">{user?.email}</span>
          <button onClick={onSignOut} className="text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
            Wyloguj
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        
        {/* Panel zadań (ukryty gdy jesteśmy w karcie lub formularzu) */}
        {!viewClient && !showForm && tasks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-red-500">⏰</span> Do wykonania na dziś
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map(task => (
                <div key={task.id} className={`p-4 rounded-2xl border ${isOverdue(task.dueDate) ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'} shadow-sm flex flex-col justify-between`}>
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-xs font-black px-2 py-1 rounded-md uppercase ${isOverdue(task.dueDate) ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'}`}>
                        {isOverdue(task.dueDate) ? 'Zaległe' : 'Dziś'} ({task.dueDate})
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-800">{task.clientName}</h3>
                    <p className="text-sm text-slate-600 mt-1">{task.reminderText}</p>
                  </div>
                  <button 
                    onClick={() => handleCompleteTask(task.id!)}
                    className="mt-4 w-full py-2 bg-white hover:bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 rounded-lg transition-colors text-sm"
                  >
                    ✓ Oznacz jako zrobione
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dynamiczny Nagłówek Zależny Od Kontekstu */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900">
              {viewClient ? 'Karta Klienta' : showForm ? (editClient ? 'Edycja Klienta' : 'Nowy Klient') : 'Twoi Klienci'}
            </h2>
            <p className="text-slate-500">
              {viewClient ? viewClient.companyName : showForm ? 'Wypełnij formularz poniżej' : `${clients.length} zarejestrowanych podmiotów`}
            </p>
          </div>
          
          {/* Przycisk zależny od widoku */}
          {viewClient ? (
            <button 
              onClick={() => { setViewClient(null); loadTasks(); }} 
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2"
            >
              ← Wróć do listy
            </button>
          ) : (
            <button 
              onClick={showForm ? () => setShowForm(false) : handleAddClick} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
            >
              {showForm ? '✕ Zamknij formularz' : '＋ Dodaj klienta'}
            </button>
          )}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">⚠️ {error}</div>}
        {submitError && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">⚠️ {submitError}</div>}

        {loading ? (
          <div className="text-center text-slate-500 py-10 font-bold animate-pulse">Ładowanie danych z bazy...</div>
        ) : showForm ? (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            <ClientForm onSubmit={handleSubmit} onCancel={() => setShowForm(false)} initial={editClient} />
          </div>
        ) : viewClient ? (
          <ClientCard client={viewClient} onClose={() => { setViewClient(null); loadTasks(); }} />
        ) : (
          <ClientList clients={clients} onEdit={handleEditClick} onDelete={removeClient} onView={handleViewClick} />
        )}
      </main>
    </div>
  );
};

export default Dashboard;