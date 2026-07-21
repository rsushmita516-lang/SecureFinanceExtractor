import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth-options";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: authOptions.secret });
  const bearerToken = token?.accessToken ?? token?.authJwt;
  const organizationId = token?.organizationId ?? "";

  if (!bearerToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const response = await fetch(`${apiBaseUrl}/api/transactions/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
      "x-organization-id": organizationId
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
