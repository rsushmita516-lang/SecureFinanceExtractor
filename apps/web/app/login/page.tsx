"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Landmark, ShieldCheck, Mail, Lock, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid login credentials. Please try again.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 relative overflow-hidden selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-70 pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Brand header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md ring-1 ring-slate-950/5">
            <Landmark className="h-5 w-5 text-emerald-400 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-1.5">
              <span>Vessify Secure Portal</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase text-slate-500">v1.2</span>
            </h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Secure Transaction Extraction Workspace</p>
          </div>
        </div>

        {/* Core login card */}
        <Card className="border-slate-200/60 shadow-xl bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />
          
          <CardHeader className="space-y-1.5 pb-5">
            <CardTitle className="text-xl font-bold text-slate-800 text-center">Sign In</CardTitle>
            <CardDescription className="text-slate-400 text-xs text-center font-medium">
              Access your highly isolated organization workspace and ledger safely.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Corporate Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@organization.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:bg-white text-xs font-semibold focus:ring-emerald-400/50 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Access Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:bg-white text-xs font-semibold focus:ring-emerald-400/50 rounded-xl"
                    required
                  />
                </div>
              </div>

              {error ? (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              ) : null}

              <Button type="submit" className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer" disabled={loading}>
                {loading ? "Decrypting Session..." : "Sign In & Decrypt"}
                {!loading && <ArrowRight className="h-3.5 w-3.5" />}
              </Button>

              <div className="pt-3 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400 font-medium">
                  New operator?{" "}
                  <a href="/register" className="font-bold text-slate-800 hover:text-emerald-600 underline underline-offset-4 transition">
                    Create isolated space
                  </a>
                </p>
              </div>

            </form>
          </CardContent>
        </Card>

        {/* Security assurance banner */}
        <div className="flex items-center justify-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Multi-Tenant Cryptographic Isolation Active</span>
        </div>

      </div>
    </main>
  );
}
