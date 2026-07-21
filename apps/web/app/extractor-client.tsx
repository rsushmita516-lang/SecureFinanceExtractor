"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Search, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  ArrowUpDown, 
  CornerDownRight, 
  Info,
  LogOut,
  SlidersHorizontal
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
  rawText?: string;
};

type Props = {
  initialTransactions: Transaction[];
};

function formatErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || fallback;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; error?: unknown; name?: unknown };
    if (typeof value.message === "string" && value.message.trim()) return value.message;
    if (typeof value.error === "string" && value.error.trim()) return value.error;
    if (typeof value.name === "string" && typeof value.message === "string") {
      return `${value.name}: ${value.message}`;
    }
  }
  return fallback;
}

const SAMPLE_TEMPLATES = [
  {
    name: "Starbucks Coffee SMS",
    category: "Food & Beverage",
    text: `Date: 11 Dec 2025\nDescription: STARBUCKS COFFEE MUMBAI\nAmount: -420.00\nBalance after transaction: 18,420.50`
  },
  {
    name: "Airport Uber Ride",
    category: "Transport",
    text: `Uber Ride * Airport Drop\n12/11/2025 → ₹1,250.00 debited\nAvailable Balance → ₹17,170.50`
  },
  {
    name: "Amazon Order Dr",
    category: "Shopping",
    text: `txn123 2025-12-10 Amazon.in Order #403-1234567-8901234 ₹2,999.00 Dr Bal 14171.50 Shopping`
  }
];

