"use client";


import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ensureActiveOrganization } from "@/lib/auth-actions";
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


   const result = await authClient.signIn.email({
     email,
     password
   });


   if (result.error) {
     setLoading(false);
     setError(result.error.message ?? "Invalid credentials");
     return;
   }


   await ensureActiveOrganization();


   setLoading(false);
   router.push("/");
   router.refresh();
 }


 return (
   <main className="min-h-screen bg-gradient-to-br from-amber-100 via-orange-50 to-cyan-100 px-4 py-12">
     <div className="mx-auto max-w-md">
       <Card>
         <CardHeader>
           <CardTitle>Sign In</CardTitle>
           <CardDescription>Access your tenant-isolated transaction workspace.</CardDescription>
         </CardHeader>
         <CardContent>
           <form className="space-y-4" onSubmit={onSubmit}>
             <div className="space-y-2">
               <Label htmlFor="email">Email</Label>
               <Input
                 id="email"
                 type="email"
                 value={email}
                 onChange={(event) => setEmail(event.target.value)}
                 required
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="password">Password</Label>
               <Input
                 id="password"
                 type="password"
                 value={password}
                 onChange={(event) => setPassword(event.target.value)}
                 required
               />
             </div>
             {error ? <p className="text-sm text-red-600">{error}</p> : null}
             <Button type="submit" className="w-full" disabled={loading}>
               {loading ? "Signing In..." : "Sign In"}
             </Button>
             <p className="text-sm text-slate-500">
               No account? <a href="/register" className="font-medium text-slate-900 underline">Register</a>
             </p>
           </form>
         </CardContent>
       </Card>
     </div>
   </main>
 );
}
