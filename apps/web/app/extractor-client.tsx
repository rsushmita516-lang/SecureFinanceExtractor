"use client";


import { ChangeEvent, FormEvent, useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import {
 ArrowDownLeft,
 ArrowUpRight,
 Gauge,
 LogOut,
 Sparkles,
 TrendingUp,
 Upload,
 Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


type Transaction = {
 id: string;
 date: string;
 description: string;
 amount: number;
 currency: string;
 balanceAfter: number | null;
 confidence: number | null;
 category: string | null;
};


type Props = {
 initialTransactions: Transaction[];
};


function toAmount(value: number | string | null | undefined): number {
 if (value == null || value === "") {
   return 0;
 }


 const parsed = typeof value === "number" ? value : Number(value);
 return Number.isFinite(parsed) ? parsed : 0;
}


function formatLedgerAmount(amount: number, currency = "INR"): string {
 const symbol = currency === "INR" ? "₹" : "$";
 return `${symbol}${Math.abs(amount).toLocaleString(undefined, {
   minimumFractionDigits: 2,
   maximumFractionDigits: 2
 })}`;
}


const SAMPLE_TEMPLATES = [
 {
   name: "Starbucks",
   text: `Date: 11 Dec 2025\nDescription: STARBUCKS COFFEE MUMBAI\nAmount: -420.00\nBalance after transaction: 18,420.50`
 },
 {
   name: "Uber debited",
   text: `Uber Ride * Airport Drop\n12/11/2025 → ₹1,250.00 debited\nAvailable Balance → ₹17,170.50`
 },
 {
   name: "Amazon Dr",
   text: `txn123 2025-12-10 Amazon.in Order #403-1234567-8901234 ₹2,999.00 Dr Bal 14171.50 Shopping`
 }
];


export function ExtractorClient({ initialTransactions }: Props) {
 const [text, setText] = useState("");
 const [loading, setLoading] = useState(false);
 const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
 const [nextCursor, setNextCursor] = useState<string | null>(null);
 const [hasNextPage, setHasNextPage] = useState(false);
 const [activeJob, setActiveJob] = useState<{ id: string; status: string; error?: string | null } | null>(null);
 const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
 const [fileUploadError, setFileUploadError] = useState<string | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);


 useEffect(() => {
   void fetchPage(null, true);
 }, []);


 async function fetchPage(cursor: string | null, replace: boolean = false) {
   const url = `/api/transactions?limit=10${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
   const response = await fetch(url, { cache: "no-store" });
   if (!response.ok) return;


   const payload = await response.json();
   if (replace) {
     setTransactions(payload.items ?? []);
   } else {
     setTransactions((prev) => {
       const existingIds = new Set(prev.map((t) => t.id));
       const filteredNew = (payload.items ?? []).filter((t: Transaction) => !existingIds.has(t.id));
       return [...prev, ...filteredNew];
     });
   }
   setNextCursor(payload.pageInfo?.nextCursor ?? null);
   setHasNextPage(payload.pageInfo?.hasNextPage ?? false);
 }


 useEffect(() => {
   if (!activeJob || activeJob.status === "COMPLETED" || activeJob.status === "FAILED") {
     return;
   }


   let isSubscribed = true;
   const interval = setInterval(async () => {
     try {
       const response = await fetch(`/api/transactions/extract/${activeJob.id}`);
       if (!response.ok) return;


       const job = await response.json();
       if (!isSubscribed) return;


       if (job.status === "COMPLETED") {
         setActiveJob({ id: job.id, status: "COMPLETED" });
         clearInterval(interval);
         void fetchPage(null, true);
       } else if (job.status === "FAILED") {
         setActiveJob({ id: job.id, status: "FAILED", error: job.error });
         clearInterval(interval);
       }
     } catch (err) {
       console.error("Error polling job status:", err);
     }
   }, 1200);


   return () => {
     isSubscribed = false;
     clearInterval(interval);
   };
 }, [activeJob]);


 async function onExtract(event: FormEvent) {
   event.preventDefault();
   if (!text.trim()) return;


   setLoading(true);
   setActiveJob(null);


   try {
     const response = await fetch("/api/transactions/extract", {
       method: "POST",
       headers: {
         "Content-Type": "application/json"
       },
       body: JSON.stringify({ text })
     });


     const payload = await response.json();
     if (!response.ok) {
       setActiveJob({
         id: "failed-request",
         status: "FAILED",
         error: payload.error ?? "Failed to submit extraction job"
       });
       return;
     }


     setActiveJob({
       id: payload.jobId,
       status: payload.status ?? "PENDING"
     });
     setText("");
     setUploadedFileName(null);
     setFileUploadError(null);
   } catch {
     setActiveJob({
       id: "failed-request",
       status: "FAILED",
       error: "Network error submitting extraction"
     });
   } finally {
     setLoading(false);
   }
 }


 function loadTemplate(sampleText: string) {
   setText(sampleText);
   setActiveJob(null);
   setUploadedFileName(null);
   setFileUploadError(null);
 }


 function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
   const file = event.target.files?.[0];
   event.target.value = "";


   if (!file) {
     return;
   }


   setFileUploadError(null);
   setActiveJob(null);


   const isTextFile =
     file.type.startsWith("text/") ||
     file.name.endsWith(".txt") ||
     file.name.endsWith(".text");


   if (!isTextFile) {
     setFileUploadError("Please upload a plain text file (.txt).");
     return;
   }


   const reader = new FileReader();
   reader.onload = () => {
     const content = typeof reader.result === "string" ? reader.result.trim() : "";
     if (!content) {
       setFileUploadError("The file is empty.");
       setUploadedFileName(null);
       return;
     }


     setText(content);
     setUploadedFileName(file.name);
   };
   reader.onerror = () => {
     setFileUploadError("Could not read the file. Please try again.");
     setUploadedFileName(null);
   };
   reader.readAsText(file);
 }


 const ledgerStats = transactions.reduce(
   (stats, item) => {
     const amount = toAmount(item.amount);
     if (amount > 0) {
       stats.totalInflow += amount;
       stats.depositCount += 1;
     } else if (amount < 0) {
       stats.totalOutflow += Math.abs(amount);
       stats.expenseCount += 1;
     }


     if (item.confidence != null) {
       stats.confidenceTotal += toAmount(item.confidence);
       stats.confidenceCount += 1;
     }


     return stats;
   },
   {
     totalInflow: 0,
     totalOutflow: 0,
     depositCount: 0,
     expenseCount: 0,
     confidenceTotal: 0,
     confidenceCount: 0
   }
 );


 const netWorth = ledgerStats.totalInflow - ledgerStats.totalOutflow;
 const averageConfidence =
   ledgerStats.confidenceCount > 0
     ? Math.round((ledgerStats.confidenceTotal / ledgerStats.confidenceCount) * 100)
     : null;


 return (
   <div className="space-y-6">
     {/* Ledger Overview */}
     <section className="space-y-3">
       <div className="flex items-end justify-between gap-4">
         <div>
           <h2 className="text-lg font-semibold text-slate-900">Ledger Overview</h2>
           <p className="text-sm text-slate-500">Tenant-scoped financial snapshot</p>
         </div>
         <Button
           type="button"
           variant="outline"
           size="sm"
           className="shrink-0 border-slate-200 bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900"
           onClick={() => signOut({ callbackUrl: "/login" })}
         >
           <LogOut className="mr-1.5 h-3.5 w-3.5" />
           Sign Out
         </Button>
       </div>


       <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
         <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg shadow-slate-900/15">
           <CardHeader className="pb-2">
             <div className="flex items-center justify-between">
               <CardDescription className="text-slate-300">Ledger Net Worth</CardDescription>
               <div className="rounded-lg bg-white/10 p-2">
                 <Wallet className="h-4 w-4 text-amber-300" />
               </div>
             </div>
             <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
               {netWorth >= 0 ? "+" : "-"}
               {formatLedgerAmount(netWorth)}
             </CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-xs text-slate-400">Running ledger account</p>
           </CardContent>
         </Card>


         <Card className="border-emerald-100/80 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
           <CardHeader className="pb-2">
             <div className="flex items-center justify-between">
               <CardDescription className="text-emerald-700/70">Total Inflow</CardDescription>
               <div className="rounded-lg bg-emerald-100 p-2">
                 <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
               </div>
             </div>
             <CardTitle className="text-2xl font-bold text-emerald-700">
               +{formatLedgerAmount(ledgerStats.totalInflow)}
             </CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-xs text-slate-500">
               From {ledgerStats.depositCount} deposit {ledgerStats.depositCount === 1 ? "entry" : "entries"}
             </p>
           </CardContent>
         </Card>


         <Card className="border-rose-100/80 bg-gradient-to-br from-rose-50 to-white shadow-sm">
           <CardHeader className="pb-2">
             <div className="flex items-center justify-between">
               <CardDescription className="text-rose-700/70">Total Outflow</CardDescription>
               <div className="rounded-lg bg-rose-100 p-2">
                 <ArrowUpRight className="h-4 w-4 text-rose-600" />
               </div>
             </div>
             <CardTitle className="text-2xl font-bold text-rose-700">
               -{formatLedgerAmount(ledgerStats.totalOutflow)}
             </CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-xs text-slate-500">
               Across {ledgerStats.expenseCount} expense {ledgerStats.expenseCount === 1 ? "entry" : "entries"}
             </p>
           </CardContent>
         </Card>


         <Card className="border-sky-100/80 bg-gradient-to-br from-sky-50 to-white shadow-sm">
           <CardHeader className="pb-2">
             <div className="flex items-center justify-between">
               <CardDescription className="text-sky-700/70">Confidence Score</CardDescription>
               <div className="rounded-lg bg-sky-100 p-2">
                 <Gauge className="h-4 w-4 text-sky-600" />
               </div>
             </div>
             <CardTitle className="text-2xl font-bold text-slate-800">
               {averageConfidence !== null ? `${averageConfidence}%` : "—"}
             </CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-xs text-slate-500">Extraction precision health</p>
           </CardContent>
         </Card>
       </div>
     </section>


     {/* Transactions Table */}
     <Card id="transactions-list-card" className="overflow-hidden border-slate-200/70 bg-white/90 shadow-md shadow-slate-200/40 backdrop-blur">
       <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
         <div className="flex items-center gap-2">
           <TrendingUp className="h-5 w-5 text-slate-500" />
           <div>
             <CardTitle className="text-xl font-bold text-slate-800">Your Scoped Ledger</CardTitle>
             <CardDescription className="text-slate-500">
               Historical transactions isolated to your organization workspace
             </CardDescription>
           </div>
         </div>
       </CardHeader>
       <CardContent className="p-0">
         <div className="overflow-x-auto">
           <table className="w-full text-left text-sm">
             <thead>
               <tr className="border-b border-slate-100 bg-white text-[11px] uppercase tracking-wider text-slate-400">
                 <th className="px-5 py-3.5 font-semibold">Date</th>
                 <th className="px-5 py-3.5 font-semibold">Category</th>
                 <th className="px-5 py-3.5 font-semibold">Description</th>
                 <th className="px-5 py-3.5 text-right font-semibold">Amount</th>
                 <th className="px-5 py-3.5 text-right font-semibold">Balance</th>
                 <th className="px-5 py-3.5 text-center font-semibold">Confidence</th>
               </tr>
             </thead>
             <tbody>
               {transactions.map((item, index) => {
                 const amount = toAmount(item.amount);
                 const balanceAfter =
                   item.balanceAfter != null ? toAmount(item.balanceAfter) : null;
                 const isDebit = amount < 0;
                 const confidencePercent = item.confidence
                   ? Math.round(toAmount(item.confidence) * 100)
                   : null;


                 return (
                   <tr
                     key={item.id}
                     className={`border-b border-slate-50 transition hover:bg-amber-50/30 ${
                       index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                     }`}
                   >
                     <td className="px-5 py-4 font-medium text-slate-600">
                       {new Date(item.date).toLocaleDateString(undefined, {
                         year: "numeric",
                         month: "short",
                         day: "numeric"
                       })}
                     </td>
                     <td className="px-5 py-4">
                       {item.category ? (
                         <span
                           className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                             item.category === "Food & Beverage"
                               ? "bg-amber-100 text-amber-800"
                               : item.category === "Transport"
                                 ? "bg-blue-100 text-blue-800"
                                 : "bg-slate-100 text-slate-700"
                           }`}
                         >
                           {item.category}
                         </span>
                       ) : (
                         <span className="text-xs text-slate-400">General</span>
                       )}
                     </td>
                     <td className="max-w-xs truncate px-5 py-4 font-medium text-slate-800">
                       {item.description}
                     </td>
                     <td
                       className={`px-5 py-4 text-right font-bold tabular-nums ${
                         isDebit ? "text-rose-600" : "text-emerald-600"
                       }`}
                     >
                       {isDebit ? "−" : "+"}
                       {item.currency === "INR" ? "₹" : "$"}
                       {Math.abs(amount).toLocaleString(undefined, {
                         minimumFractionDigits: 2,
                         maximumFractionDigits: 2
                       })}
                     </td>
                     <td className="px-5 py-4 text-right font-medium tabular-nums text-slate-600">
                       {balanceAfter !== null ? (
                         <span>
                           {item.currency === "INR" ? "₹" : "$"}
                           {balanceAfter.toLocaleString(undefined, {
                             minimumFractionDigits: 2,
                             maximumFractionDigits: 2
                           })}
                         </span>
                       ) : (
                         <span className="text-slate-300">—</span>
                       )}
                     </td>
                     <td className="px-5 py-4 text-center">
                       {confidencePercent !== null ? (
                         <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-2.5 py-0.5 text-xs font-medium shadow-sm">
                           <span
                             className={`h-1.5 w-1.5 rounded-full ${
                               confidencePercent >= 80
                                 ? "bg-emerald-500"
                                 : confidencePercent >= 60
                                   ? "bg-amber-500"
                                   : "bg-red-500"
                             }`}
                           />
                           <span className="text-slate-600">{confidencePercent}%</span>
                         </div>
                       ) : (
                         <span className="text-slate-300">—</span>
                       )}
                     </td>
                   </tr>
                 );
               })}
               {!transactions.length ? (
                 <tr>
                   <td className="px-5 py-14 text-center text-slate-400" colSpan={6}>
                     <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                       <Sparkles className="h-8 w-8 text-amber-300" />
                       <p className="font-medium text-slate-500">No transactions yet</p>
                       <p className="text-xs leading-relaxed">
                         Use a quick template below to extract your first transaction.
                       </p>
                     </div>
                   </td>
                 </tr>
               ) : null}
             </tbody>
           </table>
         </div>


         {hasNextPage ? (
           <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 text-center">
             <Button
               id="btn-load-more"
               type="button"
               variant="outline"
               className="border-slate-200 bg-white px-6 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
               onClick={() => nextCursor && fetchPage(nextCursor, false)}
             >
               Load Older Transactions
             </Button>
           </div>
         ) : null}
       </CardContent>
     </Card>


     {/* New Transaction Extraction — bottom */}
     <Card
       id="extractor-input-card"
       className="overflow-hidden border-amber-200/60 bg-gradient-to-b from-white to-amber-50/30 shadow-md shadow-amber-100/30"
     >
       <CardHeader className="border-b border-amber-100/80 pb-4">
         <div className="flex items-start gap-3">
           <div className="rounded-xl bg-amber-100 p-2.5">
             <Sparkles className="h-5 w-5 text-amber-700" />
           </div>
           <div>
             <CardTitle className="text-xl font-bold text-slate-900">New Transaction Extraction</CardTitle>
             <CardDescription className="mt-1 text-slate-500">
               Paste raw text or upload a .txt file from a bank SMS, email alert, or statement.
             </CardDescription>
           </div>
         </div>
       </CardHeader>
       <CardContent className="space-y-5 pt-5">
         <div className="flex flex-wrap items-center gap-2">
           <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quick templates</span>
           {SAMPLE_TEMPLATES.map((tpl, idx) => (
             <button
               key={idx}
               type="button"
               onClick={() => loadTemplate(tpl.text)}
               className="cursor-pointer rounded-full border border-amber-200/70 bg-white px-3 py-1 text-xs font-medium text-amber-900 shadow-sm transition hover:border-amber-300 hover:bg-amber-50"
             >
               {tpl.name}
             </button>
           ))}
         </div>


         <form className="space-y-4" onSubmit={onExtract}>
           <div className="flex flex-wrap items-center justify-between gap-3">
             <div className="flex flex-wrap items-center gap-2">
               <input
                 ref={fileInputRef}
                 id="transaction-file-upload"
                 type="file"
                 accept=".txt,.text,text/plain"
                 className="hidden"
                 onChange={handleFileUpload}
               />
               <Button
                 id="btn-upload-file"
                 type="button"
                 variant="outline"
                 className="border-amber-200 bg-white text-amber-900 hover:bg-amber-50"
                 onClick={() => fileInputRef.current?.click()}
               >
                 <Upload className="mr-1.5 h-4 w-4" />
                 Upload .txt file
               </Button>
               {uploadedFileName ? (
                 <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                   Loaded: {uploadedFileName}
                 </span>
               ) : null}
             </div>
             <p className="text-xs text-slate-400">Plain text only — not JSON</p>
           </div>


           {fileUploadError ? (
             <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
               {fileUploadError}
             </p>
           ) : null}


           <textarea
             className="min-h-36 w-full rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm leading-relaxed text-slate-700 shadow-inner shadow-slate-100/50 transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
             value={text}
             onChange={(event) => setText(event.target.value)}
             placeholder={"Uber Ride * Airport Drop\n12/11/2025 → ₹1,250.00 debited\nAvailable Balance → ₹17,170.50"}
             required
           />


           <div className="flex flex-wrap items-center gap-3">
             <Button
               id="btn-submit-extract"
               disabled={loading || activeJob?.status === "PENDING"}
               type="submit"
               className="bg-slate-900 px-6 font-medium text-white hover:bg-slate-800"
             >
               {loading ? "Submitting…" : activeJob?.status === "PENDING" ? "Processing…" : "Extract Transaction"}
             </Button>
           </div>
         </form>


         {activeJob ? (
           <div
             className={`rounded-xl border p-4 transition-all duration-300 ${
               activeJob.status === "COMPLETED"
                 ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
                 : activeJob.status === "FAILED"
                   ? "border-red-200 bg-red-50/80 text-red-800"
                   : "animate-pulse border-amber-200 bg-amber-50/80 text-amber-800"
             }`}
           >
             <div className="flex items-center gap-2">
               <span className="relative flex h-2 w-2">
                 <span
                   className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                     activeJob.status === "COMPLETED"
                       ? "bg-emerald-400"
                       : activeJob.status === "FAILED"
                         ? "bg-red-400"
                         : "bg-amber-400"
                   }`}
                 />
                 <span
                   className={`relative inline-flex h-2 w-2 rounded-full ${
                     activeJob.status === "COMPLETED"
                       ? "bg-emerald-500"
                       : activeJob.status === "FAILED"
                         ? "bg-red-500"
                         : "bg-amber-500"
                   }`}
                 />
               </span>
               <span className="text-sm font-semibold uppercase tracking-wider">
                 {activeJob.status === "COMPLETED"
                   ? "Extraction Successful"
                   : activeJob.status === "FAILED"
                     ? "Extraction Failed"
                     : `Processing: ${activeJob.status}`}
               </span>
             </div>
             <p className="mt-1.5 text-xs leading-relaxed opacity-80">
               {activeJob.status === "COMPLETED" &&
                 "Transaction parsed and added to your ledger above."}
               {activeJob.status === "FAILED" &&
                 (activeJob.error || "Unable to parse this transaction format.")}
               {(activeJob.status === "PENDING" || activeJob.status === "PROCESSING") &&
                 "Parsing date, amount, currency, and confidence…"}
             </p>
           </div>
         ) : null}
       </CardContent>
     </Card>
   </div>
 );
}