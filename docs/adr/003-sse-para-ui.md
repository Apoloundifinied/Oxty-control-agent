# ADR 003 — SSE para UI, WebSocket opcional para agentes

- **Status:** aceito · **Data:** Fase 0
- **Decisão:** tempo real da UI via Server-Sent Events (`GET /v1/stream`); WebSocket só para agentes, se necessário.
- **Motivo:** SSE é simples, unidirecional (suficiente para o mapa 3D), atravessa proxies/firewalls e reconecta com `Last-Event-ID`.
- **Consequências:** envio de comandos pela UI usa HTTP normal; transporte de eventos usa `LISTEN/NOTIFY` do Postgres.
