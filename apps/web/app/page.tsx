import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { apiFetch } from "@/lib/api-client";
import { authOptions } from "@/lib/auth-options";
import { ExtractorClient } from "./extractor-client";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const response = await apiFetch("/api/transactions?limit=20");
  const payload = response.ok ? await response.json() : { items: [] };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,#fde68a_0%,transparent_35%),radial-gradient(circle_at_85%_15%,#bfdbfe_0%,transparent_35%),#f8fafc] px-4 py-8">
      <section className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
          <p className="text-xs uppercase tracking-widest text-slate-500">Vessify Assignment</p>
          <h1 className="text-2xl font-semibold text-slate-900">Secure Transaction Extraction Workspace</h1>
          <p className="mt-2 text-sm text-slate-600">
            Signed in as {session.user.email}. Organization scope: {session.organizationId ?? "not set"}
          </p>
        </header>
        <ExtractorClient initialTransactions={Array.isArray(payload.items) ? payload.items : []} />
      </section>
    </main>
  );
}
