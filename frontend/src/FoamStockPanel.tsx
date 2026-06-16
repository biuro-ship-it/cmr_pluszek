import React, { useState, useEffect } from 'react';
import {
  FoamColor, FoamColorFormData, FoamMovement,
  getFoamStock, createFoamColor, updateFoamColor, deleteFoamColor,
  adjustFoamStock, getFoamMovements, seedFoamStock,
} from './services/api';

// ─── Formularz dodawania / edycji koloru ──────────────────────────────────────
const emptyForm = (): FoamColorFormData => ({ name: '', hex: '#3b82f6', minQuantity: 0 });

interface ColorFormProps {
  initial: FoamColorFormData;
  onSave: (data: FoamColorFormData) => Promise<void>;
  onCancel: () => void;
  saveLabel: string;
}

const ColorForm: React.FC<ColorFormProps> = ({ initial, onSave, onCancel, saveLabel }) => {
  const [form, setForm] = useState<FoamColorFormData>(initial);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 rounded-2xl border border-slate-200 p-6 mb-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-1">
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nazwa koloru *</label>
          <input
            required
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="np. Zielony"
            className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 bg-white"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Odcień</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.hex}
              onChange={e => setForm({ ...form, hex: e.target.value })}
              className="w-12 h-12 rounded-lg border border-slate-200 bg-white cursor-pointer p-1"
            />
            <input
              type="text"
              value={form.hex}
              onChange={e => setForm({ ...form, hex: e.target.value })}
              className="flex-1 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 bg-white font-mono text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Próg niskiego stanu (szt.)</label>
          <input
            type="number"
            min="0"
            value={form.minQuantity}
            onChange={e => setForm({ ...form, minQuantity: parseInt(e.target.value) || 0 })}
            className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 bg-white"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 transition-colors">
          Anuluj
        </button>
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 bg-slate-900 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors disabled:opacity-60">
          {saving ? 'Zapisuję...' : saveLabel}
        </button>
      </div>
    </form>
  );
};

// ─── Karta koloru ──────────────────────────────────────────────────────────────
interface ColorCardProps {
  color: FoamColor;
  onAdjust: (id: string, delta: number, reason: string) => Promise<void>;
  onEdit: () => void;
  onDelete: (id: string) => void;
  deleteConfirm: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
}

