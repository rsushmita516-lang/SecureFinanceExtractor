import { decodeCursor, encodeCursor, extractTransactionFromText } from "@vessify/domain";

describe("transaction extractor", () => {
  it("parses sample 1", () => {
    const sample = `Date: 11 Dec 2025\nDescription: STARBUCKS COFFEE MUMBAI\nAmount: -420.00\nBalance after transaction: 18,420.50`;
    const parsed = extractTransactionFromText(sample);

    expect(parsed.description).toContain("STARBUCKS");
    expect(parsed.amount).toBe(-420);
    expect(parsed.balanceAfter).toBe(18420.5);
  });

  it("parses sample 2", () => {
    const sample = `Uber Ride * Airport Drop\n12/11/2025 → ₹1,250.00 debited\nAvailable Balance → ₹17,170.50`;
    const parsed = extractTransactionFromText(sample);

    expect(parsed.description).toContain("Uber");
    expect(parsed.amount).toBe(-1250);
    expect(parsed.balanceAfter).toBe(17170.5);
  });

  it("parses sample 3", () => {
    const sample = `txn123 2025-12-10 Amazon.in Order #403-1234567-8901234 ₹2,999.00 Dr Bal 14171.50 Shopping`;
    const parsed = extractTransactionFromText(sample);

    expect(parsed.date.toISOString().startsWith("2025-12-10")).toBe(true);
    expect(parsed.amount).toBe(-2999);
    expect(parsed.balanceAfter).toBe(14171.5);
  });

  it("encodes and decodes cursor", () => {
    const cursor = {
      createdAt: new Date("2025-12-11T10:15:00.000Z").toISOString(),
      id: "txn_1"
    };

    const encoded = encodeCursor(cursor);
    const decoded = decodeCursor(encoded);

    expect(decoded).toEqual(cursor);
  });

  it("throws for malformed text", () => {
    expect(() => extractTransactionFromText("just words with no numbers")).toThrow();
  });
});
