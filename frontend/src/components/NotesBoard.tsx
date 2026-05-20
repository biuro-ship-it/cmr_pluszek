import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// 1. Definiujemy strukturę naszej Notatki
interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  color: string;
  isImportant: boolean;
  isUrgent: boolean; // NOWE: Znacznik Pilne
}

// 2. Dostępne kolory fiszek (klasy Tailwind)
const NOTE_COLORS = [
  { id: 'yellow', bg: 'bg-yellow-100', border: 'border-yellow-300', hover: 'hover:border-yellow-400' },
  { id: 'blue', bg: 'bg-blue-100', border: 'border-blue-300', hover: 'hover:border-blue-400' },
  { id: 'emerald', bg: 'bg-emerald-100', border: 'border-emerald-300', hover: 'hover:border-emerald-400' },
  { id: 'rose', bg: 'bg-rose-100', border: 'border-rose-300', hover: 'hover:border-rose-400' },
  { id: 'slate', bg: 'bg-slate-100', border: 'border-slate-300', hover: 'hover:border-slate-400' },
];

const NotesBoard: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  
  // Stany formularza
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0]);
  const [isImportant, setIsImportant] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false); // Stan dla dynamitu

  // Tymczasowy stan z notatkami (później zastąpimy to pobieraniem z bazy)
  const [notes, setNotes] = useState<Note[]>([
    {
      id: '1',
      title: 'Procedura obsługi trudnego klienta',
      content: '<p>Pamiętaj o <strong>uśmiechu</strong> i zachowaniu spokoju. Kroki postępowania:</p><ol><li>Wysłuchaj</li><li>Zaproponuj rozwiązanie</li></ol>',
      date: '2026-05-20',
      color: 'bg-rose-100',
      isImportant: true,
      isUrgent: false,
    },
    {
      id: '2',
      title: 'AWARIA: Problem z logowaniem na FTP',
      content: '<p>Trzeba to naprawić natychmiast!</p>',
      date: '2026-05-20',
      color: 'bg-slate-100',
      isImportant: false,
      isUrgent: true, // Testowy dynamit
    },
    {
      id: '3',
      title: 'Pomysły na nową kampanię',
      content: '<p>Wrzucić więcej postów na social media z użyciem nowych antyram.</p>',
      date: '2026-05-19',
      color: 'bg-yellow-100',
      isImportant: false,
      isUrgent: false,
    }
  ]);

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'table'],
      ['clean']
    ],
  };

  const handleEditClick = (note: Note) => {
    setEditingNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setIsImportant(note.isImportant);
    setIsUrgent(note.isUrgent || false);
    
    const foundColor = NOTE_COLORS.find(c => c.bg === note.color) || NOTE_COLORS[0];
    setSelectedColor(foundColor);
    
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingNoteId(null);
    setTitle('');
    setContent('');
    setFile(null);
    setIsImportant(false);
    setIsUrgent(false);
    setSelectedColor(NOTE_COLORS[0]);
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert("Podaj temat notatki!");
      return;
    }

    if (editingNoteId) {
      setNotes(notes.map(note => 
        note.id === editingNoteId 
          ? { ...note, title, content, color: selectedColor.bg, isImportant, isUrgent } 
          : note
      ));
    } else {
      const newNote: Note = {
        id: Math.random().toString(),
        title,
        content,
        date: new Date().toISOString().split('T')[0],
        color: selectedColor.bg,
        isImportant,
        isUrgent,
      };
      setNotes([...notes, newNote]);
    }

    handleCloseForm();
  };

  // ZAAWANSOWANE SORTOWANIE: 1. Pilne (🧨), 2. Ważne (⭐), 3. Data
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;
    
    if (a.isImportant && !b.isImportant) return -1;
    if (!a.isImportant && b.isImportant) return 1;
    
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="animate-in fade-in duration-300">
      
      {/* NAGŁÓWEK */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Tablica Notatek</h2>
          <p className="text-slate-500 text-sm">Twoja baza wiedzy, procedury i luźne zapiski</p>
        </div>
        <button
          onClick={showForm ? handleCloseForm : () => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-all"
        >
          {showForm ? '✕ Zamknij edytor' : '＋ Dodaj notatkę'}
        </button>
      </div>

      {/* FORMULARZ EDYCJI */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 animate-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            {editingNoteId ? '📝 Edytujesz notatkę' : '✨ Nowa notatka'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Temat notatki</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-slate-300 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="np. Nowa procedura zwrotów..."
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="block text-sm font-bold text-slate-700 mb-2">Wygląd i priorytet</label>
              <div className="flex flex-wrap items-center gap-3">
                
                {/* Wybór koloru */}
                <div className="flex gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  {NOTE_COLORS.map(color => (
                    <button
                      key={color.id}
                      onClick={() => setSelectedColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${color.bg} ${
                        selectedColor.id === color.id ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent'
                      }`}
                      title={`Kolor: ${color.id}`}
                    />
                  ))}
                </div>

                {/* Znacznik WAŻNE */}
                <label className="flex items-center gap-2 cursor-pointer bg-amber-50 p-2 rounded-xl border border-amber-200 hover:bg-amber-100 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={isImportant} 
                    onChange={(e) => setIsImportant(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-amber-300 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-amber-700">⭐ Ważne</span>
                </label>

                {/* Znacznik PILNE (NOWY) */}
                <label className="flex items-center gap-2 cursor-pointer bg-red-50 p-2 rounded-xl border border-red-200 hover:bg-red-100 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={isUrgent} 
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-600 border-red-300 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-red-700">🧨 Pilne</span>
                </label>

              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-1">Treść (Edytor)</label>
            <div className="bg-white rounded-xl overflow-hidden border border-slate-300">
              <ReactQuill 
                theme="snow" 
                value={content} 
                onChange={setContent} 
                modules={modules}
                className="h-64 mb-10"
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

          <div className="flex gap-3">
            <button 
              onClick={handleSave} 
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all shadow-sm text-base"
            >
              {editingNoteId ? '💾 Zapisz zmiany' : '💾 Utwórz notatkę'}
            </button>
            <button 
              onClick={handleCloseForm} 
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 px-6 rounded-xl transition-all text-base"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* TABLICA Z FISZKAMI (SIATKA) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sortedNotes.length > 0 ? (
          sortedNotes.map(note => (
            <div 
              key={note.id} 
              className={`relative p-5 rounded-3xl border ${
                note.isUrgent ? 'border-red-400 shadow-red-100 shadow-lg' : 'border-black/5 shadow-sm'
              } transition-all hover:shadow-md ${note.color}`}
            >
              {/* Odznaka priorytetu (bez animacji bounce) */}
              {(note.isUrgent || note.isImportant) && (
                <div className="absolute -top-3 -right-3 bg-white text-xl p-1.5 rounded-full shadow-md border border-slate-100">
                  {note.isUrgent ? '🧨' : '⭐'}
                </div>
              )}
              
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-extrabold text-slate-900 leading-tight pr-4">{note.title}</h3>
              </div>
              
              <p className="text-xs font-bold text-slate-500 mb-4 opacity-70 border-b border-black/10 pb-2">
                Dodano: {note.date}
              </p>
              
              {/* Podgląd treści */}
              <div 
                className="text-sm text-slate-700 line-clamp-4 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: note.content }}
              />
              
              <div className="mt-4 pt-4 border-t border-black/10">
                <button 
                  onClick={() => handleEditClick(note)}
                  className="text-xs font-bold bg-white/50 hover:bg-white px-3 py-1.5 rounded-lg transition-colors w-full text-center"
                >
                  Otwórz i edytuj 🔍
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-16 text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
            Brak notatek na tablicy.
          </div>
        )}
      </div>

    </div>
  );
};

export default NotesBoard;