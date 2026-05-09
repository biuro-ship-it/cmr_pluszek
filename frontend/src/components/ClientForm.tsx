import React, { useState } from 'react';
import { Client, ClientFormData } from '../services/api';

const PROVINCES = [
  'Dolnośląskie', 'Kujawsko-pomorskie', 'Lubelskie', 'Lubuskie',
  'Łódzkie', 'Małopolskie', 'Mazowieckie', 'Opolskie',
  'Podkarpackie', 'Podlaskie', 'Pomorskie', 'Śląskie',
  'Świętokrzyskie', 'Warmińsko-mazurskie', 'Wielkopolskie', 'Zachodniopomorskie'
];

interface ClientFormProps {
  onSubmit: (data: ClientFormData) => void;
  onCancel: () => void;
  initial?: Client | null;
}

const ClientForm: React.FC<ClientFormProps> = ({ onSubmit, onCancel, initial }) => {
  const [formData, setFormData] = useState<ClientFormData>({
    companyName: initial?.companyName ?? '',
    type: initial?.type ?? 'sklep',
    contactPerson: initial?.contactPerson ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    address: initial?.address ?? { province: '', zipCode: '', city: '', street: '', number: '' }
  });

  const handleZip = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 2) v = v.slice(0, 2) + '-' + v.slice(2, 5);
    setFormData({...formData, address: {...formData.address, zipCode: v}});
  };

  return (
    <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">
          {initial ? 'Edycja Klienta' : 'Nowy Partner Biznesowy'}
        </h2>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => setFormData({...formData, type: 'sklep'})}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${formData.type === 'sklep' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
          >SKLEP 🏪</button>
          <button 
            type="button"
            onClick={() => setFormData({...formData, type: 'hurt'})}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${formData.type === 'hurt' ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
          >HURT 📦</button>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="group">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Nazwa Firmy</label>
            <input required className="w-full bg-slate-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 transition-all outline-none" 
              value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
          </div>
          <div className="group">
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Osoba Kontaktowa</label>
            <input className="w-full bg-slate-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 transition-all outline-none" 
              value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">E-mail</label>
              <input type="email" className="w-full bg-slate-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 transition-all outline-none" 
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Telefon</label>
              <input className="w-full bg-slate-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 transition-all outline-none" 
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="space-y-5 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Województwo</label>
            <select required className="w-full bg-white border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              value={formData.address.province} onChange={e => setFormData({...formData, address: {...formData.address, province: e.target.value}})}>
              <option value="">Wybierz...</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            <div className="w-1/3">
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Kod</label>
              <input placeholder="00-000" className="w-full bg-white border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                value={formData.address.zipCode} onChange={handleZip} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Miasto</label>
              <input className="w-full bg-white border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                value={formData.address.city} onChange={e => setFormData({...formData, address: {...formData.address, city: e.target.value}})} />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Ulica</label>
              <input className="w-full bg-white border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                value={formData.address.street} onChange={e => setFormData({...formData, address: {...formData.address, street: e.target.value}})} />
            </div>
            <div className="w-1/4">
              <label className="text-xs font-bold text-slate-400 uppercase ml-1">Nr</label>
              <input className="w-full bg-white border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                value={formData.address.number} onChange={e => setFormData({...formData, address: {...formData.address, number: e.target.value}})} />
            </div>
          </div>
        </div>

        <div className="col-span-full flex justify-end gap-3 mt-4">
          <button type="button" onClick={onCancel} className="px-6 py-3 text-slate-400 font-bold hover:text-slate-600 transition-all">Anuluj</button>
          <button type="submit" className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-blue-600 hover:-translate-y-1 transition-all active:scale-95">
            {initial ? 'Zapisz zmiany' : 'Dodaj Klienta do Bazy'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClientForm;