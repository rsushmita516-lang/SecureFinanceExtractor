jest.mock("@vessify/db", () => ({
  prisma: {
    member: {
      findFirst: jest.fn()
    }
  }
}));

import { prisma } from "@vessify/db";
import { resolveTenantContext } from "../apps/api/src/tenant";

describe("tenant isolation", () => {
  const session = {
    user: { id: "user_1" },
    session: { activeOrganizationId: null, activeTeamId: null }
  } as any;

  it("returns tenant context when membership exists", async () => {
    (prisma.member.findFirst as jest.Mock).mockResolvedValueOnce({
      organizationId: "org_1"
    });

    const context = await resolveTenantContext(session, "org_1");

    expect(context.organizationId).toBe("org_1");
    expect(context.userId).toBe("user_1");
  });

  it("rejects cross-tenant access when membership is absent", async () => {
    (prisma.member.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(resolveTenantContext(session, "org_2")).rejects.toThrow(
      "User is not a member of the requested organization"
    );
  });
});
