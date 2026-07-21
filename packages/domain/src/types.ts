export type NormalizedTransaction = {
  date: Date;
  description: string;
  amount: number;
  currency: string;
  balanceAfter: number | null;
  category: string | null;
  confidence: number;
  rawText: string;
};

export type TransactionCursor = {
  createdAt: string;
  id: string;
};
