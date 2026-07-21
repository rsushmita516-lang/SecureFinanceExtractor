import type { TransactionCursor } from "./types";

export function encodeCursor(cursor: TransactionCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): TransactionCursor {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const parsed = JSON.parse(decoded) as Partial<TransactionCursor>;

  if (!parsed.createdAt || !parsed.id) {
    throw new Error("Invalid cursor payload");
  }

  return {
    createdAt: parsed.createdAt,
    id: parsed.id
  };
}