export function ExtractorClient({ initialTransactions }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(Array.isArray(initialTransactions) ? initialTransactions : []);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [activeJob, setActiveJob] = useState<{ id: string; status: string; error?: string | null } | null>(null);

  // New Interactive Frontend States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "confidence-desc">("date-desc");
  const [inspectedTransactionId, setInspectedTransactionId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showNotification, setShowNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss notifications
  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => setShowNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  // Load correct initial page on mount
  useEffect(() => {
    void fetchPage(null, true);
  }, []);

  async function fetchPage(cursor: string | null, replace: boolean = false) {
    const url = `/api/transactions?limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return;

    const payload = await response.json();
    if (replace) {
      setTransactions(Array.isArray(payload.items) ? payload.items : []);
    } else {
      setTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const nextItems = Array.isArray(payload.items) ? payload.items : [];
        const filteredNew = nextItems.filter((t: Transaction) => !existingIds.has(t.id));
        return [...prev, ...filteredNew];
      });
    }
    setNextCursor(payload.pageInfo?.nextCursor ?? null);
    setHasNextPage(payload.pageInfo?.hasNextPage ?? false);
  }

  // Poll job status until complete/fail
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
          setShowNotification({ type: "success", message: "Transaction extracted and verified successfully!" });
          clearInterval(interval);
          void fetchPage(null, true); // Refresh list to get new record
        } else if (job.status === "FAILED") {
          const errorMessage = formatErrorMessage(job.error, "Format unsupported");
          setActiveJob({ id: job.id, status: "FAILED", error: errorMessage });
          setShowNotification({ type: "error", message: `Extraction failed: ${errorMessage}` });
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
        const errorMessage = formatErrorMessage(payload.error, "Failed to submit extraction job");
        setActiveJob({
          id: "failed-request",
          status: "FAILED",
          error: errorMessage
        });
        setShowNotification({ type: "error", message: errorMessage });
        return;
      }

      setActiveJob({
        id: payload.jobId,
        status: payload.status ?? "PENDING"
      });
      setText("");
    } catch {
      setActiveJob({
        id: "failed-request",
        status: "FAILED",
        error: "Network error submitting extraction"
      });
      setShowNotification({ type: "error", message: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function loadTemplate(sampleText: string) {
    setText(sampleText);
    setActiveJob(null);
    setShowNotification({ type: "success", message: "Template loaded! Press Extract to parse." });
  }

  // Handle Drag & Drop files
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type !== "text/plain" && !file.name.endsWith(".txt")) {
      setShowNotification({ type: "error", message: "Only plain text (.txt) bank statements/receipts are supported." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const fileText = e.target?.result as string;
      if (fileText.trim()) {
        setText(fileText);
        setShowNotification({ type: "success", message: `Successfully loaded file: ${file.name}` });
      } else {
        setShowNotification({ type: "error", message: "The loaded file is empty." });
      }
    };
    reader.onerror = () => {
      setShowNotification({ type: "error", message: "Error reading file." });
    };
    reader.readAsText(file);
  };

  // Calculate dynamic stats from retrieved transactions list
  const totalInflow = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflow = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const parsedValidConfidence = transactions.filter((t) => t.confidence !== null);
  const avgConfidence = parsedValidConfidence.length
    ? Math.round((parsedValidConfidence.reduce((sum, t) => sum + (t.confidence ?? 0), 0) / parsedValidConfidence.length) * 100)
    : 100;

  // Derive most current balance
  const currentBalance = transactions.length > 0 
    ? (transactions[0].balanceAfter !== null ? transactions[0].balanceAfter : transactions.reduce((sum, t) => sum + t.amount, 15000))
    : 0;

  // Process and filter transactions for display
  const categoriesList = ["All", ...Array.from(new Set(transactions.map((t) => t.category).filter((c): c is string => !!c)))];

  const processedTransactions = transactions
    .filter((item) => {
      const matchSearch = 
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        Math.abs(item.amount).toString().includes(searchQuery);
      
      const matchCategory = selectedCategory === "All" || item.category === selectedCategory;
      
      return matchSearch && matchCategory;
    })
    .sort((a, b) => {
      if (sortBy === "date-desc") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === "date-asc") return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === "amount-desc") return b.amount - a.amount;
      if (sortBy === "amount-asc") return a.amount - b.amount;
      if (sortBy === "confidence-desc") return (b.confidence ?? 0) - (a.confidence ?? 0);
      return 0;
    });

  // Calculate Trend Data for responsive SVG Chart
  // Sort oldest first to plot chronologically
  const sortedChronological = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Calculate rolling balance
  let runningBalance = currentBalance - transactions.reduce((sum, t) => sum + t.amount, 0);
  const chartPoints = sortedChronological.map((t, index) => {
    runningBalance += t.amount;
    return {
      date: new Date(t.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      balance: runningBalance,
      amount: t.amount,
      index
    };
  });

  // SVG Chart path generation helpers
  const generateSvgPaths = () => {
    if (chartPoints.length < 2) return { linePath: "", areaPath: "", coords: [], minBal: 0, maxBal: 0 };
    
    const width = 500;
    const height = 140;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 25;

    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    const balances = chartPoints.map(p => p.balance);
    const minBal = Math.min(...balances) * 0.95;
    const maxBal = Math.max(...balances) * 1.05;
    const balRange = maxBal - minBal || 100;

    const coords = chartPoints.map((p, i) => {
      const x = paddingLeft + (i / (chartPoints.length - 1)) * chartW;
      const y = paddingTop + chartH - ((p.balance - minBal) / balRange) * chartH;
      return { x, y, ...p };
    });

    let linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      // Curve smoothing
      const prev = coords[i - 1];
      const curr = coords[i];
      const cpX1 = prev.x + (curr.x - prev.x) / 3;
      const cpY1 = prev.y;
      const cpX2 = prev.x + 2 * (curr.x - prev.x) / 3;
      const cpY2 = curr.y;
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }

    const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - paddingBottom} L ${coords[0].x} ${height - paddingBottom} Z`;

    return { linePath, areaPath, coords, minBal, maxBal };
  };

  const { linePath, areaPath, coords, minBal, maxBal } = generateSvgPaths();

  return (
    <div className="space-y-6">
      {/* Toast Notification Container */}
      {showNotification && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3.5 shadow-xl border backdrop-blur transition-all duration-300 transform translate-y-0 scale-100 ${
          showNotification.type === "success" 
            ? "bg-emerald-500/90 border-emerald-400 text-white" 
            : "bg-rose-500/90 border-rose-400 text-white"
        }`}>
          {showNotification.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span className="text-sm font-medium">{showNotification.message}</span>
        </div>
      )}

      {/* Dynamic Finance Metric Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Workspace Balance Card */}
        <Card className="border-slate-200/50 shadow-sm bg-white hover:shadow-md hover:border-slate-300/60 transition duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-emerald-500/5 rounded-full -mr-6 -mt-6 transition-transform duration-300 group-hover:scale-125" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ledger Net Worth</CardDescription>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800 tracking-tight">
              ₹{currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span>Running Ledger Account</span>
            </p>
          </CardContent>
        </Card>

        {/* Total Inflow Card */}
        <Card className="border-slate-200/50 shadow-sm bg-white hover:shadow-md hover:border-slate-300/60 transition duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-emerald-500/5 rounded-full -mr-6 -mt-6 transition-transform duration-300 group-hover:scale-125" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Inflow</CardDescription>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">
              +₹{totalInflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              From {transactions.filter((t) => t.amount > 0).length} deposit entries
            </p>
          </CardContent>
        </Card>

        {/* Total Outflow Card */}
        <Card className="border-slate-200/50 shadow-sm bg-white hover:shadow-md hover:border-slate-300/60 transition duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-rose-500/5 rounded-full -mr-6 -mt-6 transition-transform duration-300 group-hover:scale-125" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Outflow</CardDescription>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 tracking-tight">
              -₹{totalOutflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Across {transactions.filter((t) => t.amount < 0).length} expense entries
            </p>
          </CardContent>
        </Card>

        {/* Engine Parsing Health */}
        <Card className="border-slate-200/50 shadow-sm bg-white hover:shadow-md hover:border-slate-300/60 transition duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-24 w-24 bg-amber-500/5 rounded-full -mr-6 -mt-6 transition-transform duration-300 group-hover:scale-125" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-400">Confidence Score</CardDescription>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Activity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight">{avgConfidence}%</div>
              <p className="text-xs text-slate-500 mt-1">Extraction precision health</p>
            </div>
            {/* Minimal SVG Donut indicator */}
            <div className="relative h-12 w-12 flex items-center justify-center">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle cx="24" cy="24" r="18" stroke="#f1f5f9" strokeWidth="3" fill="none" />
                <circle 
                  cx="24" 
                  cy="24" 
                  r="18" 
                  stroke={avgConfidence >= 80 ? "#10b981" : avgConfidence >= 60 ? "#f59e0b" : "#ef4444"} 
                  strokeWidth="3" 
                  fill="none" 
                  strokeDasharray={113}
                  strokeDashoffset={113 - (113 * avgConfidence) / 100}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <span className="absolute text-[9px] font-bold text-slate-500">{avgConfidence}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Grid: Input Terminal (Left) and Interactive Balance Chart (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Extractor Input Terminal (Left Column: 5 spans) */}
        <div className="lg:col-span-5 space-y-4">
          <Card id="extractor-input-card" className="border-slate-200 shadow-sm bg-white flex flex-col h-full justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    <span>Secure Parser Terminal</span>
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Drop statements, texts, logs or SMS templates.
                  </CardDescription>
                </div>
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Ready to parse" />
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Secure Scope</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Template quick-loader tag pills */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Load Statement Templates</label>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_TEMPLATES.map((tpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => loadTemplate(tpl.text)}
                      className="rounded-lg bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200/60 border border-slate-200/60 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-800 transition duration-150 cursor-pointer text-left flex items-center gap-1.5"
                    >
                      <FileText className="h-3 w-3 shrink-0 text-slate-400 group-hover:text-emerald-500" />
                      <span>{tpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Area & Drag and Drop Overlay */}
              <form className="space-y-3.5" onSubmit={onExtract}>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Statement Source Text</label>
                    <button 
                      type="button" 
                      onClick={() => setText("")}
                      className="text-xs font-medium text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      disabled={!text}
                    >
                      Clear
                    </button>
                  </div>
                  
                  {/* Custom Drag Drop Terminal Canvas */}
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`relative rounded-xl border-2 transition-all duration-200 group ${
                      dragActive 
                        ? "border-emerald-400 bg-emerald-50/50" 
                        : "border-slate-200 hover:border-slate-300 bg-slate-50/40"
                    }`}
                  >
                    <textarea
                      className="min-h-[148px] w-full rounded-xl border-0 p-3.5 text-xs font-mono text-slate-700 placeholder-slate-400 bg-transparent focus:ring-0 focus:outline-none transition resize-none leading-relaxed"
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="Paste text here, or drag & drop a .txt statement file. Example SMS: 'Starbucks Coffee -420.00 Bal: 18,420.50'"
                      required
                    />
                    
                    {/* Visual drag indicator */}
                    {!text && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 group-hover:text-slate-500 transition duration-150 p-4 text-center">
                        <Upload className="h-6 w-6 stroke-1.5 text-slate-300 group-hover:text-emerald-500 transition mb-1" />
                        <span className="text-xs font-medium">Drag & drop plain text file here</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">or type transaction content</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="file" 
                      id="statement-file-picker" 
                      accept=".txt" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs px-3 h-9 cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Upload .txt
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      id="btn-submit-extract" 
                      disabled={loading || activeJob?.status === "PENDING" || !text.trim()} 
                      type="submit" 
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 h-9 cursor-pointer shadow-sm rounded-lg flex items-center gap-1.5 transition duration-150"
                    >
                      {loading ? (
                        <>
                          <Clock className="h-3.5 w-3.5 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : activeJob?.status === "PENDING" ? (
                        <>
                          <Activity className="h-3.5 w-3.5 animate-spin" />
                          <span>Parsing...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          <span>Extract Ledger</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>

              {/* Queued Active Job Feedback */}
              {activeJob && (
                <div className={`mt-2 p-3.5 rounded-xl border flex flex-col gap-1.5 transition-all duration-300 ${
                  activeJob.status === "COMPLETED" 
                    ? "bg-emerald-50/70 border-emerald-200/60 text-emerald-800" 
                    : activeJob.status === "FAILED"
                      ? "bg-rose-50/70 border-rose-200/60 text-rose-800"
                      : "bg-amber-50/70 border-amber-200/60 text-amber-800 animate-pulse"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          activeJob.status === "COMPLETED" ? "bg-emerald-400" : activeJob.status === "FAILED" ? "bg-rose-400" : "bg-amber-400"
                        }`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                          activeJob.status === "COMPLETED" ? "bg-emerald-500" : activeJob.status === "FAILED" ? "bg-rose-500" : "bg-amber-500"
                        }`}></span>
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {activeJob.status === "COMPLETED" 
                          ? "Extraction Finalized" 
                          : activeJob.status === "FAILED" 
                            ? "Parsing Failed" 
                            : `Ingestion Queue: ${activeJob.status}`}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono opacity-60">ID: {activeJob.id.slice(0, 8)}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    {activeJob.status === "COMPLETED" && "The transaction is fully validated, matching row-level privacy structures, and committed below."}
                    {activeJob.status === "FAILED" && (activeJob.error || "Regex engine missed valid transaction parameters.")}
                    {(activeJob.status === "PENDING" || activeJob.status === "PROCESSING") && "Our micro-parser is validating the currency symbol, dates, calculating balances and confidence ratios..."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Ledger Trend Area Graph & Spending Mix (Right Column: 7 spans) */}
        <div className="lg:col-span-7">
          <Card className="border-slate-200 shadow-sm bg-white h-full flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-slate-700" />
                    <span>Dynamic Balance Progression</span>
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Real-time balance plotting derived dynamically from your workspace.
                  </CardDescription>
                </div>
                <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-full text-slate-600 font-semibold">
                  {chartPoints.length} Nodes Plotted
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* SVG Area Chart */}
              <div className="w-full bg-slate-50/50 rounded-xl border border-slate-100 p-2 relative">
                {coords.length >= 2 ? (
                  <svg viewBox="0 0 500 140" className="w-full h-auto overflow-visible select-none">
                    <defs>
                      <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                      </linearGradient>
                      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#047857" floodOpacity="0.15" />
                      </filter>
                    </defs>

                    {/* Horizontal Grid lines */}
                    <line x1="45" y1="15" x2="485" y2="15" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="45" y1="65" x2="485" y2="65" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="45" y1="115" x2="485" y2="115" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />

                    {/* Axis Y Values */}
                    <text x="38" y="19" className="text-[8px] font-mono text-slate-400 text-right font-semibold" textAnchor="end">
                      ₹{Math.round(maxBal).toLocaleString()}
                    </text>
                    <text x="38" y="69" className="text-[8px] font-mono text-slate-400 text-right font-semibold" textAnchor="end">
                      ₹{Math.round((maxBal + minBal) / 2).toLocaleString()}
                    </text>
                    <text x="38" y="119" className="text-[8px] font-mono text-slate-400 text-right font-semibold" textAnchor="end">
                      ₹{Math.round(minBal).toLocaleString()}
                    </text>

                    {/* Filled Gradient Area */}
                    <path d={areaPath} fill="url(#chart-grad)" />

                    {/* Bold Line Path */}
                    <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" filter="url(#shadow)" />

                    {/* Dynamic Interactive Node Circles */}
                    {coords.map((point, index) => {
                      const isLastNode = index === coords.length - 1;
                      return (
                        <g key={index} className="group/node cursor-pointer">
                          <circle 
                            cx={point.x} 
                            cy={point.y} 
                            r={isLastNode ? "4.5" : "3.5"} 
                            fill={isLastNode ? "#10b981" : "#ffffff"} 
                            stroke="#10b981" 
                            strokeWidth="2" 
                          />
                          {/* Tooltip on hover */}
                          <title>
                            {point.date}: ₹{point.balance.toLocaleString()} ({point.amount >= 0 ? "+" : "-"}₹{Math.abs(point.amount).toLocaleString()})
                          </title>
                        </g>
                      );
                    })}

                    {/* Timeline labels at the bottom */}
                    {coords.filter((_, i) => i === 0 || i === Math.floor(coords.length / 2) || i === coords.length - 1).map((point, i) => (
                      <text 
                        key={i} 
                        x={point.x} 
                        y="134" 
                        className="text-[9px] font-semibold text-slate-400 text-center"
                        textAnchor="middle"
                      >
                        {point.date}
                      </text>
                    ))}
                  </svg>
                ) : (
                  <div className="h-[124px] flex flex-col items-center justify-center text-slate-400 gap-1.5">
                    <Activity className="h-6 w-6 stroke-1.5 text-slate-300 animate-pulse" />
                    <span className="text-xs">Provide at least 2 transactions to map ledger timeline.</span>
                  </div>
                )}
              </div>

              {/* Dynamic Category Spending distribution gauge metrics */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Outflow Mix by Category</span>
                  <span className="text-[10px] font-semibold text-slate-500">Debited Amounts Included</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {["Food & Beverage", "Transport", "Shopping", "General"].map((cat) => {
                    const catTransactions = transactions.filter((t) => t.category === cat && t.amount < 0 || (cat === "General" && !t.category && t.amount < 0));
                    const totalCatDebit = catTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                    const percent = totalOutflow > 0 ? Math.round((totalCatDebit / totalOutflow) * 100) : 0;
                    
                    let progressColor = "bg-slate-400";
                    let textColor = "text-slate-600";
                    if (cat === "Food & Beverage") { progressColor = "bg-amber-400"; textColor = "text-amber-700"; }
                    if (cat === "Transport") { progressColor = "bg-blue-400"; textColor = "text-blue-700"; }
                    if (cat === "Shopping") { progressColor = "bg-indigo-400"; textColor = "text-indigo-700"; }

                    return (
                      <div key={cat} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-600 truncate">{cat}</span>
                          <span className={`text-[10px] font-bold ${textColor}`}>{percent}%</span>
                        </div>
                        <div className="mt-2 text-xs font-bold text-slate-800">
                          ₹{totalCatDebit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className="w-full bg-slate-200/60 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full ${progressColor} rounded-full`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ledger Table Container (Bottom Section) */}
      <Card id="transactions-list-card" className="border-slate-200 shadow-sm bg-white overflow-hidden">
        
        {/* Dynamic header with filters and search inputs */}
        <div className="border-b border-slate-100 px-5 py-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                <span>Audited Ledger Database</span>
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-0.5">
                All records isolated under cryptographic security filters.
              </CardDescription>
            </div>

            {/* Quick Search */}
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description, amount..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-500 transition placeholder-slate-400"
              />
            </div>
          </div>

          {/* Filtering and sorting controller bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            
            {/* Category tabs pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="h-3 w-3" />
                <span>Filter:</span>
              </span>
              {categoriesList.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      isActive 
                        ? "bg-slate-900 text-white shadow-sm" 
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/55"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Sorting trigger */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" />
                <span>Sort by:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "confidence-desc")}
                className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              >
                <option value="date-desc">Newest Date</option>
                <option value="date-asc">Oldest Date</option>
                <option value="amount-desc">Amount: High-Low</option>
                <option value="amount-asc">Amount: Low-High</option>
                <option value="confidence-desc">Model Confidence</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ledger Table rendering */}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  <th className="px-6 py-3.5">Transaction Date</th>
                  <th className="px-6 py-3.5">Category Class</th>
                  <th className="px-6 py-3.5">Verified Description</th>
                  <th className="px-6 py-3.5 text-right">Transaction Amount</th>
                  <th className="px-6 py-3.5 text-right">Computed Balance</th>
                  <th className="px-6 py-3.5 text-center">Engine Confidence</th>
                  <th className="px-6 py-3.5 text-right">Inspector</th>
                </tr>
              </thead>
              <tbody>
                {processedTransactions.map((item) => {
                  const isDebit = item.amount < 0;
                  const confidencePercent = item.confidence ? Math.round(item.confidence * 100) : null;
                  const isInspected = inspectedTransactionId === item.id;

                  return (
                    <>
                      {/* Standard row */}
                      <tr 
                        key={item.id} 
                        onClick={() => setInspectedTransactionId(isInspected ? null : item.id)}
                        className={`border-b border-slate-100/70 hover:bg-slate-50/70 transition cursor-pointer ${
                          isInspected ? "bg-slate-50/90 font-medium" : ""
                        }`}
                      >
                        <td className="px-6 py-4 text-slate-600 font-semibold">
                          {new Date(item.date).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric"
                          })}
                        </td>
                        <td className="px-6 py-4">
                          {item.category ? (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold ${
                              item.category === "Food & Beverage" 
                                ? "bg-amber-50 text-amber-800 border border-amber-200/50" 
                                : item.category === "Transport"
                                  ? "bg-blue-50 text-blue-800 border border-blue-200/50"
                                  : item.category === "Shopping"
                                    ? "bg-indigo-50 text-indigo-800 border border-indigo-200/50"
                                    : "bg-slate-50 text-slate-800 border border-slate-200/50"
                            }`}>
                              {item.category}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium italic">General</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-800 font-bold max-w-xs truncate">
                          {item.description}
                        </td>
                        <td className={`px-6 py-4 text-right font-extrabold text-[13px] ${isDebit ? "text-rose-600" : "text-emerald-600"}`}>
                          {isDebit ? "-" : "+"}
                          ₹{Math.abs(item.amount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-600">
                          {item.balanceAfter !== null ? (
                            <span>
                              ₹{item.balanceAfter.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            {confidencePercent !== null ? (
                              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-full font-bold shadow-sm">
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  confidencePercent >= 80 
                                    ? "bg-emerald-500" 
                                    : confidencePercent >= 60
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                }`}></span>
                                <span className="text-slate-600">{confidencePercent}%</span>
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            type="button"
                            className="p-1 rounded hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 transition"
                          >
                            {isInspected ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Raw Ingestion text Inspection box */}
                      {isInspected && (
                        <tr key={`${item.id}-details`} className="bg-slate-50/50 border-b border-slate-100">
                          <td colSpan={7} className="px-8 py-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-inner space-y-3.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                                <div className="flex items-center gap-2 text-slate-700 font-bold">
                                  <Info className="h-4 w-4 text-emerald-600" />
                                  <span>Secure Extractor Trace Audit Log</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase font-bold text-slate-400">Transaction ID:</span>
                                  <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{item.id}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Raw Paste Material (Input Segment)</span>
                                  <pre className="text-[11px] font-mono p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-36">
                                    {item.rawText || `Description: ${item.description}\nAmount: ${item.amount}\nDate: ${item.date}`}
                                  </pre>
                                </div>
                                <div className="space-y-1.5 flex flex-col justify-between">
                                  <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Ingestion Breakdown Parameters</span>
                                    <div className="grid grid-cols-2 gap-2 mt-1.5 text-[11px]">
                                      <div className="bg-slate-50 p-2 rounded border border-slate-100 flex justify-between">
                                        <span className="text-slate-400">Date Segment:</span>
                                        <span className="font-semibold text-slate-700">{new Date(item.date).toLocaleDateString()}</span>
                                      </div>
                                      <div className="bg-slate-50 p-2 rounded border border-slate-100 flex justify-between">
                                        <span className="text-slate-400">Amount Sign:</span>
                                        <span className={`font-semibold ${item.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                          {item.amount < 0 ? "Expense (Debit)" : "Deposit (Credit)"}
                                        </span>
                                      </div>
                                      <div className="bg-slate-50 p-2 rounded border border-slate-100 flex justify-between">
                                        <span className="text-slate-400">Currency Scope:</span>
                                        <span className="font-semibold text-slate-700">{item.currency}</span>
                                      </div>
                                      <div className="bg-slate-50 p-2 rounded border border-slate-100 flex justify-between">
                                        <span className="text-slate-400">Category Tag:</span>
                                        <span className="font-semibold text-slate-700">{item.category || "Unassigned"}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/50 p-2 rounded-lg text-[10px] font-semibold mt-2 md:mt-0">
                                    <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                    <span>Verified and secured in your organization tenant with cryptographic data isolation.</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}

                {!processedTransactions.length ? (
                  <tr>
                    <td className="px-6 py-12 text-center text-slate-400" colSpan={7}>
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <AlertCircle className="h-5 w-5 stroke-1.5 text-slate-300" />
                        <span className="text-xs font-medium">No transactions match your search filter criteria.</span>
                        <span className="text-[10px] text-slate-400">Try modifying search tags or selected category filters.</span>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Paginated Older Transactions load-trigger */}
          {hasNextPage && (
            <div className="border-t border-slate-100 p-4 text-center">
              <Button
                id="btn-load-more"
                type="button"
                variant="outline"
                className="text-slate-600 hover:text-slate-800 border-slate-200 hover:bg-slate-50/70 font-semibold px-8 cursor-pointer shadow-sm text-xs"
                onClick={() => nextCursor && fetchPage(nextCursor, false)}
              >
                Load Older Records
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
