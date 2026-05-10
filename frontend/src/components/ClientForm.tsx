import React, { useState, useEffect, useRef, ChangeEvent } from 'react';

// 1. Pełny interfejs danych - zgodny z Twoim Dashboardem i bazą danych
interface ClientFormData {
  companyName: string;
  type: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  zipCode: string;
  province: string;
  notes: string;
}

// 2. Props dopasowane do Dashboard.tsx
interface ClientFormProps {
  initial?: any | null; // Przyjmuje 'Client' lub null
  onSubmit: (data: any) => Promise<void> | void;
  onCancel: () => void;
}

const ClientForm: React.FC<ClientFormProps> = ({ initial, onSubmit, onCancel }) => {
  // Mapowanie danych początkowych (obsługuje istniejących klientów i nowych)
  const [formData, setFormData] = useState<ClientFormData>({
    companyName: initial?.companyName || '',
    type: initial?.type || 'company',
    contactPerson: initial?.contactPerson || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    address: initial?.address || '',
    zipCode: initial?.zipCode || '',
    province: initial?.province || '',
    notes: initial?.notes || ''
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [formData.notes]);

  const voivodeshipMap: { [key: string]: string } = {
    '0': 'Mazowieckie',
    '1': 'Podlaskie / Warmińsko-Mazurskie',
    '2': 'Lubelskie / Świętokrzyskie',
    '3': 'Małopolskie / Podkarpackie',
    '4': 'Śląskie / Opolskie',
    '5': 'Dolnośląskie',
    '6': 'Wielkopolskie / Lubuskie',
    '7': 'Zachodniopomorskie / Pomorskie',
    '8': 'Kujawsko-Pomorskie / Pomorskie',
    '9': 'Łódzkie'
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newProvince = formData.province;

    if (name === 'zipCode' && value.length >= 1) {
      newProvince = voivodeshipMap[value[0]] || '';
    }

    setFormData(prev => ({ ...prev, [name]: value, province: newProvince }));
  };

  return (
    <div style={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>{initial ? 'Edytuj dane' : 'Dodaj nowego klienta'}</h2>
        <button onClick={onCancel} style={styles.closeBtn}>✕</button>
      </div>
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Typ</label>
          <select name="type" value={formData.type} onChange={handleChange} style={styles.input}>
            <option value="company">Firma</option>
            <option value="individual">Osoba prywatna</option>
          </select>
        </div>
        <div style={{ flex: 3 }}>
          <label style={styles.label}>Nazwa firmy / Klienta</label>
          <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} style={styles.input} />
        </div>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Osoba kontaktowa</label>
        <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} style={styles.input} />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Adres E-mail</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange} style={styles.input} />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Telefon</label>
        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} style={styles.input} />
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Adres (Ulica i nr)</label>
        <input type="text" name="address" value={formData.address} onChange={handleChange} style={styles.input} />
      </div>

      <div style={{ display: 'flex', gap: '15px' }}>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Kod pocztowy</label>
          <input type="text" name="zipCode" value={formData.zipCode} onChange={handleChange} style={styles.input} placeholder="00-000" />
        </div>
        <div style={{ flex: 2 }}>
          <label style={styles.label}>Województwo</label>
          <input type="text" name="province" value={formData.province} readOnly style={{ ...styles.input, backgroundColor: '#f0f0f0' }} />
        </div>
      </div>

      <div style={styles.fieldGroup}>
        <label style={styles.label}>Notatki (pole rośnie automatycznie)</label>
        <textarea 
          ref={textareaRef}
          name="notes" 
          value={formData.notes} 
          onChange={handleChange} 
          style={{ ...styles.input, minHeight: '80px', resize: 'none' }} 
        />
      </div>

      <button onClick={() => onSubmit(formData)} style={styles.saveBtn}>
        {initial ? 'Zapisz zmiany' : 'Dodaj klienta'}
      </button>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: { padding: '20px', backgroundColor: '#fff' },
  fieldGroup: { marginBottom: '15px', display: 'flex', flexDirection: 'column' as const },
  label: { fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' },
  input: {
    border: '2px solid #000',
    padding: '10px',
    fontSize: '16px',
    borderRadius: '4px',
    color: '#000'
  },
  saveBtn: {
    backgroundColor: '#000',
    color: '#fff',
    padding: '14px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    width: '100%',
    fontSize: '16px',
    fontWeight: 'bold',
    marginTop: '10px'
  },
  closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }
};

export default ClientForm;