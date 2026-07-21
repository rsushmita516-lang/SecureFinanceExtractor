import { loginSchema, registerSchema } from "@vessify/domain";

describe("auth validation", () => {
  it("accepts valid register payload", () => {
    const parsed = registerSchema.safeParse({
      email: "alice@example.com",
      password: "supersecure123",
      name: "Alice"
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects too-short login password", () => {
    const parsed = loginSchema.safeParse({
      email: "alice@example.com",
      password: "short"
    });

    expect(parsed.success).toBe(false);
  });
});
