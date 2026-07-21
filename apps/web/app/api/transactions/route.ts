import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-client";
import { getServerSession } from "@/lib/auth-server";


export async function GET(req: Request) {
 const session = await getServerSession();
 if (!session?.user) {
   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 }


 const url = new URL(req.url);
 const query = url.searchParams.toString();


 const response = await apiFetch(`/api/transactions${query ? `?${query}` : ""}`);
 const payload = await response.json();
 return NextResponse.json(payload, { status: response.status });
}
