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
import { resolveTenantContext, type TenantContext } from "./tenant";
import {
 assignUserToDomainOrganization,
 ensureUserHasOrganization
} from "./assign-domain-organization";


function serializeTransaction(row: {
 amount: { toString(): string } | number | string;
 balanceAfter?: { toString(): string } | number | string | null;
 date: Date;
 createdAt: Date;
 updatedAt: Date;
 [key: string]: unknown;
}) {
 return {
   ...row,
   amount: Number(row.amount),
   balanceAfter: row.balanceAfter != null ? Number(row.balanceAfter) : null,
   date: row.date.toISOString(),
   createdAt: row.createdAt.toISOString(),
   updatedAt: row.updatedAt.toISOString()
 };
}


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


function authHeadersFromResponse(incoming: Headers, authResponse: Response): Headers {
 const headers = new Headers(incoming);
 const setCookie = authResponse.headers.get("set-cookie");


 if (setCookie) {
   headers.set("cookie", setCookie);
 }


 const token = authResponse.headers.get("set-auth-token");
 if (token) {
   headers.set("authorization", `Bearer ${token}`);
 }


 return headers;
}


async function resolveTenantOrRespond(
 c: { req: { header: (name: string) => string | undefined }; json: (body: unknown, status?: number) => Response },
 session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>
): Promise<TenantContext | Response> {
 try {
   return await resolveTenantContext(session, c.req.header("x-organization-id") ?? null);
 } catch (error) {
   const message = error instanceof Error ? error.message : "Forbidden";
   return c.json({ error: message }, 403);
 }
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
 if (payload.user?.id && payload.user.email) {
   const authHeaders = authHeadersFromResponse(c.req.raw.headers, response);
   organization = await assignUserToDomainOrganization(
     payload.user.id,
     payload.user.email,
     authHeaders,
     payload.user.name
   );
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


app.post("/api/auth/ensure-organization", async (c) => {
 const session = c.get("session");
 if (!session?.user) {
   return c.json({ error: "Unauthorized" }, 401);
 }


 const organization = await ensureUserHasOrganization(
   session.user.id,
   session.user.email,
   c.req.raw.headers,
   session.user.name
 );


 return c.json({ organization });
});


app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));


app.post("/api/transactions/extract", zValidator("json", extractSchema), async (c) => {
 const session = c.get("session");
 if (!session) {
   return c.json({ error: "Unauthorized" }, 401);
 }


 const tenant = await resolveTenantOrRespond(c, session);
 if (tenant instanceof Response) {
   return tenant;
 }


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


 const tenant = await resolveTenantOrRespond(c, session);
 if (tenant instanceof Response) {
   return tenant;
 }


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
   items: items.map(serializeTransaction),
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


 const tenant = await resolveTenantOrRespond(c, session);
 if (tenant instanceof Response) {
   return tenant;
 }


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


app.onError((error, c) => {
 console.error(error);
 const message = error instanceof Error ? error.message : "Internal Server Error";
 return c.json({ error: message }, 500);
});


app.get("/health", (c) => c.json({ ok: true }));


const port = Number(process.env.API_PORT ?? (process.env.NODE_ENV === "production" ? process.env.PORT : "8787") ?? 8787);


serve({
 fetch: app.fetch,
 port
});


export type AppType = typeof app;





