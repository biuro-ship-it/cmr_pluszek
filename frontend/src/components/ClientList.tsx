import React, { useState } from 'react';
import { Client } from '../services/api';

interface ClientListProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete?: (id: string) => void;
  onView: (client: Client) => void; // NOWE: Funkcja otwierająca kartę
}

const ClientList: React.FC<ClientListProps> = ({ clients, onEdit, onDelete, onView }) => {
  const [search, setSearch] = useState('');

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.companyName ?? '').toLowerCase().includes(q) ||
      (c.contactPerson ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="mb-8">
        <input
          type="text"
          placeholder="Szukaj klienta (nazwa, osoba, e-mail, telefon)..."
          className="w-full p-4 rounded-2xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((client) => (
          <div key={client.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${
                client.type === 'hurt' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {client.type}
              </span>
              <button onClick={() => onEdit(client)} className="text-sm text-slate-400 hover:text-blue-600 font-semibold transition-colors">
                ✎ Edytuj
              </button>
            </div>
            
            <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
              {client.companyName}
            </h3>
            <p className="text-slate-500 text-sm mb-4">👤 {client.contactPerson || 'Brak osoby kontaktowej'}</p>
            
            <div className="space-y-2 mb-6 flex-grow">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>📍</span>
                <span>{client.address?.city || 'Brak miasta'}, {client.address?.province || 'Brak woj.'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>📞</span>
                <span>{client.phone || 'Brak telefonu'}</span>
              </div>
            </div>

            {/* NOWE: Podpięta akcja onView */}
            <button 
              onClick={() => onView(client)}
              className="w-full mt-auto py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl transition-colors border border-slate-100"
            >
              Otwórz kartę klienta
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full bg-white p-8 rounded-2xl text-center text-slate-500 border border-slate-200 border-dashed">
            Brak wyników wyszukiwania.
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientList;