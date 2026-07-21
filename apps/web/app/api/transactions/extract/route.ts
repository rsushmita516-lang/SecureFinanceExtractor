import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-client";
import { getServerSession } from "@/lib/auth-server";


export async function POST(req: Request) {
 const session = await getServerSession();
 if (!session?.user) {
   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 }


 const body = await req.json();


 const response = await apiFetch("/api/transactions/extract", {
   method: "POST",
   body: JSON.stringify(body)
 });


 const payload = await response.json();
 return NextResponse.json(payload, { status: response.status });
}
