import React, { useState, useEffect } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import ClientForm from './components/ClientForm';

const API_URL = 'http://localhost:4000/api/clients';

const App: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = getAuth();

  const fetchClients = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setClients(data);
      setError(null);
    } catch (err) {
      setError('Brak połączenia z serwerem (port 4000)');
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleLogout = () => signOut(auth);

  const handleAddClient = async (formData: any) => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setShowForm(false);
        fetchClients();
      }
    } catch (err) {
      alert('Błąd zapisu');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* NOWOCZESNY NAVBAR */}
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📦</span>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
            CRM Pluszek
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 hidden sm:block">{auth.currentUser?.email}</span>
          <button 
            onClick={handleLogout}
            className="text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
          >
            Wyloguj
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900">Twoi Klienci</h2>
            <p className="text-slate-500">{clients.length} zarejestrowanych podmiotów</p>
          </div>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
          >
            {showForm ? '✕ Zamknij' : '＋ Dodaj klienta'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex items-center gap-3">
            <span>⚠️</span> {error}
          </div>
        )}

        {showForm ? (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            <ClientForm onSubmit={handleAddClient} onCancel={() => setShowForm(false)} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
              <div key={client.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex justify-between items-start mb-4">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${
                    client.type === 'hurt' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {client.type}
                  </span>
                  <button className="text-slate-300 hover:text-slate-600">•••</button>
                </div>
                
                <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
                  {client.companyName}
                </h3>
                <p className="text-slate-500 text-sm mb-4">👤 {client.contactPerson}</p>
                
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span>📍</span>
                    <span>{client.address?.city}, {client.address?.province}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span>📞</span>
                    <span>{client.phone || 'Brak telefonu'}</span>
                  </div>
                </div>

                <button className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl transition-colors border border-slate-100">
                  Otwórz kartę klienta
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;