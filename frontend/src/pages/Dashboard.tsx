import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { useClients } from '../hooks/useClients';
import ClientList from '../components/ClientList';
import ClientForm from '../components/ClientForm';
import { Client, ClientFormData } from '../services/api';

interface Props {
  user: User;
  onSignOut: () => void;
}

export default function Dashboard({ user, onSignOut }: Props) {
  const { clients, loading, error, createClient, updateClient, deleteClient } = useClients();
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  const handleAdd = () => {
    setEditClient(null);
    setShowForm(true);
  };

  const handleEdit = (client: Client) => {
    setEditClient(client);
    setShowForm(true);
  };

  const handleSubmit = async (data: ClientFormData) => {
    if (editClient) {
      await updateClient(editClient.id, data);
    } else {
      await createClient(data);
    }
    setShowForm(false);
    setEditClient(null);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditClient(null);
  };

  return (
    <div style={styles.wrapper}>
      {/* Navbar */}
      <nav style={styles.nav}>
        <div style={styles.navLeft}>
          <span style={styles.navLogo}>📋</span>
          <span style={styles.navTitle}>CRM Pluszek</span>
        </div>
        <div style={styles.navRight}>
          <span style={styles.userEmail}>{user.email}</span>
          <button style={styles.signOutBtn} onClick={onSignOut}>
            Wyloguj
          </button>
        </div>
      </nav>

      {/* Główna zawartość */}
      <main style={styles.main}>
        {/* Nagłówek sekcji */}
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Klienci</h2>
            <p style={styles.sectionSub}>
              {loading ? '...' : `${clients.length} klientów w bazie`}
            </p>
          </div>
          <button style={styles.addBtn} onClick={handleAdd}>
            + Dodaj klienta
          </button>
        </div>

        {/* Stany */}
        {loading && <div style={styles.loader}>⏳ Ładowanie klientów...</div>}
        {error && <div style={styles.errorBox}>❌ {error}</div>}
        {!loading && !error && (
          <ClientList
            clients={clients}
            onEdit={handleEdit}
            onDelete={deleteClient}
          />
        )}
      </main>

      {/* Modal formularza */}
      {showForm && (
        <ClientForm
          initial={editClient}
          onSubmit={handleSubmit}
          onCancel={handleClose}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    background: '#f1f5f9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  nav: {
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '0 24px',
    height: 56,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 50,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  navLogo: { fontSize: 22 },
  navTitle: { fontSize: 17, fontWeight: 700, color: '#1e293b' },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  userEmail: { fontSize: 13, color: '#64748b' },
  signOutBtn: {
    padding: '6px 14px', borderRadius: 7, border: '1px solid #e2e8f0',
    background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  main: {
    maxWidth: 860,
    margin: '0 auto',
    padding: '28px 16px',
  },
  sectionHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 20, flexWrap: 'wrap', gap: 12,
  },
  sectionTitle: { fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 },
  sectionSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  addBtn: {
    padding: '9px 18px', borderRadius: 8, border: 'none',
    background: '#2563eb', color: '#fff', cursor: 'pointer',
    fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
  },
  loader: { textAlign: 'center', padding: 40, color: '#64748b', fontSize: 14 },
  errorBox: {
    background: '#fee2e2', color: '#dc2626',
    padding: '12px 16px', borderRadius: 8, fontSize: 14,
  },
};
