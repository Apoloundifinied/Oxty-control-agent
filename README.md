<!-- ⚙️ ANTES DE PUBLICAR: substitua SEU_USUARIO pelo seu usuário/organização do GitHub (busca e substitui em todo o arquivo). -->

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=230&color=0:0A84FF,50:5E5CE6,100:BF5AF2&text=Oxty&fontColor=ffffff&fontSize=64&fontAlignY=36&animation=fadeIn&desc=Plano%20de%20controle%20para%20ecossistemas%20de%20agentes%20de%20IA&descSize=18&descAlignY=58" alt="Oxty — plano de controle para ecossistemas de agentes de IA" width="100%" />

<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Inter&weight=600&size=22&duration=3200&pause=1100&color=0A84FF&center=true&vCenter=true&width=720&height=44&lines=Governe+seus+agentes+de+IA;Aprove+o+que+realmente+importa;Veja+tudo+num+mapa+3D+em+tempo+real;Me%C3%A7a+a+sa%C3%BAde+de+cada+agente" alt="Governe seus agentes de IA · Aprove o que importa · Mapa 3D em tempo real · Saúde de cada agente" /></a>

<br />

![Status](https://img.shields.io/badge/status-em%20constru%C3%A7%C3%A3o-0A84FF?style=for-the-badge)
![Fase](https://img.shields.io/badge/fase-1%20%E2%80%94%201%C2%AA%20a%C3%A7%C3%A3o%20real-5E5CE6?style=for-the-badge)
![Spec](https://img.shields.io/badge/spec-v0.1-BF5AF2?style=for-the-badge)
[![Último commit](https://img.shields.io/github/last-commit/SEU_USUARIO/Oxty?style=for-the-badge&color=30D158&label=%C3%BAltimo%20commit)](https://github.com/SEU_USUARIO/Oxty/commits)
[![Stars](https://img.shields.io/github/stars/SEU_USUARIO/Oxty?style=for-the-badge&color=FF9F0A)](https://github.com/SEU_USUARIO/Oxty/stargazers)

![Bun](https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![Solid](https://img.shields.io/badge/Solid-2C4F7C?style=flat-square&logo=solid&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=threedotjs&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logo=zod&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

<br />

<img src="docs/assets/hero.svg" alt="Cinco agentes conectados a um núcleo central; partículas de ação passam por portões que pedem aprovação humana" width="100%" />

<br />

**[✨ O que é](#-o-que-é)** · **[🎬 Como funciona](#-como-funciona)** · **[🧩 Pilares](#-pilares)** · **[🫀 Saúde](#-saúde-cognitiva)** · **[🧱 Arquitetura](#-arquitetura)** · **[🚀 Começar](#-começar-em-5-minutos)** · **[🧭 Roadmap](#-roadmap)**

</div>

<img src="docs/assets/divider.svg" alt="" width="100%" height="6" />

> [!IMPORTANT]
> **Fonte de verdade:** [`docs/Oxty-SPEC.md`](docs/Oxty-SPEC.md). Este README é o resumo; qualquer dúvida de escopo, contrato ou ordem de entrega se resolve na spec.

> [!NOTE]
> 🚧 **Projeto em construção.** A **Fase 0 (fundação) está concluída** e estamos na **Fase 1 (primeira ação real)**. Tudo o que aparece abaixo como "Pilares" e "Saúde" é o **destino planejado**, com a fase de entrega indicada no [Roadmap](#-roadmap).

## ✨ O que é

**Oxty é o plano de controle de um ecossistema de agentes de IA.** Ele **não executa** o trabalho dos agentes — ele **governa**:

- 🛂 decide **o que pode acontecer** (permissões, limites de gasto, autonomia);
- 🔔 **pede aprovação humana** quando importa (dinheiro, exclusão, comunicação em massa);
- 🧠 guarda **contexto** curado e **memória** aprendida, com versão e proveniência;
- 🫀 mede a **saúde** de cada agente e do conjunto, e avisa antes do estrago;
- 🌌 mostra tudo num **mapa 3D em tempo real**, calmo por padrão e detalhado sob demanda.

### Princípios

| | Princípio | Na prática |
|---|---|---|
| 🧘 | **Calma por padrão** | A tela mostra só o necessário; o detalhe aparece quando você pede |
| 🔒 | **Controle antes de autonomia** | Todo agente nasce restrito e ganha autonomia com histórico |
| 🧾 | **Tudo é evento** | Nada acontece sem registro imutável e rastreável |
| 🧯 | **Falhar de forma segura** | Em dúvida, o sistema reduz a autonomia em vez de seguir adiante |
| 🔍 | **Transparência cognitiva** | Sempre dá para ver *o que o agente sabia* quando decidiu |
| 🔌 | **Agnóstico de agente** | Qualquer agente (Claude, GPT, scripts, n8n) conecta por um contrato simples |

<img src="docs/assets/divider.svg" alt="" width="100%" height="6" />

## 🎬 Como funciona

Todo efeito colateral que um agente quer causar vira uma **ação proposta**. O Oxty avalia, e a ação segue um de três caminhos.

```mermaid
sequenceDiagram
    autonumber
    participant AG as 🤖 Agente
    participant IC as 🛡️ Oxty
    participant H as 👤 Você

    AG->>IC: propose(ação, valor, entidades)
    IC->>IC: política: permissão → orçamento → risco → autonomia
    alt Permitida
        IC-->>AG: ALLOW
        AG->>IC: result(ok, valor real)
    else Exige aprovação
        IC-->>AG: ASK (approvalId)
        IC->>H: 🔔 Aprovar ou recusar?
        H-->>IC: ✅ Aprovado
        IC-->>AG: ALLOW
    else Negada
        IC-->>AG: DENY (motivo)
    end
    IC-)H: evento em tempo real → mapa 3D
```

### A decisão, passo a passo

```mermaid
flowchart TD
    A([Ação proposta]) --> B{Agente ativo?}
    B -- não --> X[⛔ Negada]
    B -- sim --> C{Tem permissão?}
    C -- não --> X
    C -- sim --> D{Cabe no orçamento?}
    D -- estoura --> X
    D -- ok --> E{Autonomia × risco}
    E -- baixo e autônomo --> OK[✅ Permitida]
    E -- exige humano --> Q[🔔 Aprovação]
    Q -- aprovada --> OK
    Q -- recusada ou expirada --> X

    classDef ok fill:#30d158,stroke:#30d158,color:#000
    classDef no fill:#ff453a,stroke:#ff453a,color:#fff
    classDef ask fill:#ff9f0a,stroke:#ff9f0a,color:#000
    class OK ok
    class X no
    class Q ask
```

> [!TIP]
> No mapa 3D cada caminho tem uma coreografia própria: a partícula **segue** até o núcleo (permitida), **para no portão** (aguardando você) ou **bate e volta** (bloqueada).

## 🧩 Pilares

| Pilar | O que entrega | Fase |
|---|---|:---:|
| 🛂 **Controle** | Permissões por agente, tetos de gasto com reserva atômica, autonomia (`auto` · `approve` · `double`), dupla aprovação por humanos distintos, pausa individual e global | 1–2 |
| 📚 **Contexto** | Documentos versionados (empresa, regras, FAQ, playbooks), precedência por escopo, diff, rascunho → revisão → publicado, "o que o agente sabia" em cada execução | 3 |
| 🧠 **Memória** | Episódica, semântica e procedural; fila de revisão humana; consolidação; defesa contra envenenamento; direito de esquecer (LGPD/GDPR) | 3 |
| 🫀 **Saúde** | Índice de Colapso Cognitivo por agente (ICC) e Índice de Estresse do Ecossistema (IEE), com respostas automáticas e incidentes | 4 |
| 📊 **Gestão** | Resumo da manhã, relatório semanal, mudanças com canário e rollback automático, versionamento de agentes | 5 |
| 🔌 **Integrações** | Adaptadores, cofre de segredos, webhooks assinados e *tool proxy* (o agente nunca vê a credencial) | 6 |
| 🧾 **Auditoria** | Trilha append-only com hash encadeado e verificação de integridade | 2 |

## 🫀 Saúde cognitiva

O sistema **mede sintomas observáveis** — repetição, saturação de contexto, deriva, citação de entidades inexistentes, taxa de erro, rejeição humana — e os combina num índice de 0 a 1. Reage de forma proporcional:

```mermaid
stateDiagram-v2
    direction LR
    [*] --> STABLE
    STABLE --> WATCH: ICC ≥ 0,30
    WATCH --> DEGRADING: ICC ≥ 0,55
    DEGRADING --> COLLAPSE: ICC ≥ 0,75
    COLLAPSE --> DEGRADING: liberação humana
    DEGRADING --> WATCH: recuperou
    WATCH --> STABLE: recuperou
```

| Nível | Resposta do sistema |
|---|---|
| 🟢 **STABLE** | Nada a fazer |
| 🟡 **WATCH** | Alerta discreto no card, com o sinal destacado |
| 🟠 **DEGRADING** | Rebaixa a autonomia um degrau, reduz a taxa e abre incidente |
| 🔴 **COLLAPSE** | **Quarentena**: nega novas ações e notifica os aprovadores. Só um humano libera |

> [!WARNING]
> Os limiares são **pontos de partida**, não verdade absoluta. A Fase 4 inclui **modo sombra** (mede sem agir) para calibrar antes de confiar nos alertas. Detalhes na seção 11 da spec.

<img src="docs/assets/divider.svg" alt="" width="100%" height="6" />

## 🧱 Arquitetura

```mermaid
flowchart LR
    subgraph AG["🤖 Agentes externos"]
        A1["SDK / REST"]
    end

    subgraph API["🛡️ API · Bun + Elysia"]
        GW["Gateway de ações"] --> POL["Motor de políticas<br/>(pacote puro)"]
        CTX["Contexto e memória"]
        HLT["Saúde · ICC / IEE"]
        MGT["Gestão"]
        AUD["Auditoria append-only"]
    end

    DB[("PostgreSQL<br/>+ pgvector")]
    WEB["🖥️ Web · RSBuild + Solid<br/>Mapa 3D · Three.js"]
    INT["🔌 Integrações"]

    A1 -- propose / result --> GW
    GW -- decisão --> A1
    API --> DB
    API -- SSE --> WEB
    WEB -- aprovar / configurar --> API
    API <--> INT
```

**Regra de arquitetura:** `policy`, `health`, `context` e `memory` são **pacotes puros** (sem I/O). As rotas da API são finas: carregam dados, chamam o pacote e persistem o resultado. Isso deixa o núcleo testável sem banco.

## 🚀 Começar em 5 minutos

**Fase 0.** Pré-requisitos: [Bun](https://bun.sh) ≥ 1.2 e Docker Desktop rodando.

```powershell
cp .env.example .env          # configurações locais
bun install                   # instala tudo (monorepo)
bun run db:up                 # sobe Postgres + pgvector no Docker
bun run db:migrate            # cria as tabelas (primeira vez: --name init)
bun test                      # testes unitários
bun run dev                   # API (3000) + Web (5173) juntos
```

| Serviço | Endereço |
|---|---|
| 🛡️ API | <http://localhost:3000> |
| 🖥️ Web | <http://localhost:5173> |

### ✅ Aceite da Fase 0

Criar usuário e workspace por API:

```powershell
# 1. Criar usuário
curl -X POST http://localhost:3000/v1/users -H "Content-Type: application/json" `
  -d '{"email":"voce@exemplo.com","name":"Você","password":"senha-forte-123"}'

# 2. Login → copie o token
curl -X POST http://localhost:3000/v1/sessions -H "Content-Type: application/json" `
  -d '{"email":"voce@exemplo.com","password":"senha-forte-123"}'

# 3. Criar workspace (com o token)
curl -X POST http://localhost:3000/v1/workspaces -H "Content-Type: application/json" `
  -H "Authorization: Bearer SEU_TOKEN" -d '{"name":"Meu Ecossistema"}'
```

<details>
<summary><b>🐧 Prefere bash (Linux/macOS)?</b></summary>

<br />

```bash
curl -X POST http://localhost:3000/v1/users -H "Content-Type: application/json" \
  -d '{"email":"voce@exemplo.com","name":"Você","password":"senha-forte-123"}'

curl -X POST http://localhost:3000/v1/sessions -H "Content-Type: application/json" \
  -d '{"email":"voce@exemplo.com","password":"senha-forte-123"}'

curl -X POST http://localhost:3000/v1/workspaces -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" -d '{"name":"Meu Ecossistema"}'
```

</details>

## 📁 Estrutura

```
apps/api        API (Bun + Elysia) — rotas finas, sem regra de negócio
apps/web        Web (RSBuild + Solid + TanStack)
packages/shared Schemas Zod — única fonte de verdade dos contratos
packages/*      policy, health, context, memory (PUROS — chegam na Fase 1/3/4)
prisma/         Schema e migrações (Postgres + pgvector)
infra/          docker-compose
docs/           Spec, ADRs, diário, parking-lot
```

## 🧰 Stack

<div align="center">

<img src="https://skillicons.dev/icons?i=bun,ts,postgres,prisma,docker,threejs,solidjs&perline=7" alt="Bun, TypeScript, PostgreSQL, Prisma, Docker, Three.js, SolidJS" />

</div>

| Camada | Tecnologia |
|---|---|
| Runtime e API | **Bun** · **ElysiaJS** |
| Contratos | **Zod** (pacote `shared` compartilhado entre API, SDK e Web) |
| Banco | **PostgreSQL** + **pgvector** · **Prisma** |
| Web | **RSBuild** · **Solid** · **TanStack** · **UnoCSS** · **Kobalte** |
| 3D | **Three.js** |
| Infra local | **Docker Compose** |

## 🧭 Roadmap

Cada fase termina com uma **demonstração de aceite**. Não se começa a próxima sem ela.

```mermaid
flowchart LR
    F0["🧱 Fase 0<br/>Fundação"]:::now --> F1["⚡ Fase 1<br/>1ª ação real"]
    F1 --> F2["🛂 Fase 2<br/>Controle"]
    F2 --> F3["🧠 Fase 3<br/>Contexto + Memória"]
    F3 --> F4["🫀 Fase 4<br/>Saúde"]
    F4 --> F5["📊 Fase 5<br/>Gestão"]
    F5 --> F6["🔌 Fase 6<br/>Integrações"]
    F6 --> F7["🏁 Fase 7<br/>Produto"]

    classDef now fill:#0a84ff,stroke:#0a84ff,color:#fff
    classDef default fill:#1c1c1e,stroke:#48484a,color:#f5f5f7
```

| Fase | Entrega | Aceite | Duração |
|:---:|---|---|:---:|
| 🔵 **0** | Monorepo, CI, Docker, Prisma, auth, schemas Zod | Criar usuário e workspace por API | ~1 sem |
| ⚪ **1** | Registrar agente, `propose/result`, política v1, aprovação, SSE e mapa 3D com eventos reais | Um script real propõe 10 ações: 6 passam, 2 pedem aprovação, 2 são negadas, tudo aparece no mapa | ~2 sem |
| ⚪ **2** | Dupla aprovação, orçamento atômico, auditoria com hash, RBAC, kill switch | Teste de carga sem estourar o limite; `audit/verify` detecta adulteração | ~2 sem |
| ⚪ **3** | Páginas de Contexto e Memória, `context.pack`, "o que o agente sabia" | Mudar uma regra altera o comportamento do agente; apagar memória remove o embedding | ~3 sem |
| ⚪ **4** | Sinais, ICC/IEE, modo sombra, incidentes, resposta automática | *Loop* injetado é detectado, rebaixado e recuperado | ~3 sem |
| ⚪ **5** | Relatórios, mudanças com canário, rollback, versionamento | Mudança ruim em canário volta sozinha | ~2 sem |
| ⚪ **6** | Cofre, 1ª integração real, *tool proxy*, webhooks, testes de caos | Agente age sem nunca ver a credencial | ~4 sem |
| ⚪ **7** | Multi-tenant completo, billing, onboarding, SDKs, status page | — | contínuo |

<!-- 🎥 DEMO: grave um GIF/vídeo de 60–90 s do mapa 3D funcionando, salve em docs/assets/demo.gif e descomente a linha abaixo.
<div align="center"><img src="docs/assets/demo.gif" alt="Demonstração do mapa 3D do Oxty" width="90%" /></div>
-->

<img src="docs/assets/divider.svg" alt="" width="100%" height="6" />

## 🤝 Governança do projeto

- Nada entra no código sem estar na spec; mudanças na spec vão para a **seção 24** (registro de decisões).
- Ideias novas → [`docs/parking-lot.md`](docs/parking-lot.md). Progresso → [`docs/diario.md`](docs/diario.md).
- Decisões → [`docs/adr/`](docs/adr/).

### Contribuindo

1. Leia a [spec](docs/Oxty-SPEC.md) e confirme em qual **fase** o item se encaixa.
2. Abra uma *issue* descrevendo a fatia (idealmente de até 1 dia de trabalho).
3. Teste primeiro: o motor de políticas segue a tabela de decisão da seção 6.
4. Mudança de decisão arquitetural? Registre um ADR em `docs/adr/`.

<details>
<summary><b>⭐ Histórico de estrelas e contribuidores</b></summary>

<br />

<a href="https://star-history.com/#SEU_USUARIO/Oxty&Date">
  <img src="https://api.star-history.com/svg?repos=SEU_USUARIO/Oxty&type=Date" alt="Histórico de estrelas do Oxty" width="100%" />
</a>

<a href="https://github.com/SEU_USUARIO/Oxty/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=SEU_USUARIO/Oxty" alt="Contribuidores" />
</a>

</details>

## 📜 Licença

A definir. Enquanto não houver um arquivo `LICENSE`, todos os direitos são reservados.

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&section=footer&height=120&color=0:BF5AF2,50:5E5CE6,100:0A84FF" alt="" width="100%" />

**Governe com calma. Aprove o que importa.**

</div>
