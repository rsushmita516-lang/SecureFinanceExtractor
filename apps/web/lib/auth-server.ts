import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";
import { headers } from "next/headers";


const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";


const serverAuthClient = createAuthClient({
 baseURL: appUrl,
 fetchOptions: {
   credentials: "include"
 },
 plugins: [organizationClient()]
});


export async function getServerSession() {
 const { data } = await serverAuthClient.getSession({
   fetchOptions: {
     headers: await headers()
   }
 });


 return data;
}


export async function getActiveOrganizationId() {
 const session = await getServerSession();
 return session?.session?.activeOrganizationId ?? null;
}


export async function ensureServerOrganization() {
 const session = await getServerSession();
 if (!session?.user) {
   return null;
 }


 if (session.session.activeOrganizationId) {
   return session.session.activeOrganizationId;
 }


 const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";
 const incomingHeaders = await headers();
 const cookie = incomingHeaders.get("cookie");


 const response = await fetch(`${apiBaseUrl}/api/auth/ensure-organization`, {
   method: "POST",
   headers: cookie ? { cookie } : {},
   cache: "no-store"
 });


 if (!response.ok) {
   return null;
 }


 const payload = (await response.json().catch(() => ({}))) as {
   organization?: { id: string };
 };


 return payload.organization?.id ?? null;
}
