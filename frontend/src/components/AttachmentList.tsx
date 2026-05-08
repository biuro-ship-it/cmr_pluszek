import { useEffect, useState } from "react";

interface Attachment {
  id: string;
  name: string;
  mimetype: string;
  size: number;
  createdAt: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function AttachmentList({ clientId, token }: { clientId: string; token: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchAttachments();
  }, [clientId, token]);

  async function fetchAttachments() {
    const res = await fetch(`${API_URL}/api/clients/${clientId}/attachments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setAttachments(await res.json());
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_URL}/api/clients/${clientId}/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    setUploading(false);
    if (res.ok) {
      fetchAttachments();
    } else {
      alert("Błąd podczas przesyłania pliku.");
    }
  }

  async function handleDelete(fileId: string) {
    if (!window.confirm("Usunąć załącznik?")) return;
    const res = await fetch(`${API_URL}/api/clients/${clientId}/attachments/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      fetchAttachments();
    }
  }

  return (
    <div className="attachment-box">
      <h4>Załączniki</h4>
      <input type="file" onChange={handleFileChange} disabled={uploading} style={{ marginBottom: "10px" }} />
      {uploading && <p>Przesyłanie...</p>}
      <ul className="attachment-list">
        {attachments.map((att) => (
          <li key={att.id} style={{ marginBottom: "5px", fontSize: "0.9rem" }}>
            <span>{att.name} ({(att.size / 1024).toFixed(1)} KB)</span>
            <button 
              onClick={() => handleDelete(att.id)} 
              style={{ marginLeft: "10px", padding: "2px 5px", fontSize: "0.75rem" }}
            >
              Usuń
            </button>
          </li>
        ))}
        {attachments.length === 0 && !uploading && <p style={{ fontSize: "0.85rem", color: "#666" }}>Brak załączników.</p>}
      </ul>
    </div>
  );
}
