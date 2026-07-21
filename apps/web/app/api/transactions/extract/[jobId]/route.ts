import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-client";
import { readJsonResponse } from "@/lib/read-json-response";
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
 const payload = await readJsonResponse(response);
 return NextResponse.json(payload, { status: response.status });
}
