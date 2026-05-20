import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Style dla edytora

const NotesBoard: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Konfiguracja paska narzędzi edytora (dodajemy pogrubienie, listy, tabele itp.)
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'table'], // Obsługa tabel i linków
      ['clean']
    ],
  };

  const handleSave = () => {
    // Tutaj później dodamy wysyłanie do backendu
    const today = new Date().toISOString().split('T')[0]; // Format RRRR-MM-DD
    console.log("Zapisywanie notatki:", { title, content, file, date: today });
    alert("Notatka gotowa do wysłania (funkcja w przygotowaniu)!");
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Tablica Notatek</h2>
          <p className="text-slate-500 text-sm">Twoja baza wiedzy, procedury i luźne zapiski</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-all"
        >
          {showForm ? '✕ Zamknij edytor' : '＋ Dodaj notatkę'}
        </button>
      </div>

      {showForm ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-1">Temat notatki</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="np. Nowa procedura zwrotów..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-1">Treść (Edytor)</label>
            <div className="bg-white rounded-xl overflow-hidden border border-slate-300">
              <ReactQuill 
                theme="snow" 
                value={content} 
                onChange={setContent} 
                modules={modules}
                className="h-64 mb-10" // Margines na pasek narzędzi Quill
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-1">Załącz plik (PDF, JPG, itp.)</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
            />
          </div>

          <button onClick={handleSave} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
            💾 Zapisz notatkę
          </button>
        </div>
      ) : (
        <div className="text-center py-16 text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
          Brak notatek. Kliknij "Dodaj notatkę", aby rozpocząć.
        </div>
      )}
    </div>
  );
};

export default NotesBoard;