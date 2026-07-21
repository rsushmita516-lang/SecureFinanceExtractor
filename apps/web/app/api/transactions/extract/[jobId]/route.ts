import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;

  const response = await fetch(`${apiBaseUrl}/api/transactions/extract/${jobId}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "x-organization-id": session.organizationId ?? ""
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Job check failed" }, { status: response.status });
  }

  const payload = await response.json();
  return NextResponse.json(payload, { status: 200 });
}
