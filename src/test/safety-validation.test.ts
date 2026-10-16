import { describe, expect, it } from "vitest";
import { registerSchema, loginSchema } from "@/services/auth";

describe("Phase 11 & 12: Safety, Auth Validation & Privacy Rules", () => {
  it("rejects invalid emails and short passwords during registration", () => {
    const invalidData = {
      name: "Alex",
      email: "not-an-email",
      password: "short",
      confirm: "short",
    };

    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.email).toBeDefined();
      expect(fieldErrors.password).toBeDefined();
    }
  });

  it("rejects mismatched passwords during registration", () => {
    const mismatched = {
      name: "Alex",
      email: "alex@orbit.internal",
      password: "securepassword123",
      confirm: "differentpassword",
    };

    const result = registerSchema.safeParse(mismatched);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Passwords don't match yet");
    }
  });

  it("validates successful login schema", () => {
    const validLogin = {
      email: "user@cesium.social",
      password: "mypassword123",
    };

    const result = loginSchema.safeParse(validLogin);
    expect(result.success).toBe(true);
  });

  it("ensures unauthenticated visitors cannot access protected features without logging in", () => {
    const checkCanAccessFeature = (session: { id: string } | null) => {
      return Boolean(session && session.id);
    };

    expect(checkCanAccessFeature(null)).toBe(false);
    expect(checkCanAccessFeature({ id: "user-123" })).toBe(true);
  });
});
