# Vessify Assignment - Secure Transaction Extractor


Tiny but production-realistic personal finance transaction extractor with Better Auth, tenant isolation, and protected user-scoped APIs.


## Stack


- Backend: Hono + TypeScript
- Database: PostgreSQL + Prisma
- Auth backend: Better Auth + Organization + Teams + JWT + Bearer plugins
- Auth frontend: Better Auth React client (session cookies synced via `/api/auth` proxy)
- Frontend: Next.js App Router + TypeScript + Server Components
- UI: shadcn-style components + Tailwind CSS
- Tests: Jest


## Monorepo Structure


- apps/web: Next.js app with login/register/protected dashboard
- apps/api: Hono API with auth and transactions endpoints
- packages/db: Prisma schema and client
- packages/auth: Better Auth configuration
- packages/domain: Parser, schema validation, pagination helpers
- tests: Jest tests for auth validation, extraction, and isolation


## Required Endpoints


- POST /api/auth/register
- POST /api/auth/login
- POST /api/transactions/extract (protected)
- GET /api/transactions (protected + cursor pagination)
- GET /api/transactions/extract/:jobId (status)


## Security and Isolation


- Better Auth email/password with secure password hashing
- 7-day session and JWT support
- Organization and team-aware tenant context
- All transaction and extraction queries are constrained by organization membership
- Optional PostgreSQL RLS policy script in packages/db/prisma/rls.sql


## Local Setup


1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:
  - `npm install`
3. Generate Prisma client:
  - `npm --workspace packages/db run generate`
4. Run migrations (Postgres required):
  - `npm --workspace packages/db run migrate`
5. Start both apps:
  - `npm run dev`


## How To Use


1. Open web app: http://localhost:3000
2. Register a new account.
3. Sign in.
4. Paste one of the sample texts in the extractor dashboard.
5. Submit extraction and observe tenant-scoped transaction records.


## Sample Text Coverage


The parser handles all required samples:


1. `Date: 11 Dec 2025 ... Amount: -420.00 ...`
2. `Uber Ride ... 12/11/2025 -> Rs 1,250.00 debited ...`
3. `txn123 2025-12-10 Amazon.in ... Rs2,999.00 Dr Bal 14171.50 ...`


## Tests


Run:


- `npm test`


Current test set (7):


- auth validation (2)
- parser and cursor behavior (5, includes all 3 sample texts)
- tenant isolation resolver behavior (2)


## Deployment (Bonus)


- Frontend: Vercel (apps/web)
- Backend + DB: Railway/Render/Fly
- Configure environment variables exactly as in `.env.example`


## Notes


- The web app uses the Better Auth React client (`authClient`) for login, register, sign-out, and session sync.
- `/api/auth/*` requests are proxied from Next.js to the Hono API so session cookies stay on the web origin.
- Server components and API routes read the Better Auth session and forward cookies/bearer tokens to the Hono API.
- API requests automatically include organization scope via `x-organization-id` from the active Better Auth organization.
