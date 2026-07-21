import type { NormalizedTransaction } from "./types";

const DATE_PATTERNS: RegExp[] = [
  /\b(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\b/,
  /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
  /\b(\d{4}-\d{2}-\d{2})\b/
];

const AMOUNT_PATTERN = /(?:₹|INR\s*)?(-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})|-?\d+(?:\.\d{1,2})?)/g;

function normalizeAmount(value: string): number {
  return Number.parseFloat(value.replace(/,/g, ""));
}

function parseDate(dateText: string): Date {
  const maybe = new Date(dateText);

  if (!Number.isNaN(maybe.getTime())) {
    return maybe;
  }

  const [day, month, year] = dateText.split("/").map((item) => Number.parseInt(item, 10));
  if (!day || !month || !year) {
    throw new Error("Unsupported date format");
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function extractDate(text: string): Date | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseDate(match[1]);
    }
  }
  return null;
}

function extractCurrency(text: string): string {
  if (text.includes("₹") || /\bINR\b/i.test(text)) {
    return "INR";
  }
  return "INR";
}

function extractBalance(text: string): number | null {
  const balanceMatch =
    text.match(/Balance after transaction\s*[:\-]\s*(?:₹)?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/Available Balance\s*[^0-9]*?(?:₹)?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/\bBal(?:ance)?\s*[^0-9]*?(?:₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);

  if (!balanceMatch?.[1]) {
    return null;
  }

  return normalizeAmount(balanceMatch[1]);
}

function extractAmount(text: string): number | null {
  // Try explicit Amount: field
  const amountLineMatch = text.match(/Amount\s*[:\-]\s*(?:₹|INR)?\s*(-?[\d,]+(?:\.\d{1,2})?)/i);
  if (amountLineMatch?.[1]) {
    return normalizeAmount(amountLineMatch[1]);
  }

  // Try debited / Dr
  const debitedMatch = text.match(/(?:₹|INR)?\s*([\d,]+(?:\.\d{1,2})?)\s*debited/i);
  if (debitedMatch?.[1]) {
    return -Math.abs(normalizeAmount(debitedMatch[1]));
  }
  const drMatch = text.match(/(?:₹|INR)?\s*([\d,]+(?:\.\d{1,2})?)\s*Dr\b/i);
  if (drMatch?.[1]) {
    return -Math.abs(normalizeAmount(drMatch[1]));
  }

  // Try credited / Cr
  const creditedMatch = text.match(/(?:₹|INR)?\s*([\d,]+(?:\.\d{1,2})?)\s*credited/i);
  if (creditedMatch?.[1]) {
    return Math.abs(normalizeAmount(creditedMatch[1]));
  }
  const crMatch = text.match(/(?:₹|INR)?\s*([\d,]+(?:\.\d{1,2})?)\s*Cr\b/i);
  if (crMatch?.[1]) {
    return Math.abs(normalizeAmount(crMatch[1]));
  }

  // General fallback by cleaning text
  let cleanText = text;
  const balanceMatch =
    text.match(/Balance after transaction\s*[:\-]\s*(?:₹)?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/Available Balance\s*[\-–>]+\s*(?:₹)?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/\bBal\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (balanceMatch) {
    cleanText = cleanText.replace(balanceMatch[0], "");
  }

  for (const pattern of DATE_PATTERNS) {
    cleanText = cleanText.replace(pattern, "");
  }

  cleanText = cleanText.replace(/#\d+[\d\-]*\b/g, "");
  cleanText = cleanText.replace(/\btxn\d+\b/gi, "");

  const remainingMatches = [...cleanText.matchAll(/(?:₹|INR\s*)?(-?[\d,]+(?:\.\d{1,2})?)/gi)]
    .map((match) => match[1])
    .filter((value): value is string => typeof value === "string")
    .map((value) => normalizeAmount(value))
    .filter((value) => !Number.isNaN(value));

  if (!remainingMatches.length) {
    return null;
  }

  const firstAmount = remainingMatches[0];
  if (firstAmount === undefined) {
    return null;
  }

  if (/debited|\bdr\b/i.test(text)) {
    return -Math.abs(firstAmount);
  }

  if (/credited|\bcr\b/i.test(text)) {
    return Math.abs(firstAmount);
  }

  if (firstAmount < 0) {
    return firstAmount;
  }

  if (remainingMatches.length > 1) {
    return -Math.abs(firstAmount);
  }

  return firstAmount;
}

function extractDescription(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const descriptionLine = lines.find((line) => /^description\s*:/i.test(line));
  if (descriptionLine) {
    return descriptionLine.replace(/^description\s*:/i, "").trim();
  }

  const candidate = lines.find(
    (line) =>
      !/date|amount|balance|debited|txn\d+/i.test(line) &&
      /[a-zA-Z]/.test(line)
  );

  return candidate ?? lines[0] ?? "Unknown transaction";
}

function inferCategory(description: string): string | null {
  if (/starbucks|coffee|uber|amazon|order|shopping/i.test(description)) {
    return /uber/i.test(description)
      ? "Transport"
      : /starbucks|coffee/i.test(description)
        ? "Food & Beverage"
        : "Shopping";
  }

  return null;
}

export function extractTransactionFromText(sourceText: string): NormalizedTransaction {
  const date = extractDate(sourceText);
  const amount = extractAmount(sourceText);
  const balanceAfter = extractBalance(sourceText);
  const description = extractDescription(sourceText);
  const currency = extractCurrency(sourceText);

  if (!date || amount === null) {
    throw new Error("Unable to reliably parse transaction text");
  }

  let confidence = 0.45;
  if (date) confidence += 0.2;
  if (amount !== null) confidence += 0.2;
  if (balanceAfter !== null) confidence += 0.1;
  if (description !== "Unknown transaction") confidence += 0.05;

  return {
    date,
    description,
    amount,
    currency,
    balanceAfter,
    category: inferCategory(description),
    confidence: Math.min(1, Number(confidence.toFixed(2))),
    rawText: sourceText
  };
}
