import { authClient } from "@/lib/auth-client";
import { resolveOrganizationIdentity } from "@vessify/domain";


export async function ensureActiveOrganization(email?: string) {
 const { data: session } = await authClient.getSession();
 const resolvedEmail = email ?? session?.user?.email;
 const userId = session?.user?.id;


 if (resolvedEmail && userId) {
   const identity = resolveOrganizationIdentity(
     resolvedEmail,
     userId,
     session?.user?.name ?? undefined
   );
   const { data: organizations } = await authClient.organization.list();
   const matchedOrganization = organizations?.find((org) => org.slug === identity.slug);


   if (matchedOrganization?.id) {
     await authClient.organization.setActive({ organizationId: matchedOrganization.id });
     return matchedOrganization.id;
   }
 }


 if (session?.session?.activeOrganizationId) {
   return session.session.activeOrganizationId;
 }


 const { data: organizations } = await authClient.organization.list();


 if (organizations?.length) {
   const organizationId = organizations[0]?.id;
   if (organizationId) {
     await authClient.organization.setActive({ organizationId });
     return organizationId;
   }
 }


 const response = await fetch("/api/auth/ensure-organization", {
   method: "POST",
   credentials: "include"
 });


 if (response.ok) {
   const payload = (await response.json().catch(() => ({}))) as {
     organization?: { id: string };
   };


   if (payload.organization?.id) {
     await authClient.organization.setActive({ organizationId: payload.organization.id });
     return payload.organization.id;
   }
 }


 return null;
}


export async function registerWithOrganization(input: {
 name: string;
 email: string;
 password: string;
}) {
 const response = await fetch("/api/auth/register", {
   method: "POST",
   headers: {
     "Content-Type": "application/json"
   },
   credentials: "include",
   body: JSON.stringify(input)
 });


 const payload = (await response.json().catch(() => ({}))) as {
   error?: string;
   message?: string;
 };


 if (!response.ok) {
   return {
     error: payload.error ?? payload.message ?? "Unable to create account"
   };
 }


 await ensureActiveOrganization(input.email);


 return { error: null };
}





