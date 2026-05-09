import React, { useState, useEffect } from 'react';
import { Client, Interaction, InteractionFormData, Product, getClientInteractions, createClientInteraction, getProductsList, createFollowUp } from '../services/api';

interface ClientCardProps {
  client: Client;
  onClose: () => void;
}

const ClientCard: React.FC<ClientCardProps> = ({ client, onClose }) => {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<InteractionFormData>({
    contactDate: new Date().toISOString().split('T')[0],
    channel: 'telefon',
    notes: '',
    tradeNotes: '',
    products: []
  });

  // NOWE: Stan dla modułu Follow-Up
  const [planFollowUp, setPlanFollowUp] = useState(false);
  const [followUpData, setFollowUpData] = useState({
    dueDate: '',
    reminderText: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [interactionsData, productsData] = await Promise.all([
          getClientInteractions(client.id),
          getProductsList()
        ]);
        setInteractions(interactionsData);
        setProducts(productsData);
      } catch (err) {
        console.error("Błąd ładowania danych karty:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [client.id]);

  const handleProductToggle = (productName: string) => {
    setFormData(prev => {
      const isSelected = prev.products.includes(productName);
      if (isSelected) return { ...prev, products: prev.products.filter(p => p !== productName) };
      return { ...prev, products: [...prev.products, productName] };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newInteraction = await createClientInteraction(client.id, formData);
      setInteractions([newInteraction, ...interactions]);
      
      // NOWE: Zapisywanie zadania, jeśli checkbox zaznaczono
      if (planFollowUp && followUpData.dueDate) {
        await createFollowUp(client.id, {
          clientName: client.companyName,
          dueDate: followUpData.dueDate,
          reminderText: followUpData.reminderText || 'Zaplanowany kontakt'
        });
      }

      setShowForm(false);
      setFormData({ ...formData, notes: '', tradeNotes: '', products: [] });
      setPlanFollowUp(false);
      setFollowUpData({ dueDate: '', reminderText: '' });
    } catch (err) {
      alert("Nie udało się zapisać kontaktu.");
    }
  };

  return (
    <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 animate-in fade-in duration-300">
      <button onClick={onClose} className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors">
        <span>←</span> Wróć do listy klientów
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start border-b border-slate-100 pb-6 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-black text-slate-800">{client.companyName}</h2>
            <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${client.type === 'hurt' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {client.type}
            </span>
          </div>
          <p className="text-slate-500 font-medium">Osoba kontaktowa: <span className="text-slate-800 font-bold">{client.contactPerson || 'Brak'}</span></p>
        </div>
        <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-2xl md:text-right w-full md:w-auto">
          <p className="flex items-center gap-2 md:justify-end mb-1"><span>📞</span> <a href={`tel:${client.phone}`} className="hover:text-blue-600 font-bold">{client.phone || 'Brak'}</a></p>
          <p className="flex items-center gap-2 md:justify-end"><span>✉️</span> <a href={`mailto:${client.email}`} className="hover:text-blue-600 font-bold">{client.email || 'Brak'}</a></p>
          <p className="flex items-center gap-2 md:justify-end mt-2 text-xs"><span>📍</span> {client.address?.city}, {client.address?.street}</p>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">Historia Kontaktów</h3>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-slate-900 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
          >
            {showForm ? '✕ Anuluj' : '+ Dodaj notatkę z rozmowy'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 mb-8 animate-in slide-in-from-top-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Data kontaktu</label>
                <input type="date" required className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500"
                  value={formData.contactDate} onChange={e => setFormData({...formData, contactDate: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Forma kontaktu</label>
                <select className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500"
                  value={formData.channel} onChange={e => setFormData({...formData, channel: e.target.value as any})}>
                  <option value="telefon">📞 Telefon</option>
                  <option value="mail">✉️ E-mail</option>
                  <option value="spotkanie">🤝 Spotkanie</option>
                  <option value="inne">📌 Inne</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Przebieg rozmowy (Notatki)</label>
              <textarea required rows={3} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 resize-none"
                placeholder="O czym rozmawialiście?"
                value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Ustalenia Cenowe / Rabaty</label>
                <textarea rows={3} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 resize-none"
                  placeholder="Np. Rabat 10%..."
                  value={formData.tradeNotes} onChange={e => setFormData({...formData, tradeNotes: e.target.value})} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-2 block">Zainteresowany Produktami</label>
                <div className="bg-white border border-slate-200 rounded-xl p-3 max-h-[100px] overflow-y-auto space-y-2">
                  {products.length === 0 ? <p className="text-xs text-slate-400">Brak produktów...</p> : null}
                  {products.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input type="checkbox" checked={formData.products.includes(p.name)} onChange={() => handleProductToggle(p.name)} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span className="text-slate-700">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* NOWE: Moduł Follow-up */}
            <div className="mt-4 pt-4 border-t border-blue-200/50">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-blue-900 mb-4 select-none">
                <input 
                  type="checkbox" 
                  checked={planFollowUp} 
                  onChange={(e) => setPlanFollowUp(e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                />
                ⏰ Zaplanuj kolejny kontakt
              </label>

              {planFollowUp && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-blue-100 animate-in fade-in duration-200">
                  <div className="col-span-1">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Kiedy zadzwonić?</label>
                    <input type="date" required={planFollowUp} className="w-full mt-1 border border-slate-200 rounded-lg p-2 outline-none focus:border-blue-500"
                      value={followUpData.dueDate} onChange={e => setFollowUpData({...followUpData, dueDate: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Notatka dla przypomnienia</label>
                    <input type="text" placeholder="O co zapytać przy kolejnym kontakcie?" className="w-full mt-1 border border-slate-200 rounded-lg p-2 outline-none focus:border-blue-500"
                      value={followUpData.reminderText} onChange={e => setFollowUpData({...followUpData, reminderText: e.target.value})} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button type="submit" className="bg-blue-600 text-white font-bold px-8 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-colors">
                Zapisz notatkę
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-slate-400 text-center py-8">Ładowanie historii...</p>
        ) : interactions.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-100 border-dashed">
            <span className="text-4xl block mb-3">📭</span>
            <p className="text-slate-500 font-medium">Brak wpisów w historii.</p>
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {interactions.map(interaction => (
              <div key={interaction.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-xl">
                  {interaction.channel === 'telefon' ? '📞' : interaction.channel === 'mail' ? '✉️' : interaction.channel === 'spotkanie' ? '🤝' : '📌'}
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-black text-slate-800">{interaction.contactDate}</span>
                    <span className="text-xs text-slate-400">Przez: {interaction.createdBy.split('@')[0]}</span>
                  </div>
                  <p className="text-slate-600 text-sm mb-3">{interaction.notes}</p>
                  
                  {(interaction.tradeNotes || (interaction.products && interaction.products.length > 0)) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 text-xs">
                      {interaction.tradeNotes && <p className="mb-2"><span className="font-bold text-slate-500">💰 Ustalenia:</span> {interaction.tradeNotes}</p>}
                      {interaction.products && interaction.products.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="font-bold text-slate-500 mr-1 mt-1">📦 Produkty:</span>
                          {interaction.products.map((p, i) => <span key={i} className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100">{p}</span>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientCard;