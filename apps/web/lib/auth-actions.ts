import { authClient } from "@/lib/auth-client";


export async function ensureActiveOrganization() {
 const { data: session } = await authClient.getSession();


 if (session?.session?.activeOrganizationId) {
   return session.session.activeOrganizationId;
 }


 const { data: organizations } = await authClient.organization.list();


 if (!organizations?.length) {
   return null;
 }


 const organizationId = organizations[0]?.id;
 if (!organizationId) {
   return null;
 }


 await authClient.organization.setActive({ organizationId });
 return organizationId;
}


export async function registerWithOrganization(input: {
 name: string;
 email: string;
 password: string;
}) {
 const signUpResult = await authClient.signUp.email({
   name: input.name,
   email: input.email,
   password: input.password
 });


 if (signUpResult.error) {
   return { error: signUpResult.error.message ?? "Unable to create account" };
 }


 const userId = signUpResult.data?.user?.id;
 if (!userId) {
   return { error: "Account created but user id was missing" };
 }


 const organizationResult = await authClient.organization.create({
   name: `${input.name} Workspace`,
   slug: `${userId.slice(0, 12)}-workspace`
 });


 if (organizationResult.error) {
   return { error: organizationResult.error.message ?? "Unable to create workspace" };
 }


 const organizationId =
   organizationResult.data?.id ??
   (organizationResult.data as { organization?: { id?: string } } | null)?.organization?.id;


 if (organizationId) {
   await authClient.organization.setActive({ organizationId });
 }


 return { error: null };
}