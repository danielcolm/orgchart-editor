import { useState } from "react";
import { useStore } from "@/store";
import { verifyPin } from "@/services/dbService";

export function PinScreen() {
  const setAuthenticated = useStore((s) => s.setAuthenticated);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const ok = await verifyPin(pin);
    setLoading(false);
    if (ok) {
      setAuthenticated(true);
    } else {
      setError(true);
      setPin("");
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo} />
        <h1 style={S.title}>OrgChart Editor</h1>
        <p style={S.sub}>Enter PIN to continue</p>
        <form onSubmit={handleSubmit} style={S.form}>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            autoFocus
            style={{
              ...S.input,
              borderColor: error ? "var(--color-danger)" : undefined,
            }}
          />
          <button type="submit" disabled={loading || !pin} style={S.btn}>
            {loading ? "..." : "Enter"}
          </button>
        </form>
        {error && <p style={S.error}>Invalid PIN</p>}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "var(--color-bg)",
  },
  card: { textAlign: "center", width: 320 },
  logo: {
    width: 48, height: 48, borderRadius: 12, margin: "0 auto 16px",
    background: "linear-gradient(135deg, var(--color-accent), #a78bfa)",
  },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 24 },
  form: { display: "flex", gap: 8 },
  input: {
    flex: 1, padding: "10px 14px", borderRadius: "var(--radius-md)",
    background: "var(--color-bg-surface)", border: "1px solid var(--color-border)",
    color: "var(--color-text)", fontSize: 16, textAlign: "center", letterSpacing: "0.2em",
  },
  btn: {
    padding: "10px 20px", borderRadius: "var(--radius-md)",
    background: "var(--color-accent)", color: "#fff", fontWeight: 600, fontSize: 14,
  },
  error: { color: "var(--color-danger)", fontSize: 13, marginTop: 12 },
};
