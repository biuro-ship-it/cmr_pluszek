import React, { useState, useEffect, ChangeEvent } from 'react';
import { ClientFormData, Client, ClientType, Address, emptyAddress } from '../services/api';

// Rozszerzamy typy o nasz nowy kolor relacji
type ExtendedClientFormData = ClientFormData & { relationshipColor?: string };
type ExtendedClient = Client & { relationshipColor?: string };

interface ClientFormProps {
  initial?: ExtendedClient | null;
  onSubmit: (data: ExtendedClientFormData) => Promise<void> | void;
  onCancel: () => void;
}

const voivodeshipMap: Record<string, string> = {
  '0': 'Mazowieckie', '1': 'Podlaskie / Warmińsko-Mazurskie', '2': 'Lubelskie / Świętokrzyskie',
  '3': 'Małopolskie / Podkarpackie', '4': 'Śląskie / Opolskie', '5': 'Dolnośląskie',
  '6': 'Wielkopolskie / Lubuskie', '7': 'Zachodniopomorskie / Pomorskie',
  '8': 'Kujawsko-Pomorskie / Pomorskie', '9': 'Łódzkie',
};

interface NipResult { name: string; regon: string; city: string; street: string; zipCode: string; }

// ─── Dostępne kolory relacji ───
const RELATION_COLORS = [
  { id: 'slate',   bg: 'bg-slate-200', border: 'border-slate-400', label: 'Neutralny / Nowy', emoji: '🏢' },
  { id: 'blue',    bg: 'bg-blue-300',  border: 'border-blue-500',  label: 'Luźna, przyjemna rozmowa', emoji: '🟦' },
  { id: 'emerald', bg: 'bg-emerald-300',border: 'border-emerald-500',label: 'Pełen profesjonalizm', emoji: '🟩' },
  { id: 'rose',    bg: 'bg-rose-300',  border: 'border-rose-500',  label: 'Bliska znajomość (na "Ty")', emoji: '🟥' },
];

const AddressForm: React.FC<{ value: Address; onChange: (addr: Address) => void; prefix?: string }> = ({ value, onChange, prefix = '' }) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value: val } = e.target;
    let updated = { ...value, [name]: val };
    if (name === 'zipCode' && val.length >= 1) updated.province = voivodeshipMap[val[0]] || updated.province;
    if (name === 'zipCode') {
      const digits = val.replace(/\D/g, '').slice(0, 5);
      updated.zipCode = digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
      if (digits.length >= 1) updated.province = voivodeshipMap[digits[0]] || updated.province;
    }
    onChange(updated);
  };
  const inputCls = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{prefix}Ulica</label>
          <input name="street" value={value.street} onChange={handleChange} className={inputCls} placeholder="ul. Kwiatowa" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nr</label>
          <input name="number" value={value.number} onChange={handleChange} className={inputCls} placeholder="12A" />
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Miasto</label>
        <input name="city" value={value.city} onChange={handleChange} className={inputCls} placeholder="Warszawa" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Kod pocztowy</label>
          <input name="zipCode" value={value.zipCode} onChange={handleChange} className={inputCls} placeholder="00-000" maxLength={6} />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Województwo</label>
          <input name="province" value={value.province} onChange={handleChange} className={`${inputCls} bg-slate-50 text-slate-500`} placeholder="Automatyczne" />
        </div>
      </div>
    </div>
  );
};

