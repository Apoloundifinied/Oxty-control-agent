import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "./db";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-trocar-em-producao";

/**
 * Auth básica da Fase 0 (spec seção 19):
 * - POST /v1/users        → cria usuário (e-mail + senha forte)
 * - POST /v1/sessions     → login, devolve JWT
 * - POST /v1/workspaces   → cria workspace + membership OWNER (JWT)
 * - GET  /v1/me           → dados do usuário logado (JWT)
 * - GET  /health          → liveness
 */
const app = new Elysia({ prefix: "/v1" })
  .use(cors())
  .use(jwt({ name: "jwt", secret: JWT_SECRET, exp: "7d" }))

  .get("/health-live", () => ({ ok: true, service: "ia-control-api" }))

  // ── Registro ──────────────────────────────────────────────────────────────
  .post(
    "/users",
    async ({ body, set }) => {
      const exists = await prisma.user.findUnique({ where: { email: body.email } });
      if (exists) {
        set.status = 409;
        return { code: "EMAIL_TAKEN", message: "E-mail já cadastrado" };
      }
      const passwordHash = await Bun.password.hash(body.password, { algorithm: "argon2id" });
      const user = await prisma.user.create({
        data: { email: body.email, name: body.name, passwordHash },
        select: { id: true, email: true, name: true, createdAt: true },
      });
      set.status = 201;
      return user;
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        name: t.String({ minLength: 1 }),
        password: t.String({ minLength: 8 }),
      }),
    },
  )

  // ── Login ─────────────────────────────────────────────────────────────────
  .post(
    "/sessions",
    async ({ body, jwt, set }) => {
      const user = await prisma.user.findUnique({ where: { email: body.email } });
      if (!user || !(await Bun.password.verify(body.password, user.passwordHash))) {
        set.status = 401;
        return { code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos" };
      }
      const token = await jwt.sign({ sub: user.id, email: user.email });
      return { token };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 1 }),
      }),
    },
  )

  // ── Rotas autenticadas ────────────────────────────────────────────────────
  .guard(
    {
      beforeHandle: async ({ jwt, headers, set }) => {
        const auth = headers.authorization;
        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
        const payload = token ? await jwt.verify(token) : false;
        if (!payload) {
          set.status = 401;
          return { code: "UNAUTHORIZED", message: "Token ausente ou inválido" };
        }
      },
    },
    (app) =>
      app
        .derive(({ headers }) => ({ auth: headers as Record<string, string | undefined> }))
        .get("/me", async ({ jwt, headers, set }) => {
          const token = headers.authorization!.slice(7);
          const payload = await jwt.verify(token);
          if (!payload) {
            set.status = 401;
            return { code: "UNAUTHORIZED", message: "Token inválido" };
          }
          const user = await prisma.user.findUnique({
            where: { id: payload.sub as string },
            select: {
              id: true, email: true, name: true,
              memberships: { select: { workspaceId: true, role: true } },
            },
          });
          return user;
        })
        .post(
          "/workspaces",
          async ({ jwt, headers, body, set }) => {
            const token = headers.authorization!.slice(7);
            const payload = await jwt.verify(token);
            if (!payload) {
              set.status = 401;
              return { code: "UNAUTHORIZED", message: "Token inválido" };
            }
            const workspace = await prisma.workspace.create({
              data: {
                name: body.name,
                memberships: {
                  create: { userId: payload.sub as string, role: "OWNER" },
                },
              },
              include: { memberships: true },
            });
            set.status = 201;
            return workspace;
          },
          {
            body: t.Object({ name: t.String({ minLength: 1 }) }),
          },
        ),
  )
  .get("/", () => ({ name: "ia-control-api", version: "0.1.0" }));

export type App = typeof app;

// Rota de health fora do prefixo /v1 para healthchecks simples
const server = new Elysia()
  .get("/health", () => ({ ok: true, service: "ia-control-api" }))
  .mount(app)
  .listen(Number(process.env.PORT ?? 3000));

console.log(`🛡️  IA-Control API rodando em http://localhost:${server.server?.port}`);
