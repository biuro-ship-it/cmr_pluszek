import React, { useState, useEffect } from 'react';
import { Client } from '../services/api';

type ExtendedClient = Client & { relationshipColor?: string };

interface ClientListProps {
  clients: ExtendedClient[];
  onEdit: (client: ExtendedClient) => void;
  onDelete?: (id: string) => void;
  onView: (client: ExtendedClient) => void;
}

const PROVINCES = [
  'Dolnośląskie', 'Kujawsko-pomorskie', 'Lubelskie', 'Lubuskie',
  'Łódzkie', 'Małopolskie', 'Mazowieckie', 'Opolskie',
  'Podkarpackie', 'Podlaskie', 'Pomorskie', 'Śląskie',
  'Świętokrzyskie', 'Warmińsko-mazurskie', 'Wielkopolskie', 'Zachodniopomorskie'
];

const PAGE_SIZE = 20;

const getBorderColor = (colorId?: string) => {
  switch (colorId) {
    case 'blue': return 'border-l-blue-400';
    case 'emerald': return 'border-l-emerald-400';
    case 'rose': return 'border-l-rose-400';
    case 'slate': 
    default: return 'border-l-slate-200';
  }
};

const ClientList: React.FC<ClientListProps> = ({ clients, onEdit, onView }) => {
  const [search, setSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [sortBy, setSortBy] = useState('alpha');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setCurrentPage(1); }, [search, provinceFilter, sortBy]);

  let processed = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = (c.companyName ?? '').toLowerCase().includes(q) ||
                        (c.contactPerson ?? '').toLowerCase().includes(q) ||
                        (c.email ?? '').toLowerCase().includes(q) ||
                        (c.phone ?? '').toLowerCase().includes(q);
    const matchProvince = provinceFilter === '' ? true : c.address?.province === provinceFilter;
    return matchSearch && matchProvince;
  });

  processed.sort((a, b) => {
    if (sortBy === 'alpha') return (a.companyName || '').localeCompare(b.companyName || '');
    if (sortBy === 'type') return (a.type || '').localeCompare(b.type || '');
    if (sortBy === 'oldest') {
      const dateA = new Date(a.lastContactAt || a.createdAt).getTime();
      const dateB = new Date(b.lastContactAt || b.createdAt).getTime();
      return dateA - dateB;
    }
    return 0;
  });

  const totalPages = Math.ceil(processed.length / PAGE_SIZE) || 1;
  const paginated = processed.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const renderDaysCounter = (client: Client) => {
    const dateToUse = client.lastContactAt || client.createdAt;
    if (!dateToUse) return null;
    const diffTime = new Date().getTime() - new Date(dateToUse).getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 45) return <span className="text-red-600 font-bold ml-2">({diffDays})</span>;
    if (diffDays > 21) return <span className="text-orange-500 font-bold ml-2">({diffDays})</span>;
    return <span className="text-slate-500 font-normal ml-2">({diffDays})</span>;
  };

  return (
    <div>
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 animate-in fade-in">
        <div className="flex-1">
          <input type="text" placeholder="Szukaj (nazwa, osoba, e-mail, telefon)..." className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-full md:w-1/4">
          <select className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 cursor-pointer" value={provinceFilter} onChange={(e) => setProvinceFilter(e.target.value)}>
            <option value="">Wszystkie województwa</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="w-full md:w-1/4">
          <select className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 cursor-pointer" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="alpha">🔤 Alfabetycznie (A-Z)</option>
            <option value="oldest">⏳ Od najstarszego kontaktu</option>
            <option value="type">🏢 Według kategorii</option>
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {paginated.map((client) => (
          <div key={client.id} className={`bg-white p-5 rounded-2xl border-y border-r border-l-8 border-y-slate-200 border-r-slate-200 ${getBorderColor(client.relationshipColor)} shadow-sm hover:shadow-md transition-shadow group relative flex flex-col h-full`}>
            <div className="flex justify-between items-start mb-4">
              <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${
                client.type === 'hurt' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {client.type}
              </span>
              <button onClick={() => onEdit(client)} className="text-sm text-slate-400 hover:text-blue-600 font-semibold transition-colors">✎ Edytuj</button>
            </div>
            
            <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors flex items-center flex-wrap">
              {client.companyName}
              {renderDaysCounter(client)}
            </h3>
            <p className="text-slate-500 text-sm mb-4">👤 {client.contactPerson || 'Brak osoby kontaktowej'}</p>
            
            <div className="space-y-2 mb-6 flex-grow">
              <div className="flex items-center gap-2 text-xs text-slate-600"><span>📍</span><span>{client.address?.city || 'Brak miasta'}, {client.address?.province || 'Brak woj.'}</span></div>
              <div className="flex items-center gap-2 text-xs text-slate-600"><span>📞</span><span>{client.phone || 'Brak telefonu'}</span></div>
            </div>

            <button onClick={() => onView(client)} className="w-full mt-auto py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl transition-colors border border-slate-100">
              Otwórz kartę klienta
            </button>
          </div>
        ))}
        {paginated.length === 0 && <div className="col-span-full bg-white p-8 rounded-2xl text-center text-slate-500 border border-slate-200 border-dashed">Brak wyników wyszukiwania.</div>}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 bg-white py-3 px-6 rounded-2xl border border-slate-200 w-max mx-auto shadow-sm">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="text-slate-500 hover:text-blue-600 font-bold disabled:opacity-30">← Poprzednia</button>
          <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">Strona {currentPage} z {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="text-slate-500 hover:text-blue-600 font-bold disabled:opacity-30">Następna →</button>
        </div>
      )}
    </div>
  );
};

export default ClientList;