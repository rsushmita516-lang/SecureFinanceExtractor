import { prisma } from "@vessify/db";
import type { AuthSession } from "@vessify/auth";

export type TenantContext = {
  userId: string;
  organizationId: string;
  teamId: string | null;
};

export async function resolveTenantContext(
  session: AuthSession,
  organizationIdFromHeader: string | null
): Promise<TenantContext> {
  const organizationId =
    session.session.activeOrganizationId ??
    organizationIdFromHeader;

  if (!organizationId) {
    throw new Error("No active organization selected");
  }

  const membership = await prisma.member.findFirst({
    where: {
      organizationId,
      userId: session.user.id
    },
    select: {
      organizationId: true
    }
  });

  if (!membership) {
    throw new Error("User is not a member of the requested organization");
  }

  return {
    userId: session.user.id,
    organizationId,
    teamId: session.session.activeTeamId ?? null
  };
}
