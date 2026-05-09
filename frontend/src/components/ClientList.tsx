import React, { useState } from 'react';
import { Client } from '../services/api';

interface Props {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return <span style={chipStyles.never}>brak kontaktu</span>;
  if (days === 0) return <span style={chipStyles.today}>dzisiaj</span>;
  if (days <= 7) return <span style={chipStyles.recent}>{days} dni</span>;
  if (days <= 30) return <span style={chipStyles.medium}>{days} dni</span>;
  return <span style={chipStyles.old}>{days} dni</span>;
}

export default function ClientList({ clients, onEdit, onDelete }: Props) {
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.company_name.toLowerCase().includes(q) ||
      c.contact_person_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Wyszukiwarka */}
      <div style={styles.searchBar}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          style={styles.searchInput}
          placeholder="Szukaj po nazwie, osobie, e-mail, telefonie..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button style={styles.clearBtn} onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Licznik wyników */}
      {search && (
        <p style={styles.resultCount}>
          Znaleziono: <strong>{filtered.length}</strong> z {clients.length}
        </p>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={styles.empty}>
          {search ? 'Brak wyników dla podanej frazy.' : 'Brak klientów. Dodaj pierwszego!'}
        </div>
      ) : (
        <div style={styles.list}>
          {filtered.map((client) => {
            const days = daysSince(client.lastContactAt);
            return (
              <div key={client.id} style={styles.card}>
                {/* Lewa część */}
                <div style={styles.cardBody}>
                  <div style={styles.cardTop}>
                    <span style={styles.companyName}>{client.company_name}</span>
                    <DaysChip days={days} />
                  </div>
                  {client.contact_person_name && (
                    <div style={styles.meta}>👤 {client.contact_person_name}</div>
                  )}
                  <div style={styles.contacts}>
                    {client.email && <a href={`mailto:${client.email}`} style={styles.link}>✉ {client.email}</a>}
                    {client.phone && <a href={`tel:${client.phone}`} style={styles.link}>📞 {client.phone}</a>}
                    {client.address && <span style={styles.meta}>📍 {client.address}</span>}
                  </div>
                </div>

                {/* Akcje */}
                <div style={styles.actions}>
                  <button style={styles.editBtn} onClick={() => onEdit(client)} title="Edytuj">
                    ✏️
                  </button>
                  {confirmId === client.id ? (
                    <div style={styles.confirmRow}>
                      <span style={styles.confirmText}>Usunąć?</span>
                      <button
                        style={styles.confirmYes}
                        onClick={() => { onDelete(client.id); setConfirmId(null); }}
                      >
                        Tak
                      </button>
                      <button style={styles.confirmNo} onClick={() => setConfirmId(null)}>Nie</button>
                    </div>
                  ) : (
                    <button style={styles.deleteBtn} onClick={() => setConfirmId(client.id)} title="Usuń">
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  searchBar: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: '8px 14px', marginBottom: 8,
  },
  searchIcon: { fontSize: 16, flexShrink: 0 },
  searchInput: {
    flex: 1, border: 'none', outline: 'none', fontSize: 14,
    color: '#1e293b', background: 'transparent', fontFamily: 'inherit',
  },
  clearBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#94a3b8', fontSize: 14, padding: '0 2px',
  },
  resultCount: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  empty: {
    textAlign: 'center', padding: '40px 20px',
    color: '#94a3b8', fontSize: 14,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: '14px 16px', display: 'flex', alignItems: 'flex-start',
    gap: 12, transition: 'box-shadow 0.15s',
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, flexWrap: 'wrap' },
  companyName: { fontSize: 15, fontWeight: 700, color: '#1e293b' },
  meta: { fontSize: 12, color: '#64748b', marginTop: 3 },
  contacts: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 5 },
  link: { fontSize: 12, color: '#2563eb', textDecoration: 'none' },
  actions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  editBtn: {
    background: '#f1f5f9', border: 'none', borderRadius: 6,
    padding: '6px 8px', cursor: 'pointer', fontSize: 14,
  },
  deleteBtn: {
    background: '#fff5f5', border: 'none', borderRadius: 6,
    padding: '6px 8px', cursor: 'pointer', fontSize: 14,
  },
  confirmRow: { display: 'flex', alignItems: 'center', gap: 5 },
  confirmText: { fontSize: 12, color: '#dc2626', fontWeight: 600 },
  confirmYes: {
    padding: '4px 8px', border: 'none', borderRadius: 5,
    background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700,
  },
  confirmNo: {
    padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 5,
    background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 12,
  },
};

const chipStyles: Record<string, React.CSSProperties> = {
  never: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f1f5f9', color: '#94a3b8', fontWeight: 600 },
  today: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: '#16a34a', fontWeight: 600 },
  recent: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#d1fae5', color: '#059669', fontWeight: 600 },
  medium: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fef9c3', color: '#a16207', fontWeight: 600 },
  old: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: '#dc2626', fontWeight: 600 },
};
