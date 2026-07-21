import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-client";
import { getServerSession } from "@/lib/auth-server";


export async function GET(
 req: Request,
 { params }: { params: Promise<{ jobId: string }> }
) {
 const session = await getServerSession();
 if (!session?.user) {
   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 }


 const { jobId } = await params;


 const response = await apiFetch(`/api/transactions/extract/${jobId}`);


 if (!response.ok) {
   return NextResponse.json({ error: "Job check failed" }, { status: response.status });
 }


 const payload = await response.json();
 return NextResponse.json(payload, { status: 200 });
}
