import React from 'react';
import { Client } from '../services/api';

interface ClientCardProps {
  client: Client;
  onClose: () => void;
}

const ClientCard: React.FC<ClientCardProps> = ({ client, onClose }) => {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 animate-in slide-in-from-right-8 duration-300">
      <button 
        onClick={onClose} 
        className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-700 transition-colors"
      >
        <span>←</span> Wróć do listy klientów
      </button>

      <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-black text-slate-800">{client.companyName}</h2>
            <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${
                client.type === 'hurt' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {client.type}
            </span>
          </div>
          <p className="text-slate-500 font-medium">Osoba kontaktowa: {client.contactPerson || 'Brak'}</p>
        </div>
        
        <div className="text-right text-sm text-slate-500 bg-slate-50 p-4 rounded-2xl">
          <p className="flex items-center gap-2 justify-end mb-1"><span>📞</span> <a href={`tel:${client.phone}`} className="hover:text-blue-600 font-bold">{client.phone || 'Brak'}</a></p>
          <p className="flex items-center gap-2 justify-end"><span>✉️</span> <a href={`mailto:${client.email}`} className="hover:text-blue-600 font-bold">{client.email || 'Brak'}</a></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Adres firmy</h3>
          <p className="text-slate-700 font-medium">{client.address?.street} {client.address?.number}</p>
          <p className="text-slate-700 font-medium">{client.address?.zipCode} {client.address?.city}</p>
          <p className="text-slate-500 text-sm mt-2">{client.address?.province}</p>
        </div>

        <div className="col-span-1 md:col-span-2 bg-blue-50/50 p-6 rounded-2xl border border-blue-100 border-dashed flex items-center justify-center text-center">
          <div>
            <span className="text-3xl block mb-2">📝</span>
            <h3 className="text-lg font-bold text-blue-900 mb-1">Historia kontaktów (wkrótce)</h3>
            <p className="text-blue-600/70 text-sm">Tutaj pojawią się wpisy z Twoich rozmów telefonicznych, ustalone ceny i planowane przypomnienia.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientCard;