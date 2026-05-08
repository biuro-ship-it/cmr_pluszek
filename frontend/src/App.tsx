import { FormEvent, useEffect, useState } from "react";
import { User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import CalendarView from "./components/CalendarView";
import AttachmentList from "./components/AttachmentList";
import ReportDashboard from "./components/ReportDashboard";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

interface Client {
  id: string;
  companyName: string;
  contactPersonName: string;
  email: string;
  phone: string;
  address: string;
  lastContactAt?: string;
}

interface Interaction {
  id: string;
  clientId: string;
  contactDate: string;
  channel: "telefon" | "email" | "spotkanie" | "inne";
  notes: string;
  pricingNotes: string;
  products: string;
}

interface FollowUp {
  id: string;
  clientId: string;
  dueDate: string;
  note: string;
  status: "zaplanowane" | "zrealizowane" | "przesuniete";
}

function statusClassName(status: FollowUp["status"]) {
  if (status === "zrealizowane") return "status status-done";
  if (status === "przesuniete") return "status status-moved";
  return "status status-planned";
}

function statusLabel(status: FollowUp["status"]) {
  if (status === "zrealizowane") return "DONE zrealizowane";
  if (status === "przesuniete") return "MOVED przesuniete";
  return "PLAN zaplanowane";
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>("");
  const [clients, setClients] = useState<Client[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<"wszyscy" | "na_dzis" | "zalegle">("wszyscy");
  const [editClientId, setEditClientId] = useState<string>("");
  const [interactionClientId, setInteractionClientId] = useState<string>("");
  const [interactionDate, setInteractionDate] = useState(new Date().toISOString().slice(0, 10));
  const [interactionChannel, setInteractionChannel] =
    useState<Interaction["channel"]>("telefon");
  const [interactionNotes, setInteractionNotes] = useState("");
  const [pricingNotes, setPricingNotes] = useState("");
  const [products, setProducts] = useState("");
  const [interactionsByClient, setInteractionsByClient] = useState<Record<string, Interaction[]>>(
    {}
  );
  const [followUpsByClient, setFollowUpsByClient] = useState<Record<string, FollowUp[]>>({});
  const [followUpClientId, setFollowUpClientId] = useState<string>("");
  const [followUpDate, setFollowUpDate] = useState(new Date().toISOString().slice(0, 10));
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [summaryToday, setSummaryToday] = useState<
    Array<{ clientId: string; companyName: string; dueDate: string; note: string }>
  >([]);
  const [summaryOverdue, setSummaryOverdue] = useState<
    Array<{ clientId: string; companyName: string; dueDate: string; note: string }>
  >([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [attachPdf, setAttachPdf] = useState(false);
  const [attachmentClientId, setAttachmentClientId] = useState<string>("");
  const [showReports, setShowReports] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const idToken = await nextUser.getIdToken();
        setToken(idToken);
      } else {
        setToken("");
        setClients([]);
      }
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    void fetchClients(token);
    void fetchFollowUpsSummary(token);
  }, [token]);

  async function fetchClients(idToken: string) {
    const response = await fetch(`${API_URL}/api/clients`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });

    if (!response.ok) return;
    const data = (await response.json()) as Client[];
    setClients(data);
  }

  async function handleLogin() {
    await signInWithPopup(auth, googleProvider);
  }

  async function handleLogout() {
    await signOut(auth);
  }

  async function handleCreateClient(event: FormEvent) {
    event.preventDefault();
    if (!token || !companyName.trim()) return;

    setLoading(true);
    const response = await fetch(`${API_URL}/api/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        companyName,
        contactPersonName,
        email,
        phone,
        address
      })
    });

    setLoading(false);
    if (!response.ok) return;

    setCompanyName("");
    setContactPersonName("");
    setEmail("");
    setPhone("");
    setAddress("");
    await fetchClients(token);
  }

  async function handleDeleteClient(id: string) {
    if (!token) return;

    const ok = window.confirm("Usunąć klienta?");
    if (!ok) return;

    const response = await fetch(`${API_URL}/api/clients/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) return;
    await fetchClients(token);
    await fetchFollowUpsSummary(token);
  }

  async function fetchInteractions(clientId: string) {
    if (!token) return;

    const response = await fetch(`${API_URL}/api/clients/${clientId}/interactions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return;
    const data = (await response.json()) as Interaction[];
    setInteractionsByClient((prev) => ({ ...prev, [clientId]: data }));
  }

  async function fetchFollowUps(clientId: string) {
    if (!token) return;
    const response = await fetch(`${API_URL}/api/clients/${clientId}/followups`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return;
    const data = (await response.json()) as FollowUp[];
    setFollowUpsByClient((prev) => ({ ...prev, [clientId]: data }));
  }

  async function fetchFollowUpsSummary(idToken: string) {
    const response = await fetch(`${API_URL}/api/clients/followups/summary`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!response.ok) return;
    const data = (await response.json()) as {
      today: Array<{ clientId: string; companyName: string; dueDate: string; note: string }>;
      overdue: Array<{ clientId: string; companyName: string; dueDate: string; note: string }>;
    };
    setSummaryToday(data.today);
    setSummaryOverdue(data.overdue);
  }

  function startEdit(client: Client) {
    setEditClientId(client.id);
    setCompanyName(client.companyName);
    setContactPersonName(client.contactPersonName);
    setEmail(client.email);
    setPhone(client.phone);
    setAddress(client.address);
  }

  function clearForm() {
    setEditClientId("");
    setCompanyName("");
    setContactPersonName("");
    setEmail("");
    setPhone("");
    setAddress("");
  }

  function startInteraction(clientId: string) {
    setInteractionClientId(clientId);
    setInteractionDate(new Date().toISOString().slice(0, 10));
    setInteractionChannel("telefon");
    setInteractionNotes("");
    setPricingNotes("");
    setProducts("");
    void fetchInteractions(clientId);
  }

  function startFollowUp(clientId: string) {
    setFollowUpClientId(clientId);
    setFollowUpDate(new Date().toISOString().slice(0, 10));
    setFollowUpNote("");
    void fetchFollowUps(clientId);
  }

  async function handleCreateInteraction(event: FormEvent) {
    event.preventDefault();
    if (!token || !interactionClientId) return;

    setInteractionLoading(true);
    const response = await fetch(`${API_URL}/api/clients/${interactionClientId}/interactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        contactDate: interactionDate,
        channel: interactionChannel,
        notes: interactionNotes,
        pricingNotes,
        products
      })
    });
    setInteractionLoading(false);

    if (!response.ok) return;
    await fetchClients(token);
    await fetchInteractions(interactionClientId);
    setInteractionNotes("");
    setPricingNotes("");
    setProducts("");
  }

  async function handleCreateFollowUp(event: FormEvent) {
    event.preventDefault();
    if (!token || !followUpClientId) return;

    setFollowUpLoading(true);
    const response = await fetch(`${API_URL}/api/clients/${followUpClientId}/followups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        dueDate: followUpDate,
        note: followUpNote
      })
    });
    setFollowUpLoading(false);
    if (!response.ok) return;

    await fetchFollowUps(followUpClientId);
    await fetchFollowUpsSummary(token);
    setFollowUpNote("");
  }

  async function handleFollowUpStatus(
    clientId: string,
    followUpId: string,
    status: FollowUp["status"]
  ) {
    if (!token) return;
    const response = await fetch(`${API_URL}/api/clients/${clientId}/followups/${followUpId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    if (!response.ok) return;
    await fetchFollowUps(clientId);
    await fetchFollowUpsSummary(token);
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!token || !editClientId || !companyName.trim()) return;

    setLoading(true);
    const response = await fetch(`${API_URL}/api/clients/${editClientId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        companyName,
        contactPersonName,
        email,
        phone,
        address
      })
    });
    setLoading(false);

    if (!response.ok) return;
    clearForm();
    await fetchClients(token);
  }

  async function handleSendEmail(clientId: string, type: "katalog" | "podsumowanie") {
    if (!token) return;
    setEmailLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/clients/${clientId}/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ type, attachPdf })
      });
      if (response.ok) {
        alert("E-mail wysłany pomyślnie!");
      } else {
        alert("Błąd podczas wysyłania e-maila.");
      }
    } catch (err) {
      alert("Wystąpił błąd.");
    } finally {
      setEmailLoading(false);
    }
  }

  function daysSince(dateString?: string) {
    if (!dateString) return "brak";
    const then = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - then.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    return `${days} dni`;
  }

  const todayClientIds = new Set(summaryToday.map((item) => item.clientId));
  const overdueClientIds = new Set(summaryOverdue.map((item) => item.clientId));

  const filteredClients = clients.filter((client) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      (
      client.companyName.toLowerCase().includes(term) ||
      client.contactPersonName.toLowerCase().includes(term) ||
      client.email.toLowerCase().includes(term) ||
      client.phone.toLowerCase().includes(term)
      );

    if (!matchesSearch) return false;
    if (clientFilter === "na_dzis") return todayClientIds.has(client.id);
    if (clientFilter === "zalegle") return overdueClientIds.has(client.id);
    return true;
  });

  return (
    <main className="container">
      <h1>CRM Sprint 2</h1>

      {!user && (
        <button onClick={handleLogin} className="primary-btn">
          Zaloguj kontem Google
        </button>
      )}

      {user && (
        <>
          <div className="row">
            <p>Zalogowano: {user.email}</p>
            <div className="action-row">
              <button onClick={() => setShowCalendar(!showCalendar)}>
                {showCalendar ? "Ukryj Kalendarz" : "Pokaż Kalendarz"}
              </button>
              <button onClick={() => setShowReports(!showReports)}>
                {showReports ? "Ukryj Raporty" : "Pokaż Raporty"}
              </button>
              <button onClick={handleLogout}>Wyloguj</button>
            </div>
          </div>

          {showCalendar && <CalendarView token={token} />}
          {showReports && <ReportDashboard token={token} />}

          <section>
            <h2>Na dziś i zaległe</h2>
            <div className="two-cols">
              <div>
                <h4>Na dziś</h4>
                <ul>
                  {summaryToday.map((item, idx) => (
                    <li key={`${item.clientId}-${idx}`}>
                      {item.companyName} - {item.dueDate} - {item.note || "brak notatki"}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Zaległe</h4>
                <ul>
                  {summaryOverdue.map((item, idx) => (
                    <li key={`${item.clientId}-${idx}`}>
                      {item.companyName} - {item.dueDate} - {item.note || "brak notatki"}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2>{editClientId ? "Edytuj klienta" : "Dodaj klienta"}</h2>
            <form onSubmit={editClientId ? handleSaveEdit : handleCreateClient} className="form">
              <input
                placeholder="Nazwa firmy"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
              <input
                placeholder="Osoba kontaktowa"
                value={contactPersonName}
                onChange={(e) => setContactPersonName(e.target.value)}
              />
              <input
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                placeholder="Telefon"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <input
                placeholder="Adres"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <div className="action-row">
                <button type="submit" className="primary-btn" disabled={loading}>
                  {loading ? "Zapisywanie..." : editClientId ? "Zapisz zmiany" : "Dodaj klienta"}
                </button>
                {editClientId && (
                  <button type="button" onClick={clearForm}>
                    Anuluj edycję
                  </button>
                )}
              </div>
            </form>
          </section>

          <section>
            <h2>Lista klientów</h2>
            <div className="action-row">
              <button
                type="button"
                className={clientFilter === "wszyscy" ? "filter-btn active" : "filter-btn"}
                onClick={() => setClientFilter("wszyscy")}
              >
                Wszyscy
              </button>
              <button
                type="button"
                className={clientFilter === "na_dzis" ? "filter-btn active" : "filter-btn"}
                onClick={() => setClientFilter("na_dzis")}
              >
                Na dziś
              </button>
              <button
                type="button"
                className={clientFilter === "zalegle" ? "filter-btn active" : "filter-btn"}
                onClick={() => setClientFilter("zalegle")}
              >
                Zaległe
              </button>
            </div>
            <input
              placeholder="Szukaj: firma, kontakt, email, telefon"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul>
              {filteredClients.map((client) => (
                <li key={client.id}>
                  <div className="client-item">
                    <div>
                      <strong>{client.companyName}</strong> ({daysSince(client.lastContactAt)} od ostatniego kontaktu)
                      <div>
                        {client.contactPersonName} - {client.email} - {client.phone}
                      </div>
                    </div>
                    <div className="action-row">
                      <button type="button" onClick={() => startEdit(client)}>
                        Edytuj
                      </button>
                      <button type="button" onClick={() => startInteraction(client.id)}>
                        Kontakt
                      </button>
                      <button type="button" onClick={() => startFollowUp(client.id)}>
                        Follow-up
                      </button>
                      <button type="button" onClick={() => setAttachmentClientId(attachmentClientId === client.id ? "" : client.id)}>
                        Załączniki
                      </button>
                      <button type="button" onClick={() => void handleDeleteClient(client.id)}>
                        Usuń
                      </button>
                    </div>
                    <div className="action-row" style={{ marginTop: "8px", borderTop: "1px solid #eee", paddingTop: "8px" }}>
                      <label style={{ marginRight: "10px", fontSize: "0.85rem" }}>
                        <input
                          type="checkbox"
                          checked={attachPdf}
                          onChange={(e) => setAttachPdf(e.target.checked)}
                        /> Dołącz katalog PDF
                      </label>
                      <button 
                        className="secondary-btn" 
                        onClick={() => handleSendEmail(client.id, "katalog")}
                        disabled={emailLoading}
                      >
                        Wyślij katalog
                      </button>
                      <button 
                        className="secondary-btn" 
                        onClick={() => handleSendEmail(client.id, "podsumowanie")}
                        disabled={emailLoading}
                      >
                        Wyślij podsumowanie
                      </button>
                    </div>
                  </div>
                  {interactionClientId === client.id && (
                    <div className="interaction-box">
                      <h4>Dodaj kontakt</h4>
                      <form onSubmit={handleCreateInteraction} className="form">
                        <input
                          type="date"
                          value={interactionDate}
                          onChange={(e) => setInteractionDate(e.target.value)}
                          required
                        />
                        <select
                          value={interactionChannel}
                          onChange={(e) =>
                            setInteractionChannel(e.target.value as Interaction["channel"])
                          }
                        >
                          <option value="telefon">telefon</option>
                          <option value="email">email</option>
                          <option value="spotkanie">spotkanie</option>
                          <option value="inne">inne</option>
                        </select>
                        <input
                          placeholder="Notatka"
                          value={interactionNotes}
                          onChange={(e) => setInteractionNotes(e.target.value)}
                        />
                        <input
                          placeholder="Ustalenia cenowe"
                          value={pricingNotes}
                          onChange={(e) => setPricingNotes(e.target.value)}
                        />
                        <input
                          placeholder="Produkty kupowane"
                          value={products}
                          onChange={(e) => setProducts(e.target.value)}
                        />
                        <div className="action-row">
                          <button type="submit" className="primary-btn" disabled={interactionLoading}>
                            {interactionLoading ? "Zapisywanie..." : "Zapisz kontakt"}
                          </button>
                          <button type="button" onClick={() => setInteractionClientId("")}>
                            Zamknij
                          </button>
                        </div>
                      </form>

                      <h4>Historia kontaktów</h4>
                      <ul>
                        {(interactionsByClient[client.id] ?? []).map((interaction) => (
                          <li key={interaction.id}>
                            {interaction.contactDate} - {interaction.channel} - {interaction.notes}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {followUpClientId === client.id && (
                    <div className="interaction-box">
                      <h4>Dodaj follow-up</h4>
                      <form onSubmit={handleCreateFollowUp} className="form">
                        <input
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          required
                        />
                        <input
                          placeholder="Notatka follow-up"
                          value={followUpNote}
                          onChange={(e) => setFollowUpNote(e.target.value)}
                        />
                        <div className="action-row">
                          <button type="submit" className="primary-btn" disabled={followUpLoading}>
                            {followUpLoading ? "Zapisywanie..." : "Dodaj follow-up"}
                          </button>
                          <button type="button" onClick={() => setFollowUpClientId("")}>
                            Zamknij
                          </button>
                        </div>
                      </form>

                      <h4>Follow-upy klienta</h4>
                      <ul>
                        {(followUpsByClient[client.id] ?? []).map((f) => (
                          <li key={f.id}>
                            {f.dueDate} -{" "}
                            <span className={statusClassName(f.status)}>{statusLabel(f.status)}</span> -{" "}
                            {f.note || "brak notatki"}
                            <div className="action-row">
                              <button
                                type="button"
                                onClick={() => void handleFollowUpStatus(client.id, f.id, "zrealizowane")}
                              >
                                Oznacz jako zrealizowane
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleFollowUpStatus(client.id, f.id, "zaplanowane")}
                              >
                                Ustaw zaplanowane
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {attachmentClientId === client.id && (
                    <div className="interaction-box">
                      <AttachmentList clientId={client.id} token={token} />
                      <button type="button" onClick={() => setAttachmentClientId("")} style={{ marginTop: "10px" }}>
                        Zamknij
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
