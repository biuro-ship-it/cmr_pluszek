import React, { useState, useEffect } from 'react';
import { Supplier, SupplierFormData, getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../services/api';
import SupplierCard from './SupplierCard';

const COLOR_CLASSES: Record<string, string> = {
  default: 'bg-white',
  lilac: 'bg-purple-50',
  cream: 'bg-amber-50',
  pink: 'bg-rose-50',
  mint: 'bg-emerald-50',
};

// Kolory próbek w wyborze kolorystyki kafelka.
const SWATCH: Record<string, string> = {
  default: 'bg-white',
  lilac: 'bg-purple-200',
  cream: 'bg-amber-200',
  pink: 'bg-rose-200',
  mint: 'bg-emerald-200',
};

const emptyForm = (): SupplierFormData => ({
  companyName: '', category: '', email: '', phoneCompany: '', phoneSales: '', phoneOwner: '', whatsapp: '', messenger: '', notes: '', relationshipColor: 'default', files: [], materials: [],
  address: { street: '', zipCode: '', city: '' },
  contactNames: { company: '', sales: '', owner: '' },
  agreements: { discount: '', paymentTerm: '', deliveryFreq: '' },
});

const labelCls = 'text-xs font-bold text-slate-500 uppercase mb-1 block';
const inputCls = 'w-full border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 bg-white';

export default function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState<SupplierFormData>(emptyForm());

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      setSuppliers(await getSuppliers());
    } catch {
      alert('Błąd pobierania dostawców');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const openForm = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setForm({
        ...supplier,
        materials: supplier.materials || [],
        address: supplier.address || { street: '', zipCode: '', city: '' },
        contactNames: supplier.contactNames || { company: '', sales: '', owner: '' },
        agreements: supplier.agreements || { discount: '', paymentTerm: '', deliveryFreq: '' },
      });
    } else {
      setEditingSupplier(null);
      setForm(emptyForm());
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalForm = { ...form };
    try {
      if (editingSupplier) {
        const updated = await updateSupplier(editingSupplier.id, finalForm);
        setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
      } else {
        const created = await createSupplier(finalForm);
        setSuppliers([created, ...suppliers]);
      }
      setShowForm(false);
    } catch {
      alert('Błąd zapisu dostawcy');
    }
  };

  const handleDelete = async (id: string) => {
    const name = suppliers.find(s => s.id === id)?.companyName ?? '';
    if (!window.confirm(`Czy na pewno usunąć dostawcę "${name}"? Tej operacji nie można cofnąć.`)) return;
    try {
      await deleteSupplier(id);
      setSuppliers(prev => prev.filter(s => s.id !== id));
      if (editingSupplier?.id === id) {
        setShowForm(false);
        setEditingSupplier(null);
      }
    } catch {
      alert('Błąd usuwania dostawcy');
    }
  };

  if (viewSupplier) {
    return (
      <SupplierCard
        supplier={viewSupplier}
        onClose={() => { setViewSupplier(null); fetchSuppliers(); }}
        onSupplierUpdated={(updated) => setViewSupplier(updated)}
      />
    );
  }

  const filtered = suppliers.filter(s =>
    s.companyName.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Baza Dostawców</h2>
          <p className="text-sm text-slate-500 mt-1">Zarządzaj dostawcami surowców, cennikami i zamówieniami</p>
        </div>
        {!showForm && (
          <button onClick={() => openForm()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
            ＋ Dodaj dostawcę
          </button>
        )}
      </div>

      {showForm ? (
        <div className={`max-w-5xl mx-auto rounded-2xl border border-slate-200 p-6 transition-colors ${COLOR_CLASSES[form.relationshipColor]}`}>
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xl font-bold text-slate-800">{editingSupplier ? 'Edytuj dostawcę' : 'Nowy dostawca'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* RZĄD 1: Dane Podstawowe */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nazwa firmy</label>
                <input required type="text" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Kategoria</label>
                <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls} placeholder="Wpisz kategorię (np. Szkło, Kartony...)" />
              </div>
            </div>

            {/* RZĄD 2: Dane adresowe */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Kod pocztowy</label>
                <input type="text" value={form.address?.zipCode} onChange={e => setForm({ ...form, address: { ...form.address!, zipCode: e.target.value } })} className={inputCls} placeholder="00-000" />
              </div>
              <div>
                <label className={labelCls}>Miasto</label>
                <input type="text" value={form.address?.city} onChange={e => setForm({ ...form, address: { ...form.address!, city: e.target.value } })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Ulica i numer</label>
                <input type="text" value={form.address?.street} onChange={e => setForm({ ...form, address: { ...form.address!, street: e.target.value } })} className={inputCls} />
              </div>
            </div>

            {/* RZĄD 3: Numery Telefonów z Podziałem i Imionami */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 pt-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className={labelCls}>🏢 Tel. Firmowy (Biuro)</label>
                <input type="text" placeholder="Dział / Obsługa (opcjonalnie)" value={form.contactNames?.company} onChange={e => setForm({ ...form, contactNames: { ...form.contactNames!, company: e.target.value } })} className={`${inputCls} text-sm mb-2`} />
                <input type="text" placeholder="Numer telefonu" value={form.phoneCompany} onChange={e => setForm({ ...form, phoneCompany: e.target.value })} className={`${inputCls} text-sm`} />
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className={labelCls}>👨‍💼 Tel. Handlowiec / Opiekun</label>
                <input type="text" placeholder="Imię i nazwisko handlowca" value={form.contactNames?.sales} onChange={e => setForm({ ...form, contactNames: { ...form.contactNames!, sales: e.target.value } })} className={`${inputCls} text-sm mb-2`} />
                <input type="text" placeholder="Numer telefonu" value={form.phoneSales} onChange={e => setForm({ ...form, phoneSales: e.target.value })} className={`${inputCls} text-sm`} />
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className={labelCls}>👑 Tel. Właściciel / Szef</label>
                <input type="text" placeholder="Imię i nazwisko szefa" value={form.contactNames?.owner} onChange={e => setForm({ ...form, contactNames: { ...form.contactNames!, owner: e.target.value } })} className={`${inputCls} text-sm mb-2`} />
                <input type="text" placeholder="Numer telefonu" value={form.phoneOwner} onChange={e => setForm({ ...form, phoneOwner: e.target.value })} className={`${inputCls} text-sm`} />
              </div>
            </div>

            {/* RZĄD 4: Kanały Komunikacji Elektronicznej */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>✉️ E-mail do zamówień</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="zamowienia@..." />
              </div>
              <div>
                <label className={`${labelCls} text-emerald-600`}>WhatsApp (Numer)</label>
                <input type="text" placeholder="np. 48123456789" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={`${labelCls} text-[#0084FF]`}>Messenger (ID / Link)</label>
                <input type="text" placeholder="np. nazwa.profilu" value={form.messenger} onChange={e => setForm({ ...form, messenger: e.target.value })} className={inputCls} />
              </div>
            </div>

            {/* RZĄD 5: UZGODNIENIA HANDLOWE */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h4 className="font-semibold text-sm mb-3 text-slate-700">🤝 Stałe uzgodnienia logistyczno-handlowe</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Poziom Rabatu</label>
                  <input type="text" placeholder="np. 15% na profile, 5% szkło" value={form.agreements?.discount} onChange={e => setForm({ ...form, agreements: { ...form.agreements!, discount: e.target.value } })} className={`${inputCls} text-sm`} />
                </div>
                <div>
                  <label className={labelCls}>Termin Płatności</label>
                  <input type="text" placeholder="np. przelew 14 dni, pobranie" value={form.agreements?.paymentTerm} onChange={e => setForm({ ...form, agreements: { ...form.agreements!, paymentTerm: e.target.value } })} className={`${inputCls} text-sm`} />
                </div>
                <div>
                  <label className={labelCls}>Częstotliwość Dostaw</label>
                  <input type="text" placeholder="np. każdy wtorek rano, kurier" value={form.agreements?.deliveryFreq} onChange={e => setForm({ ...form, agreements: { ...form.agreements!, deliveryFreq: e.target.value } })} className={`${inputCls} text-sm`} />
                </div>
              </div>
            </div>

            {/* RZĄD 6: UWAGI / NOTATKI */}
            <div>
              <label className={labelCls}>📝 Ogólne uwagi / Dodatkowe warunki handlowe</label>
              <textarea rows={3} placeholder="Wszelkie inne ważne adnotacje, np. darmowe minimum logistyczne od 2000zł netto..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={`${inputCls} text-sm resize-none`} />
            </div>

            {/* RZĄD 7: Kolorystyka i wysyłka */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <label className={labelCls}>Kolorystyka kafelka</label>
                <div className="flex gap-3">
                  {Object.keys(SWATCH).map(colorId => (
                    <button
                      key={colorId}
                      type="button"
                      onClick={() => setForm({ ...form, relationshipColor: colorId })}
                      className={`w-8 h-8 rounded-full border border-slate-300 transition-transform ${SWATCH[colorId]} ${
                        form.relationshipColor === colorId ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {editingSupplier && (
                  <button type="button" onClick={() => handleDelete(editingSupplier.id)} className="bg-red-50 text-red-600 hover:bg-red-100 font-bold px-6 py-2.5 rounded-xl transition-colors">
                    🗑 Usuń dostawcę
                  </button>
                )}
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 py-2.5 rounded-xl min-w-[200px] transition-colors">
                  Zapisz dostawcę
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        /* LISTA DOSTAWCÓW */
        <>
          <div className="mb-6">
            <input type="text" placeholder="Szukaj dostawcy..." className={`${inputCls} max-w-md`} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loading ? <p className="text-center text-sm text-slate-500 py-6">Ładowanie...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(s => (
                <div key={s.id} className={`rounded-2xl border border-slate-200 p-6 flex flex-col h-full shadow-sm hover:shadow-md transition-shadow ${COLOR_CLASSES[s.relationshipColor || 'default']}`}>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg">{s.category}</span>
                    <button type="button" onClick={() => openForm(s)} className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg hover:bg-slate-200 transition-colors">Edytuj</button>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 truncate" title={s.companyName}>{s.companyName}</h3>
                  <div className="text-sm text-slate-600 space-y-1.5 mb-4 flex-grow">
                    {s.phoneCompany && <p>📞 {s.contactNames?.company ? `${s.contactNames.company}: ` : ''}{s.phoneCompany}</p>}
                    {s.phoneSales && <p>👨‍💼 {s.contactNames?.sales ? `${s.contactNames.sales}: ` : ''}{s.phoneSales}</p>}
                    {s.email && <p className="truncate">✉️ {s.email}</p>}
                    {s.files?.length > 0 && <p className="text-xs text-slate-400 pt-1 font-medium">📎 Załączono cenniki: {s.files.length}</p>}
                  </div>
                  <div className="flex gap-2 mt-auto border-t border-slate-100 pt-4">
                    <button type="button" onClick={() => setViewSupplier(s)} className="flex-1 bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold py-2 rounded-lg transition-colors">Otwórz kartę</button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-6 text-center py-10">
                  <p className="text-sm text-slate-400">Brak pasujących dostawców.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
