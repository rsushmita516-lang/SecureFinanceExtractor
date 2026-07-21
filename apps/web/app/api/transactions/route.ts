import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const query = url.searchParams.toString();

  const response = await fetch(`${apiBaseUrl}/api/transactions${query ? `?${query}` : ""}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "x-organization-id": session.organizationId ?? ""
    },
    cache: "no-store"
  });

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
