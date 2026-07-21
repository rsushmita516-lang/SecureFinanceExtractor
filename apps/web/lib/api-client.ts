import { headers } from "next/headers";
import {
 ensureServerOrganization,
 getActiveOrganizationId,
 getServerSession
} from "@/lib/auth-server";


const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";


export async function apiFetch(path: string, init?: RequestInit) {
 const incomingHeaders = await headers();
 const cookie = incomingHeaders.get("cookie");
 const session = await getServerSession();
 let organizationId = await getActiveOrganizationId();
 if (!organizationId) {
   organizationId = await ensureServerOrganization();
 }
 const bearerToken = session?.session?.token;


 const fetchHeaders = new Headers(init?.headers);
 fetchHeaders.set("Content-Type", "application/json");


 if (cookie) {
   fetchHeaders.set("cookie", cookie);
 }


 if (bearerToken) {
   fetchHeaders.set("Authorization", `Bearer ${bearerToken}`);
 }


 if (organizationId) {
   fetchHeaders.set("x-organization-id", organizationId);
 }


 return fetch(`${apiBaseUrl}${path}`, {
   ...init,
   headers: fetchHeaders,
   cache: "no-store"
 });
}
