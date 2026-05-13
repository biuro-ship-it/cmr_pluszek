import React, { useState, useEffect, ChangeEvent } from 'react';
import { ClientFormData, Client, ClientType, Address, emptyAddress } from '../services/api';

interface ClientFormProps {
  initial?: Client | null;
  onSubmit: (data: ClientFormData) => Promise<void> | void;
  onCancel: () => void;
}

// Mapowanie kodu pocztowego → województwo
const voivodeshipMap: Record<string, string> = {
  '0': 'Mazowieckie',
  '1': 'Podlaskie / Warmińsko-Mazurskie',
  '2': 'Lubelskie / Świętokrzyskie',
  '3': 'Małopolskie / Podkarpackie',
  '4': 'Śląskie / Opolskie',
  '5': 'Dolnośląskie',
  '6': 'Wielkopolskie / Lubuskie',
  '7': 'Zachodniopomorskie / Pomorskie',
  '8': 'Kujawsko-Pomorskie / Pomorskie',
  '9': 'Łódzkie',
};

interface NipResult {
  name: string;
  regon: string;
  city: string;
  street: string;
  zipCode: string;
}

// ─── Podformularz adresu ────────────────────────────────────────────────────

interface AddressFormProps {
  value: Address;
  onChange: (addr: Address) => void;
  prefix?: string;
}

const AddressForm: React.FC<AddressFormProps> = ({ value, onChange, prefix = '' }) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value: val } = e.target;
    let updated = { ...value, [name]: val };

    // Auto-województwo po kodzie pocztowym
    if (name === 'zipCode' && val.length >= 1) {
      updated.province = voivodeshipMap[val[0]] || updated.province;
    }

    // Auto-myślnik w kodzie XX-XXX
    if (name === 'zipCode') {
      const digits = val.replace(/\D/g, '').slice(0, 5);
      updated.zipCode = digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
      if (digits.length >= 1) {
        updated.province = voivodeshipMap[digits[0]] || updated.province;
      }
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
          <input
            name="zipCode"
            value={value.zipCode}
            onChange={handleChange}
            className={inputCls}
            placeholder="00-000"
            maxLength={6}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Województwo (auto)</label>
          <input
            name="province"
            value={value.province}
            onChange={handleChange}
            className={`${inputCls} bg-slate-50 text-slate-500`}
            placeholder="Automatyczne"
          />
        </div>
      </div>
    </div>
  );
};

// ─── Główny komponent ────────────────────────────────────────────────────────

