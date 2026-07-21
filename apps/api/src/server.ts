import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { auth, getAuthSession } from "@vessify/auth";
import { prisma } from "@vessify/db";
import {
  decodeCursor,
  encodeCursor,
  extractSchema,
  listTransactionsSchema,
  loginSchema,
  registerSchema
} from "@vessify/domain";
import { processExtractionJob } from "./extraction-service";
import { resolveTenantContext } from "./tenant";

type Variables = {
  session: Awaited<ReturnType<typeof getAuthSession>> | null;
};

const app = new Hono<{ Variables: Variables }>();

app.use(
  "*",
  cors({
    origin: process.env.WEB_BASE_URL ?? "http://localhost:3000",
    allowHeaders: ["Content-Type", "Authorization", "x-organization-id"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    exposeHeaders: ["set-auth-token", "set-auth-jwt", "set-cookie"],
    credentials: true
  })
);

app.use("*", async (c, next) => {
  const session = await getAuthSession(c.req.raw.headers);
  c.set("session", session ?? null);
  await next();
});

function copyAuthHeaders(from: Headers, to: Headers) {
  const token = from.get("set-auth-token");
  const jwtValue = from.get("set-auth-jwt");
  const setCookie = from.get("set-cookie");

  if (token) to.set("set-auth-token", token);
  if (jwtValue) to.set("set-auth-jwt", jwtValue);
  if (setCookie) to.append("set-cookie", setCookie);
}

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    result[key] = value;
  }
  return result;
}

app.post("/api/auth/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");

  const response = await auth.api.signUpEmail({
    body: {
      email: body.email,
      password: body.password,
      name: body.name ?? body.email.split("@")[0] ?? "User"
    },
    headers: c.req.raw.headers,
    asResponse: true
  });

  const payload = (await response.clone().json().catch(() => ({}))) as {
    user?: { id: string; name: string; email: string };
  };

  let organization = null;
  if (payload.user?.id) {
    organization = await auth.api.createOrganization({
      body: {
        userId: payload.user.id,
        name: `${payload.user.name} Workspace`,
        slug: `${payload.user.id.slice(0, 12)}-workspace`
      }
    });
  }

  const headers = new Headers();
  copyAuthHeaders(response.headers, headers);

  return c.json(
    {
      user: payload.user,
      organization
    },
    201,
    headersToRecord(headers)
  );
});

app.post("/api/auth/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");

  const response = await auth.api.signInEmail({
    body,
    headers: c.req.raw.headers,
    asResponse: true
  });

  const payload = (await response.clone().json().catch(() => ({}))) as {
    user?: { id: string; email: string; name: string };
  };

  const organizations = payload.user?.id
    ? await prisma.member.findMany({
        where: {
          userId: payload.user.id
        },
        select: {
          organizationId: true
        }
      })
    : [];

  const headers = new Headers();
  copyAuthHeaders(response.headers, headers);

  return c.json(
    {
      user: payload.user,
      token: response.headers.get("set-auth-token"),
      jwt: response.headers.get("set-auth-jwt"),
      organizationIds: organizations.map((row: { organizationId: string }) => row.organizationId)
    },
    200,
    headersToRecord(headers)
  );
});

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.post("/api/transactions/extract", zValidator("json", extractSchema), async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const tenant = await resolveTenantContext(
    session,
    c.req.header("x-organization-id") ?? null
  );

  const { text } = c.req.valid("json");

  const job = await prisma.extractionJob.create({
    data: {
      userId: tenant.userId,
      organizationId: tenant.organizationId,
      teamId: tenant.teamId,
      sourceText: text,
      status: "PENDING"
    }
  });

  queueMicrotask(() => {
    void processExtractionJob(job.id, text, tenant);
  });

  return c.json(
    {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt
    },
    202
  );
});

app.get("/api/transactions", zValidator("query", listTransactionsSchema), async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const tenant = await resolveTenantContext(
    session,
    c.req.header("x-organization-id") ?? null
  );

  const { limit, cursor } = c.req.valid("query");

  const decodedCursor = cursor ? decodeCursor(cursor) : null;

  const rows = await prisma.transaction.findMany({
    where: {
      organizationId: tenant.organizationId,
      ...(decodedCursor
        ? {
            OR: [
              { createdAt: { lt: new Date(decodedCursor.createdAt) } },
              {
                createdAt: new Date(decodedCursor.createdAt),
                id: { lt: decodedCursor.id }
              }
            ]
          }
        : {})
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1
  });

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage
    ? encodeCursor({
        createdAt: items[items.length - 1].createdAt.toISOString(),
        id: items[items.length - 1].id
      })
    : null;

  return c.json({
    items,
    pageInfo: {
      nextCursor,
      hasNextPage
    }
  });
});

app.get("/api/transactions/extract/:jobId", async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const tenant = await resolveTenantContext(
    session,
    c.req.header("x-organization-id") ?? null
  );

  const job = await prisma.extractionJob.findFirst({
    where: {
      id: c.req.param("jobId"),
      organizationId: tenant.organizationId
    }
  });

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  return c.json(job);
});

app.get("/health", (c) => c.json({ ok: true }));

const port = Number(process.env.API_PORT ?? (process.env.NODE_ENV === "production" ? process.env.PORT : "8787") ?? 8787);

serve({
  fetch: app.fetch,
  port
});

export type AppType = typeof app;
