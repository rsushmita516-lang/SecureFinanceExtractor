"use client";


import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { registerWithOrganization } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export default function RegisterPage() {
 const router = useRouter();
 const [name, setName] = useState("");
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(false);


 async function onSubmit(event: FormEvent) {
   event.preventDefault();
   setLoading(true);
   setError(null);


   const result = await registerWithOrganization({ name, email, password });


   setLoading(false);


   if (result.error) {
     setError(result.error);
     return;
   }


   router.push("/");
   router.refresh();
 }


 return (
   <main className="min-h-screen bg-gradient-to-br from-cyan-100 via-sky-50 to-lime-100 px-4 py-12">
     <div className="mx-auto max-w-md">
       <Card>
         <CardHeader>
           <CardTitle>Create Account</CardTitle>
           <CardDescription>Register and get your default organization automatically.</CardDescription>
         </CardHeader>
         <CardContent>
           <form className="space-y-4" onSubmit={onSubmit}>
             <div className="space-y-2">
               <Label htmlFor="name">Name</Label>
               <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
             </div>
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
                 minLength={8}
               />
             </div>
             {error ? <p className="text-sm text-red-600">{error}</p> : null}
             <Button type="submit" className="w-full" disabled={loading}>
               {loading ? "Creating..." : "Register"}
             </Button>
             <p className="text-sm text-slate-500">
               Already registered? <a href="/login" className="font-medium text-slate-900 underline">Sign in</a>
             </p>
           </form>
         </CardContent>
       </Card>
     </div>
   </main>
 );
}