const ClientForm: React.FC<ClientFormProps> = ({ initial, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<ClientFormData>({
    companyName: initial?.companyName || '',
    type: (initial?.type as ClientType) || 'hurt',
    nip: initial?.nip || '',
    contactPerson: initial?.contactPerson || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    address: initial?.address || emptyAddress(),
    shippingAddress: initial?.shippingAddress,
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
    });
    setShowShipping(!!initial?.shippingAddress);
  }, [initial]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // NIP lookup z rejestru VAT MF (zapytanie z przeglądarki — mydevil blokuje outbound)
  const handleNipLookup = async () => {
    const nip = formData.nip.replace(/[-\s]/g, '');
    if (nip.length !== 10) {
      setNipError('NIP musi mieć 10 cyfr');
      return;
    }
    setNipLoading(true);
    setNipError('');
    setNipSuccess('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const url = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${today}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Brak wyników');
      const data = await response.json();
      const subject = data?.result?.subject;
      if (!subject) throw new Error('Firma nie znaleziona');

      const result: NipResult = {
        name: subject.name || '',
        regon: subject.regon || '',
        city: subject.workingAddress?.split(',')[1]?.trim() || '',
        street: subject.workingAddress?.split(',')[0]?.trim() || '',
        zipCode: '',
      };

      setFormData(prev => ({
        ...prev,
        companyName: result.name || prev.companyName,
      }));
      setNipSuccess(`✓ Znaleziono: ${result.name}`);
    } catch {
      setNipError('Nie znaleziono firmy w rejestrze VAT lub firma zwolniona z VAT');
    } finally {
      setNipLoading(false);
    }
  };

  const handleToggleShipping = () => {
    setShowShipping(prev => {
      if (!prev) {
        setFormData(f => ({ ...f, shippingAddress: emptyAddress() }));
      } else {
        setFormData(f => ({ ...f, shippingAddress: undefined }));
      }
      return !prev;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        shippingAddress: showShipping ? formData.shippingAddress : undefined,
      };
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors';
  const labelCls = 'text-xs font-bold text-slate-500 uppercase mb-1 block';

  const CLIENT_TYPES: { value: ClientType; label: string }[] = [
    { value: 'hurt', label: '🏭 Hurt' },
    { value: 'sklep', label: '🏪 Sklep' },
  ];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Nagłówek */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-5">
        <h2 className="text-xl font-bold text-white">
          {initial ? '✎ Edytuj klienta' : '＋ Nowy klient'}
        </h2>
        <p className="text-blue-100 text-sm mt-0.5">
          {initial ? `Zmieniasz dane: ${initial.companyName}` : 'Wypełnij dane kontrahenta'}
        </p>
      </div>

      <div className="p-8 space-y-8">

        {/* SEKCJA 1: Podstawowe dane */}
        <section>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Dane podstawowe</h3>
          <div className="space-y-4">

            {/* Typ klienta */}
            <div>
              <label className={labelCls}>Typ klienta</label>
              <div className="flex gap-3">
                {CLIENT_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: t.value }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                      formData.type === t.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Nazwa firmy */}
            <div>
              <label className={labelCls}>Nazwa firmy / Klienta *</label>
              <input
                required
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className={inputCls}
                placeholder="np. Sklep Odzieżowy Kowalski"
              />
            </div>

            {/* NIP */}
            <div>
              <label className={labelCls}>NIP</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="nip"
                  value={formData.nip}
                  onChange={e => {
                    setNipError(''); setNipSuccess('');
                    setFormData(prev => ({ ...prev, nip: e.target.value }));
                  }}
                  className={`flex-1 ${inputCls}`}
                  placeholder="0000000000"
                  maxLength={13}
                />
                <button
                  type="button"
                  onClick={handleNipLookup}
                  disabled={nipLoading || formData.nip.replace(/[-\s]/g, '').length !== 10}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  {nipLoading ? '⏳' : '🔍 Sprawdź'}
                </button>
              </div>
              {nipError && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><span>⚠</span>{nipError}</p>}
              {nipSuccess && <p className="text-emerald-600 text-xs mt-1.5">{nipSuccess}</p>}
            </div>
          </div>
        </section>

        {/* SEKCJA 2: Dane kontaktowe */}
        <section>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Kontakt</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Osoba kontaktowa</label>
              <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange}
                className={inputCls} placeholder="Jan Kowalski" />
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                className={inputCls} placeholder="+48 600 000 000" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Adres e-mail</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange}
                className={inputCls} placeholder="kontakt@firma.pl" />
            </div>
          </div>
        </section>

        {/* SEKCJA 3: Adres firmy */}
        <section>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Adres siedziby</h3>
          <AddressForm
            value={formData.address}
            onChange={addr => setFormData(prev => ({ ...prev, address: addr }))}
          />
        </section>

        {/* SEKCJA 4: Adres wysyłki (collapsible) */}
        <section>
          <button
            type="button"
            onClick={handleToggleShipping}
            className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span className={`transition-transform ${showShipping ? 'rotate-90' : ''}`}>▶</span>
            {showShipping ? 'Ukryj adres wysyłki' : '+ Dodaj osobny adres do wysyłki'}
          </button>

          {showShipping && formData.shippingAddress && (
            <div className="mt-4 p-5 bg-blue-50/60 rounded-2xl border border-blue-100 animate-in fade-in duration-200">
              <p className="text-xs font-bold text-blue-500 uppercase mb-3">📦 Adres wysyłki / dostawy</p>
              <AddressForm
                value={formData.shippingAddress}
                onChange={addr => setFormData(prev => ({ ...prev, shippingAddress: addr }))}
                prefix="Wysyłka — "
              />
            </div>
          )}
        </section>

      </div>

      {/* Stopka z przyciskami */}
      <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 transition-colors"
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-60 flex items-center gap-2"
        >
          {saving ? (
            <><span className="animate-spin">⏳</span> Zapisuję...</>
          ) : (
            <>{initial ? '✓ Zapisz zmiany' : '＋ Dodaj klienta'}</>
          )}
        </button>
      </div>
    </form>
  );
};

export default ClientForm;
