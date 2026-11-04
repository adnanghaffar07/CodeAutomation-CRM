// withScope must refuse malformed ids before touching the database (no DB needed here).
// The real isolation behaviour is covered by `npm run db:test`.
import { describe, expect, it } from "vitest";
import { withScope } from "../src/lib/scope";

describe("withScope guard", () => {
  it("rejects non-uuid user or workspace ids", async () => {
    await expect(withScope({ userId: "nope", workspaceId: "also-nope", role: "ceo_admin" }, async () => 1)).rejects.toThrow(/invalid scope/);
    await expect(
      withScope({ userId: "11111111-1111-4111-8111-111111111111", workspaceId: "x'; drop table", role: "manager" }, async () => 1),
    ).rejects.toThrow(/invalid scope/);
  });
});
