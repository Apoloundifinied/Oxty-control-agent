import { createResource, Show } from "solid-js";

type Health = { ok: boolean; service: string };

async function fetchHealth(): Promise<Health> {
  const res = await fetch("/v1/health-live");
  if (!res.ok) throw new Error(`API respondeu ${res.status}`);
  return res.json();
}

export function App() {
  const [health] = createResource(fetchHealth);

  return (
    <main style={{
      "font-family": "system-ui, sans-serif",
      "min-height": "100vh",
      display: "grid",
      "place-items": "center",
      background: "#0a0a0f",
      color: "#e5e5ef",
    }}>
      <div style={{ "text-align": "center" }}>
        <h1 style={{ "font-size": "2.5rem", margin: 0 }}>🛡️ IA-Control</h1>
        <p style={{ color: "#8b8b9e" }}>Plano de controle do ecossistema de agentes de IA</p>
        <Show
          when={health()}
          fallback={<p>Conectando à API…</p>}
        >
          {(h) => (
            <p style={{ color: h().ok ? "#34d399" : "#f87171" }}>
              {h().ok ? "● API online" : "● API com problema"}
            </p>
          )}
        </Show>
        <Show when={health.error}>
          <p style={{ color: "#f87171" }}>API offline — rode <code>bun run dev:api</code></p>
        </Show>
      </div>
    </main>
  );
}
