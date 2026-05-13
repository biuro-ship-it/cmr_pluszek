import React, { useState, useMemo } from 'react';
import { Client } from '../services/api';

interface AddressesViewProps {
  clients: Client[];
}

const PROVINCES = [
  'Dolnośląskie', 'Kujawsko-pomorskie', 'Lubelskie', 'Lubuskie',
  'Łódzkie', 'Małopolskie', 'Mazowieckie', 'Opolskie',
  'Podkarpackie', 'Podlaskie', 'Pomorskie', 'Śląskie',
  'Świętokrzyskie', 'Warmińsko-mazurskie', 'Wielkopolskie', 'Zachodniopomorskie',
];

type AddressMode = 'firma' | 'wysyłka' | 'oba';

const AddressesView: React.FC<AddressesViewProps> = ({ clients }) => {
  const [search, setSearch] = useState('');
  const [province, setProvince] = useState('');
  const [mode, setMode] = useState<AddressMode>('firma');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(c => {
      const matchSearch =
        (c.companyName ?? '').toLowerCase().includes(q) ||
        (c.address?.city ?? '').toLowerCase().includes(q) ||
        (c.address?.street ?? '').toLowerCase().includes(q) ||
        (c.contactPerson ?? '').toLowerCase().includes(q);

      const addrToCheck = mode === 'wysyłka' ? c.shippingAddress : c.address;
      const matchProv = province === '' || (addrToCheck?.province ?? '').includes(province);

      return matchSearch && matchProv;
    });
  }, [clients, search, province, mode]);

  const handlePrint = () => {
    window.print();
  };

  const renderAddress = (c: Client) => {
    if (mode === 'oba') {
      return (
        <div className="space-y-1">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Firma: </span>
            <span>{c.address?.street} {c.address?.number}, {c.address?.zipCode} {c.address?.city}</span>
          </div>
          {c.shippingAddress?.city && (
            <div>
              <span className="text-[10px] font-bold text-blue-400 uppercase">Wysyłka: </span>
              <span className="text-blue-700">{c.shippingAddress.street} {c.shippingAddress.number}, {c.shippingAddress.zipCode} {c.shippingAddress.city}</span>
            </div>
          )}
        </div>
      );
    }

    const addr = mode === 'wysyłka' && c.shippingAddress?.city ? c.shippingAddress : c.address;
    if (!addr?.city) return <span className="text-slate-300 italic">brak adresu</span>;
    return <span>{addr.street} {addr.number}, {addr.zipCode} {addr.city}</span>;
  };

  const renderProvince = (c: Client) => {
    const addr = mode === 'wysyłka' && c.shippingAddress?.city ? c.shippingAddress : c.address;
    return addr?.province || '—';
  };

  return (
    <div className="print:text-black">

      {/* Nagłówek */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 print:hidden">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">📍 Adresy Klientów</h2>
          <p className="text-slate-500 text-sm mt-1">
            {filtered.length} z {clients.length} klientów
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors shadow-sm"
        >
          🖨️ Drukuj listę
        </button>
      </div>

      {/* Filtry */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 print:hidden">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Szukaj (nazwa, miasto, ulica, osoba)..."
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-slate-50 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full md:w-1/4">
          <select
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-slate-50 text-sm cursor-pointer"
            value={province}
            onChange={e => setProvince(e.target.value)}
          >
            <option value="">Wszystkie województwa</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="w-full md:w-1/4">
          <select
            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-slate-50 text-sm cursor-pointer"
            value={mode}
            onChange={e => setMode(e.target.value as AddressMode)}
          >
            <option value="firma">🏢 Adres siedziby</option>
            <option value="wysyłka">📦 Adres wysyłki</option>
            <option value="oba">📋 Oba adresy</option>
          </select>
        </div>
      </div>

      {/* Tytuł wydruku */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Lista adresów klientów — CRM Pluszek</h1>
        <p className="text-sm text-gray-500 mt-1">
          Wydrukowano: {new Date().toLocaleDateString('pl-PL')} | Liczba klientów: {filtered.length}
        </p>
        <hr className="mt-3" />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 print:bg-gray-100">
                <th className="text-left px-5 py-4 font-bold text-slate-600 text-xs uppercase tracking-wide">#</th>
                <th className="text-left px-5 py-4 font-bold text-slate-600 text-xs uppercase tracking-wide">Firma</th>
                <th className="text-left px-5 py-4 font-bold text-slate-600 text-xs uppercase tracking-wide">Osoba kontaktowa</th>
                <th className="text-left px-5 py-4 font-bold text-slate-600 text-xs uppercase tracking-wide">Adres</th>
                <th className="text-left px-5 py-4 font-bold text-slate-600 text-xs uppercase tracking-wide">Województwo</th>
                <th className="text-left px-5 py-4 font-bold text-slate-600 text-xs uppercase tracking-wide print:hidden">Telefon</th>
                <th className="text-left px-5 py-4 font-bold text-slate-600 text-xs uppercase tracking-wide print:hidden">NIP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Brak klientów spełniających kryteria.
                  </td>
                </tr>
              ) : (
                filtered.map((client, idx) => (
                  <tr
                    key={client.id}
                    className="hover:bg-slate-50/60 transition-colors print:hover:bg-transparent"
                  >
                    <td className="px-5 py-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide ${
                          client.type === 'hurt'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {client.type}
                        </span>
                        <span className="font-bold text-slate-800">{client.companyName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{client.contactPerson || '—'}</td>
                    <td className="px-5 py-4 text-slate-700">{renderAddress(client)}</td>
                    <td className="px-5 py-4 text-slate-500 text-xs">{renderProvince(client)}</td>
                    <td className="px-5 py-4 text-slate-600 print:hidden">
                      {client.phone ? (
                        <a href={`tel:${client.phone}`} className="hover:text-blue-600 transition-colors font-mono text-xs">
                          {client.phone}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-mono text-xs print:hidden">
                      {client.nip || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stopka wydruku */}
      <div className="hidden print:block mt-6 text-xs text-gray-400 border-t pt-3">
        CRM Pluszek — wydruk wygenerowany automatycznie
      </div>
    </div>
  );
};

export default AddressesView;
