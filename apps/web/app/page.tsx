import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import {
 ensureServerOrganization,
 getActiveOrganizationId,
 getServerSession
} from "@/lib/auth-server";
import { extractEmailDomain } from "@vessify/domain";
import { ExtractorClient } from "./extractor-client";


export default async function HomePage() {
 const session = await getServerSession();


 if (!session?.user) {
   redirect("/login");
 }


 let organizationId = await getActiveOrganizationId();
 if (!organizationId) {
   organizationId = await ensureServerOrganization();
 }
 const emailDomain = session.user.email ? extractEmailDomain(session.user.email) : null;


 const response = await apiFetch("/api/transactions?limit=20");
 const payload = response.ok ? await response.json() : { items: [] };


 return (
   <main className="min-h-screen bg-[radial-gradient(circle_at_15%_0%,#fef3c7_0%,transparent_28%),radial-gradient(circle_at_90%_10%,#dbeafe_0%,transparent_30%),linear-gradient(to_b,#f8fafc,#f1f5f9)] px-4 py-8">
     <section className="mx-auto max-w-6xl space-y-6">
       <header className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm shadow-slate-200/50 backdrop-blur-md">
         <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
           <div>
             <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600/80">
               Vessify Assignment
             </p>
             <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
               Secure Transaction Extraction
             </h1>
             <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
               Signed in as <span className="font-medium text-slate-800">{session.user.email}</span>
               {emailDomain ? (
                 <>
                   {" · "}
                   Organization domain:{" "}
                   <span className="font-medium text-slate-700">{emailDomain}</span>
                 </>
               ) : null}
               {" · "}
               Org scope:{" "}
               <span className="font-mono text-xs text-slate-500">
                 {organizationId ?? "not set"}
               </span>
             </p>
           </div>
         </div>
       </header>
       <ExtractorClient initialTransactions={payload.items ?? []} />
     </section>
   </main>
 );
}