const ColorCard: React.FC<ColorCardProps> = ({ color, onAdjust, onEdit, onDelete, deleteConfirm, onAskDelete, onCancelDelete }) => {
  const [amount, setAmount] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [movements, setMovements] = useState<FoamMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isLow = color.minQuantity > 0 && color.quantity < color.minQuantity;

  const handleAdjust = async (sign: 1 | -1) => {
    if (!amount || amount <= 0) return;
    setBusy(true);
    try {
      await onAdjust(color.id, sign * amount, reason);
      setReason('');
    } finally {
      setBusy(false);
    }
  };

  const toggleHistory = async () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) {
      setLoadingHistory(true);
      try {
        setMovements(await getFoamMovements(color.id));
      } catch {
        setMovements([]);
      } finally {
        setLoadingHistory(false);
      }
    }
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isLow ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'}`}>
      {/* Pasek koloru */}
      <div className="h-2" style={{ backgroundColor: color.hex }} />

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: color.hex }} />
            <h3 className="font-bold text-slate-800 text-base leading-tight">{color.name}</h3>
          </div>
          {isLow && (
            <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 px-2 py-1 rounded-lg">Niski stan</span>
          )}
        </div>

        {/* Aktualny stan */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className={`text-4xl font-black ${isLow ? 'text-red-600' : 'text-slate-900'}`}>{color.quantity}</span>
          <span className="text-sm font-semibold text-slate-400">szt.</span>
          {color.minQuantity > 0 && (
            <span className="text-xs text-slate-400 ml-auto">min. {color.minQuantity}</span>
          )}
        </div>

        {/* Operacja +/- */}
        <div className="flex items-center gap-2 mb-2">
          <input
            type="number"
            min="1"
            value={amount}
            onChange={e => setAmount(parseInt(e.target.value) || 0)}
            className="w-20 border border-slate-200 rounded-lg p-2 text-center outline-none focus:border-blue-500"
          />
          <button
            disabled={busy}
            onClick={() => handleAdjust(1)}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold py-2 px-1 rounded-lg transition-colors whitespace-nowrap"
          >
            ➕ Przyjęcie
          </button>
          <button
            disabled={busy}
            onClick={() => handleAdjust(-1)}
            className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-bold py-2 px-1 rounded-lg transition-colors whitespace-nowrap"
          >
            ➖ Wydanie
          </button>
        </div>
        <input
          type="text"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Powód (opcjonalnie, np. produkcja zamówienia X)"
          className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-blue-500 mb-3"
        />

        {/* Akcje dolne */}
        <div className="flex gap-2 border-t border-slate-100 pt-3">
          {deleteConfirm ? (
            <>
              <button onClick={() => onDelete(color.id)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 rounded-lg transition-colors">
                ✓ Tak, usuń
              </button>
              <button onClick={onCancelDelete}
                className="flex-1 border border-slate-200 text-slate-600 text-xs font-bold py-2 rounded-lg hover:bg-slate-50 transition-colors">
                Anuluj
              </button>
            </>
          ) : (
            <>
              <button onClick={toggleHistory}
                className="flex-1 border border-slate-200 text-slate-700 text-xs font-bold py-2 rounded-lg hover:bg-slate-50 transition-colors">
                🕓 Historia
              </button>
              <button onClick={onEdit}
                className="flex-1 border border-slate-200 text-slate-700 text-xs font-bold py-2 rounded-lg hover:bg-slate-50 transition-colors">
                ✎ Edytuj
              </button>
              <button onClick={onAskDelete}
                className="px-3 border border-red-100 text-red-400 text-xs font-bold py-2 rounded-lg hover:bg-red-50 transition-colors">
                🗑
              </button>
            </>
          )}
        </div>

        {/* Historia ruchów */}
        {showHistory && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            {loadingHistory ? (
              <p className="text-xs text-slate-400 text-center py-2 animate-pulse">Ładowanie historii...</p>
            ) : movements.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">Brak ruchów.</p>
            ) : (
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {movements.map(m => (
                  <li key={m.id} className="flex items-center justify-between text-xs">
                    <span className={`font-bold ${m.delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </span>
                    <span className="text-slate-500 flex-1 px-2 truncate" title={m.reason}>{m.reason}</span>
                    <span className="text-slate-400 whitespace-nowrap">{new Date(m.at).toLocaleString('pl-PL')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Główny panel ─────────────────────────────────────────────────────────────
const FoamStockPanel: React.FC = () => {
  const [colors, setColors] = useState<FoamColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await seedFoamStock(); // jednorazowo wgrywa startowe kolory (serwer pilnuje duplikatów)
        const data = await getFoamStock();
        if (active) setColors(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać stanu magazynu');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleAdd = async (data: FoamColorFormData) => {
    const created = await createFoamColor(data);
    setColors(prev => [...prev, created]);
    setShowAddForm(false);
  };

  const handleUpdate = async (id: string, data: FoamColorFormData) => {
    const updated = await updateFoamColor(id, data);
    setColors(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFoamColor(id);
      setColors(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Nie udało się usunąć koloru');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleAdjust = async (id: string, delta: number, reason: string) => {
    try {
      const res = await adjustFoamStock(id, delta, reason);
      setColors(prev => prev.map(c => c.id === id ? { ...c, quantity: res.quantity } : c));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Nie udało się zmienić stanu');
    }
  };

  const lowCount = colors.filter(c => c.minQuantity > 0 && c.quantity < c.minQuantity).length;
  const totalQuantity = colors.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold text-slate-900">Magazyn pianek</h2>
            <span className="inline-flex items-baseline gap-1 bg-slate-900 text-white px-3 py-1 rounded-xl font-black text-lg leading-none">
              {totalQuantity}
              <span className="text-[11px] font-semibold text-slate-300">szt. łącznie</span>
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Stan płyt PU wg koloru — {colors.length} {colors.length === 1 ? 'kolor' : 'kolorów'}
            {lowCount > 0 && <span className="text-red-600 font-bold"> · {lowCount} z niskim stanem</span>}
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-200 transition-all"
        >
          {showAddForm ? '✕ Anuluj' : '＋ Dodaj kolor'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4">⚠️ {error}</div>}

      {showAddForm && (
        <ColorForm initial={emptyForm()} onSave={handleAdd} onCancel={() => setShowAddForm(false)} saveLabel="Dodaj kolor" />
      )}

      {loading ? (
        <div className="text-center text-slate-400 py-12 animate-pulse">Ładowanie magazynu...</div>
      ) : colors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <span className="text-4xl block mb-3">🎨</span>
          <p className="text-slate-500">Brak kolorów. Dodaj pierwszy kolor powyżej.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {colors.map(color => (
            editingId === color.id ? (
              <div key={color.id} className="md:col-span-2 lg:col-span-3 xl:col-span-4">
                <ColorForm
                  initial={{ name: color.name, hex: color.hex, minQuantity: color.minQuantity }}
                  onSave={(data) => handleUpdate(color.id, data)}
                  onCancel={() => setEditingId(null)}
                  saveLabel="Zapisz zmiany"
                />
              </div>
            ) : (
              <ColorCard
                key={color.id}
                color={color}
                onAdjust={handleAdjust}
                onEdit={() => { setEditingId(color.id); setShowAddForm(false); }}
                onDelete={handleDelete}
                deleteConfirm={deleteConfirm === color.id}
                onAskDelete={() => setDeleteConfirm(color.id)}
                onCancelDelete={() => setDeleteConfirm(null)}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
};

export default FoamStockPanel;
