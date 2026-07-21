import { prisma } from "@vessify/db";
import { extractTransactionFromText } from "@vessify/domain";
import type { TenantContext } from "./tenant";

export async function processExtractionJob(jobId: string, text: string, tenant: TenantContext) {
  try {
    const parsed = extractTransactionFromText(text);

    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          organizationId: tenant.organizationId,
          userId: tenant.userId,
          teamId: tenant.teamId,
          extractionJobId: jobId,
          date: parsed.date,
          description: parsed.description,
          amount: parsed.amount,
          currency: parsed.currency,
          balanceAfter: parsed.balanceAfter,
          confidence: parsed.confidence,
          category: parsed.category,
          rawText: parsed.rawText
        }
      }),
      prisma.extractionJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          parsedCount: 1,
          completedAt: new Date()
        }
      })
    ]);
  } catch (error) {
    await prisma.extractionJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown extraction error",
        completedAt: new Date()
      }
    });
  }
}