const ClientForm: React.FC<ClientFormProps> = ({ initial, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<ExtendedClientFormData>({
    companyName: initial?.companyName || '',
    type: (initial?.type as ClientType) || 'hurt',
    nip: initial?.nip || '',
    contactPerson: initial?.contactPerson || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    address: initial?.address || emptyAddress(),
    shippingAddress: initial?.shippingAddress,
    relationshipColor: initial?.relationshipColor || 'slate', // Domyślny kolor
  });

  const [showShipping, setShowShipping] = useState(!!initial?.shippingAddress);
  const [nipLoading, setNipLoading] = useState(false);
  const [nipError, setNipError] = useState('');
  const [nipSuccess, setNipSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData({
      companyName: initial?.companyName || '',
      type: (initial?.type as ClientType) || 'hurt',
      nip: initial?.nip || '',
      contactPerson: initial?.contactPerson || '',
      email: initial?.email || '',
      phone: initial?.phone || '',
      address: initial?.address || emptyAddress(),
      shippingAddress: initial?.shippingAddress,
      relationshipColor: initial?.relationshipColor || 'slate',
    });
    setShowShipping(!!initial?.shippingAddress);
  }, [initial]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNipLookup = async () => {
    const nip = formData.nip.replace(/[-\s]/g, '');
    if (nip.length !== 10) { setNipError('NIP musi mieć 10 cyfr'); return; }
    setNipLoading(true); setNipError(''); setNipSuccess('');
    try {
      const url = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${new Date().toISOString().split('T')[0]}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Brak wyników');
      const data = await response.json();
      const subject = data?.result?.subject;
      if (!subject) throw new Error('Firma nie znaleziona');

      setFormData(prev => ({
        ...prev,
        companyName: subject.name || prev.companyName,
      }));
      setNipSuccess(`✓ Znaleziono: ${subject.name}`);
    } catch {
      setNipError('Nie znaleziono firmy w rejestrze VAT lub firma zwolniona z VAT');
    } finally {
      setNipLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData, shippingAddress: showShipping ? formData.shippingAddress : undefined };
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors';
  const labelCls = 'text-xs font-bold text-slate-500 uppercase mb-1 block';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-5">
        <h2 className="text-xl font-bold text-white">{initial ? '✎ Edytuj klienta' : '＋ Nowy klient'}</h2>
        <p className="text-blue-100 text-sm mt-0.5">{initial ? `Zmieniasz dane: ${initial.companyName}` : 'Wypełnij dane kontrahenta'}</p>
      </div>

      <div className="p-8 space-y-8">
        <section>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Dane podstawowe</h3>
          <div className="space-y-4">
            
            {/* Wybór koloru relacji (Vibe-coding) */}
            <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <label className={labelCls}>Status / Temperament relacji</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                {RELATION_COLORS.map(color => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, relationshipColor: color.id }))}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                      formData.relationshipColor === color.id 
                        ? `${color.border} bg-white shadow-md scale-105` 
                        : 'border-transparent hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-2xl mb-1">{color.emoji}</span>
                    <span className="text-xs font-bold text-slate-700 text-center leading-tight">{color.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Typ klienta</label>
              <div className="flex gap-3">
                {[{ value: 'hurt', label: '🏭 Hurt' }, { value: 'sklep', label: '🏪 Sklep' }].map(t => (
                  <button
                    key={t.value} type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: t.value as ClientType }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                      formData.type === t.value ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Nazwa firmy / Klienta *</label>
              <input required type="text" name="companyName" value={formData.companyName} onChange={handleChange} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>NIP</label>
              <div className="flex gap-2">
                <input type="text" name="nip" value={formData.nip} onChange={e => { setNipError(''); setFormData(prev => ({ ...prev, nip: e.target.value })); }} className={`flex-1 ${inputCls}`} maxLength={13} />
                <button type="button" onClick={handleNipLookup} disabled={nipLoading || formData.nip.replace(/[-\s]/g, '').length !== 10} className="px-4 py-2.5 bg-slate-900 hover:bg-blue-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 whitespace-nowrap">
                  {nipLoading ? '⏳' : '🔍 Sprawdź'}
                </button>
              </div>
              {nipError && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><span>⚠</span>{nipError}</p>}
              {nipSuccess && <p className="text-emerald-600 text-xs mt-1.5">{nipSuccess}</p>}
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Kontakt</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>Osoba kontaktowa</label><input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} className={inputCls} /></div>
            <div><label className={labelCls}>Telefon</label><input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputCls} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Adres e-mail</label><input type="email" name="email" value={formData.email} onChange={handleChange} className={inputCls} /></div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Adres siedziby</h3>
          <AddressForm value={formData.address} onChange={addr => setFormData(prev => ({ ...prev, address: addr }))} />
        </section>

      </div>

      <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-4">
        <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100">Anuluj</button>
        <button type="submit" disabled={saving} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg disabled:opacity-60">
          {saving ? '⏳ Zapisuję...' : initial ? '✓ Zapisz zmiany' : '＋ Dodaj klienta'}
        </button>
      </div>
    </form>
  );
};

export default ClientForm;