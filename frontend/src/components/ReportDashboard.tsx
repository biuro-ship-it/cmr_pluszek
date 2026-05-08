import { useEffect, useState } from "react";

interface ReportSummary {
  totalClients: number;
  totalInteractions: number;
  totalFollowUps: number;
  realizedFollowUps: number;
  overdueFollowUps: number;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function ReportDashboard({ token }: { token: string }) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_URL}/api/reports/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p>Ładowanie raportów...</p>;
  if (!summary) return null;

  return (
    <section className="report-dashboard">
      <h2>Podsumowanie Aktywności</h2>
      <div className="report-grid">
        <div className="report-card">
          <h3>Klienci</h3>
          <p className="report-value">{summary.totalClients}</p>
        </div>
        <div className="report-card">
          <h3>Kontakty</h3>
          <p className="report-value">{summary.totalInteractions}</p>
        </div>
        <div className="report-card">
          <h3>Follow-upy</h3>
          <p className="report-value">{summary.totalFollowUps}</p>
        </div>
        <div className="report-card">
          <h3>Zrealizowane</h3>
          <p className="report-value" style={{ color: "green" }}>{summary.realizedFollowUps}</p>
        </div>
        <div className="report-card">
          <h3>Zaległe</h3>
          <p className="report-value" style={{ color: "red" }}>{summary.overdueFollowUps}</p>
        </div>
      </div>
    </section>
  );
}
