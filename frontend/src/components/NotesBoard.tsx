import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { getNotes, createNote, updateNote, deleteNote, seedNotes, uploadFile, Note, NoteFile } from '../services/api';

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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<NoteFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0]);
  const [isImportant, setIsImportant] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await seedNotes(); // jednorazowo wgrywa przykłady (serwer pilnuje, by nie dublować)
        const data = await getNotes();
        if (active) setNotes(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Nie udało się pobrać notatek');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const quillRef = useRef<ReactQuill>(null);

  // Wstawia prostą tabelę: pyta o liczbę wierszy/kolumn i woła moduł table z Quill 2.
  const insertTable = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    const tableModule = editor?.getModule('table') as { insertTable: (r: number, c: number) => void } | undefined;
    if (!tableModule) return;
    const rows = parseInt(window.prompt('Liczba wierszy tabeli:', '2') || '0', 10);
    const cols = parseInt(window.prompt('Liczba kolumn tabeli:', '2') || '0', 10);
    if (rows > 0 && cols > 0) tableModule.insertTable(rows, cols);
  }, []);

  const modules = useMemo(() => ({
    table: true,
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link'],
        ['table'],
        ['clean'],
      ],
      handlers: { table: insertTable },
    },
  }), [insertTable]);

  const handleEditClick = (note: Note) => {
    setEditingNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setFiles(note.files ?? []);
    setIsImportant(note.isImportant);
    setIsUrgent(note.isUrgent || false);
    const foundColor = NOTE_COLORS.find(c => c.bg === note.color) || NOTE_COLORS[0];
    setSelectedColor(foundColor);
    setShowForm(true);
    setDeleteConfirmId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingNoteId(null);
    setTitle('');
    setContent('');
    setFiles([]);
    setIsImportant(false);
    setIsUrgent(false);
    setSelectedColor(NOTE_COLORS[0]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (e.target) e.target.value = ''; // pozwól wgrać ten sam plik ponownie
    if (!selected) return;
    setUploadingFile(true);
    try {
      const url = await uploadFile(selected);
      const newFile: NoteFile = {
        id: crypto.randomUUID(),
        name: selected.name,
        url,
        size: `${(selected.size / 1024 / 1024).toFixed(2)} MB`,
        uploadedAt: new Date().toISOString().split('T')[0],
      };
      setFiles(prev => [...prev, newFile]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Nie udało się wgrać pliku.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleSave = async () => {
    if (!title.trim()) { alert("Podaj temat notatki!"); return; }

    setSaving(true);
    try {
      const payload = { title, content, color: selectedColor.bg, isImportant, isUrgent, files };
      if (editingNoteId) {
        const updated = await updateNote(editingNoteId, payload);
        setNotes(prev => prev.map(note => note.id === editingNoteId ? updated : note));
      } else {
        const created = await createNote(payload);
        setNotes(prev => [created, ...prev]);
      }
      handleCloseForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Nie udało się zapisać notatki');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await deleteNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Nie udało się usunąć notatki');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;
    if (a.isImportant && !b.isImportant) return -1;
    if (!a.isImportant && b.isImportant) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="animate-in fade-in duration-300">

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Tablica Notatek</h2>
          <p className="text-slate-500 text-sm">Twoja baza wiedzy, procedury i luźne zapiski</p>
        </div>
        <button onClick={showForm ? handleCloseForm : () => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-all">
          {showForm ? '✕ Zamknij edytor' : '＋ Dodaj notatkę'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 animate-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-slate-800 mb-4">{editingNoteId ? '📝 Edytujesz notatkę' : '✨ Nowa notatka'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Temat notatki</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-slate-300 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all" placeholder="np. Nowa procedura..." />
            </div>
            <div className="flex flex-col justify-end">
              <label className="block text-sm font-bold text-slate-700 mb-2">Wygląd i priorytet</label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  {NOTE_COLORS.map(color => (
                    <button key={color.id} onClick={() => setSelectedColor(color)} className={`w-7 h-7 rounded-full border-2 transition-all ${color.bg} ${selectedColor.id === color.id ? 'border-slate-800 scale-110 shadow-md' : 'border-transparent'}`} />
                  ))}
                </div>
                <label className="flex items-center gap-2 cursor-pointer bg-amber-50 p-2 rounded-xl border border-amber-200 hover:bg-amber-100">
                  <input type="checkbox" checked={isImportant} onChange={(e) => setIsImportant(e.target.checked)} className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-amber-300 cursor-pointer" />
                  <span className="text-sm font-bold text-amber-700">⭐ Ważne</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-red-50 p-2 rounded-xl border border-red-200 hover:bg-red-100">
                  <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="w-4 h-4 rounded text-red-600 focus:ring-red-600 border-red-300 cursor-pointer" />
                  <span className="text-sm font-bold text-red-700">🧨 Pilne</span>
                </label>
              </div>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-1">Treść (Edytor)</label>
            <div className="bg-white rounded-xl overflow-hidden border border-slate-300">
              <ReactQuill ref={quillRef} theme="snow" value={content} onChange={setContent} modules={modules} className="h-64 mb-10" />
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-1">Załącz plik (PDF, JPG, itp.)</label>
            <input type="file" onChange={handleFileUpload} disabled={uploadingFile} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-60" />
            {uploadingFile && <p className="text-xs text-slate-500 mt-2">⏳ Wgrywanie pliku...</p>}
            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map(f => (
                  <li key={f.id} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 hover:underline truncate">
                      📎 {f.name}{f.size ? ` (${f.size})` : ''}
                    </a>
                    <button type="button" onClick={() => handleRemoveFile(f.id)} className="text-slate-400 hover:text-red-600 text-sm font-bold shrink-0" title="Usuń załącznik">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-sm text-base">
              {saving ? '⏳ Zapisywanie...' : (editingNoteId ? '💾 Zapisz zmiany' : '💾 Utwórz notatkę')}
            </button>
            <button onClick={handleCloseForm} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 px-6 rounded-xl transition-all text-base">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">Ładowanie notatek...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-600 bg-red-50 rounded-2xl border border-red-200 border-dashed">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedNotes.length > 0 ? (
            sortedNotes.map(note => (
              <div key={note.id} className={`relative p-5 rounded-3xl border ${note.isUrgent ? 'border-red-400 shadow-red-100 shadow-lg' : 'border-black/5 shadow-sm'} transition-all hover:shadow-md flex flex-col ${note.color}`}>
                {(note.isUrgent || note.isImportant) && (
                  <div className="absolute -top-3 -right-3 bg-white text-xl p-1.5 rounded-full shadow-md border border-slate-100">
                    {note.isUrgent ? '🧨' : '⭐'}
                  </div>
                )}

                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-extrabold text-slate-900 leading-tight pr-4">{note.title}</h3>
                </div>
                <p className="text-xs font-bold text-slate-500 mb-4 opacity-70 border-b border-black/10 pb-2">Dodano: {note.date}</p>

                <div className="text-sm text-slate-700 line-clamp-4 prose prose-sm max-w-none flex-grow mb-4" dangerouslySetInnerHTML={{ __html: note.content }} />

                {note.files && note.files.length > 0 && (
                  <div className="mb-4 flex flex-col gap-1">
                    {note.files.map(f => (
                      <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-700 hover:underline truncate bg-white/60 rounded-lg px-2 py-1 border border-black/5" title={f.name}>
                        📎 {f.name}
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-4 border-t border-black/10 flex gap-2">
                  {deleteConfirmId === note.id ? (
                    <>
                      <button onClick={() => handleDeleteNote(note.id)} className="flex-1 text-xs font-bold bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm text-center">
                        Tak, usuń
                      </button>
                      <button onClick={() => setDeleteConfirmId(null)} className="flex-1 text-xs font-bold bg-white/80 hover:bg-white px-3 py-1.5 rounded-lg transition-colors text-center text-slate-700">
                        Anuluj
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleEditClick(note)} className="flex-1 text-xs font-bold bg-white/50 hover:bg-white px-3 py-1.5 rounded-lg transition-colors text-center text-slate-700 border border-black/5">
                        Otwórz 🔍
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(note.id)}
                        className="px-3 py-1.5 bg-white/50 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-lg transition-colors border border-black/5"
                        title="Usuń notatkę"
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-16 text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">Brak notatek.</div>
          )}
        </div>
      )}

    </div>
  );
};

export default NotesBoard;
