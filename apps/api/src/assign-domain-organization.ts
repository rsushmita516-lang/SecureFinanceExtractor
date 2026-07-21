import { auth } from "@vessify/auth";
import { prisma } from "@vessify/db";
import { resolveOrganizationIdentity } from "@vessify/domain";


type AssignDomainOrganizationResult = {
 organizationId: string;
 slug: string;
 name: string;
 domain: string;
 joinedExisting: boolean;
 sharedByDomain: boolean;
};


async function ensureMembership(
 userId: string,
 organizationId: string,
 role: "owner" | "member"
): Promise<void> {
 const existing = await prisma.member.findFirst({
   where: { userId, organizationId }
 });


 if (!existing) {
   await prisma.member.create({
     data: { userId, organizationId, role }
   });
 }
}


async function ensureOrganizationRecord(
 userId: string,
 slug: string,
 name: string
): Promise<{ organizationId: string; created: boolean }> {
 let organization = await prisma.organization.findUnique({ where: { slug } });
 const created = !organization;


 if (!organization) {
   organization = await prisma.organization.create({
     data: { slug, name }
   });
 }


 await ensureMembership(userId, organization.id, created ? "owner" : "member");


 return { organizationId: organization.id, created };
}


async function activateOrganizationForUser(
 userId: string,
 organizationId: string,
 requestHeaders?: Headers
): Promise<void> {
 if (requestHeaders) {
   try {
     const session = await auth.api.getSession({ headers: requestHeaders });
     if (session?.session?.id) {
       await prisma.session.update({
         where: { id: session.session.id },
         data: { activeOrganizationId: organizationId }
       });
       return;
     }
   } catch {
     // Fall back to updating the latest session for this user.
   }
 }


 const latestSession = await prisma.session.findFirst({
   where: { userId },
   orderBy: { createdAt: "desc" }
 });


 if (latestSession) {
   await prisma.session.update({
     where: { id: latestSession.id },
     data: { activeOrganizationId: organizationId }
   });
 }
}


async function joinOrganization(
 userId: string,
 organizationId: string,
 requestHeaders: Headers | undefined,
 meta: Omit<AssignDomainOrganizationResult, "organizationId" | "joinedExisting">
): Promise<AssignDomainOrganizationResult> {
 await ensureMembership(userId, organizationId, "member");
 await activateOrganizationForUser(userId, organizationId, requestHeaders);


 return {
   organizationId,
   joinedExisting: true,
   ...meta
 };
}


async function createOrganizationForUser(
 userId: string,
 slug: string,
 name: string,
 requestHeaders: Headers | undefined,
 meta: Omit<AssignDomainOrganizationResult, "organizationId" | "joinedExisting">
): Promise<AssignDomainOrganizationResult> {
 const { organizationId, created } = await ensureOrganizationRecord(userId, slug, name);
 await activateOrganizationForUser(userId, organizationId, requestHeaders);


 return {
   organizationId,
   joinedExisting: !created,
   ...meta
 };
}


export async function assignUserToDomainOrganization(
 userId: string,
 email: string,
 requestHeaders?: Headers,
 displayName?: string
): Promise<AssignDomainOrganizationResult> {
 const identity = resolveOrganizationIdentity(email, userId, displayName);
 const meta = {
   slug: identity.slug,
   name: identity.name,
   domain: identity.domain,
   sharedByDomain: identity.sharedByDomain
 };


 if (!identity.sharedByDomain) {
   return createOrganizationForUser(userId, identity.slug, identity.name, requestHeaders, meta);
 }


 const existing = await prisma.organization.findUnique({
   where: { slug: identity.slug }
 });


 if (existing) {
   return joinOrganization(userId, existing.id, requestHeaders, meta);
 }


 return createOrganizationForUser(userId, identity.slug, identity.name, requestHeaders, meta);
}


export async function ensureUserHasOrganization(
 userId: string,
 email: string,
 requestHeaders?: Headers,
 displayName?: string
): Promise<AssignDomainOrganizationResult> {
 const existingMembership = await prisma.member.findFirst({
   where: { userId },
   select: { organizationId: true }
 });


 if (existingMembership) {
   await activateOrganizationForUser(
     userId,
     existingMembership.organizationId,
     requestHeaders
   );


   const organization = await prisma.organization.findUnique({
     where: { id: existingMembership.organizationId }
   });


   if (!organization) {
     return assignUserToDomainOrganization(userId, email, requestHeaders, displayName);
   }


   const identity = resolveOrganizationIdentity(email, userId, displayName);


   return {
     organizationId: organization.id,
     slug: organization.slug,
     name: organization.name,
     domain: identity.domain,
     joinedExisting: true,
     sharedByDomain: identity.sharedByDomain
   };
 }


 return assignUserToDomainOrganization(userId, email, requestHeaders, displayName);
}
