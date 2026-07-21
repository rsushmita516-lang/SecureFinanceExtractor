import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";

export async function apiFetch(path: string, init?: RequestInit) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  const organizationId = session?.organizationId;

  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (organizationId) {
    headers.set("x-organization-id", organizationId);
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });
}
