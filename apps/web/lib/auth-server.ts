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