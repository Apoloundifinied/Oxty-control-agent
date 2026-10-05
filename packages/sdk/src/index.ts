import {
  EventEnvelope,
  ProposeAction,
  ProposeResponse,
  type Decision,
} from "@ia-control/shared";

export type IAControlOptions = {
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
};

/**
 * SDK mínimo para agentes (spec seção 7.5).
 *
 * const ia = new IAControl({ apiKey, baseUrl });
 * const d = await ia.propose({ ... });
 * if (d.decision === "ASK") await ia.waitForApproval(d.approvalId);
 * await executor(...);
 * await ia.result(d.actionId, { ok: true });
 */
export class IAControl {
  constructor(private opts: IAControlOptions) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-api-key": this.opts.apiKey,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 30_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new IAControlError(
        (data.code as string) ?? "HTTP_" + res.status,
        (data.message as string) ?? res.statusText,
        res.status,
        data,
      );
    }
    return data as T;
  }

  /** Propõe uma ação antes de agir. Risco é recalculado no servidor (spec 7.3). */
  async propose(input: Omit<Parameters<typeof ProposeAction.parse>[0], "idempotencyKey"> & { idempotencyKey?: string }) {
    const body = ProposeAction.parse({
      idempotencyKey: input.idempotencyKey ?? `idem_${crypto.randomUUID()}`,
      ...input,
    });
    return this.request<ProposeResponse>("POST", "/v1/actions/propose", body);
  }

  /** Relata o resultado da execução (COMMIT ou RELEASE do orçamento). */
  async result(actionId: string, outcome: { ok: boolean; amountCents?: number; detail?: unknown }) {
    return this.request<{ ok: true }>(`POST`, `/v1/actions/${actionId}/result`, outcome);
  }

  /** Espera a decisão humana de uma aprovação (polling; na Fase 1 também via SSE). */
  async waitForApproval(approvalId: string, { timeoutMs = 600_000, intervalMs = 3_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const r = await this.request<{ status: string; decision?: Decision }>(
        "GET", `/v1/approvals/${approvalId}`,
      );
      if (r.status === "DECIDED") return r.decision!;
      if (r.status === "EXPIRED") return "DENY" as const;
      await Bun.sleep(intervalMs);
    }
    throw new IAControlError("APPROVAL_TIMEOUT", `Aprovação ${approvalId} não decidida a tempo`, 408);
  }

  /** Stream de eventos do workspace (SSE) — alimenta UIs de agentes (Fase 1+). */
  events(lastEventId?: string): ReadableStream<EventEnvelope> {
    const stream = new ReadableStream<EventEnvelope>({
      start: async (controller) => {
        const res = await fetch(`${this.opts.baseUrl}/v1/stream`, {
          headers: {
            accept: "text/event-stream",
            "x-api-key": this.opts.apiKey,
            ...(lastEventId ? { "last-event-id": lastEventId } : {}),
          },
        });
        if (!res.ok || !res.body) {
          controller.error(new IAControlError("STREAM_FAILED", `SSE falhou: ${res.status}`, res.status));
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const dataLine = part.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            try {
              controller.enqueue(EventEnvelope.parse(JSON.parse(dataLine.slice(5).trim())));
            } catch { /* ignora evento malformado, keep-alive, etc. */ }
          }
        }
        controller.close();
      },
    });
    return stream;
  }

  /** Telemetria de contexto (Fase 3); assinatura já estabilizada. */
  context = {
    pack: (input: { agentId: string; task: string; maxTokens: number }) =>
      this.request<{ packId: string; text: string }>("POST", "/v1/context/pack", input),
  };

  /** Memória (Fase 3); assinatura já estabilizada. */
  memory = {
    write: (input: { subject: string; content: string; kind: string; confidence?: number }) =>
      this.request<{ id: string; status: string }>("POST", "/v1/memory", input),
    search: (input: { query: string; limit?: number }) =>
      this.request<{ results: unknown[] }>("POST", "/v1/memory/search", input),
  };

  /** Heartbeat a cada intervalo (spec 7.4). */
  heartbeat(telemetry: {
    tokensUsed?: number; contextWindow?: number; queueDepth?: number; version?: string;
  }) {
    return this.request<{ ok: true }>("POST", "/v1/agents/heartbeat", telemetry);
  }
}

export class IAControlError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "IAControlError";
  }
}
