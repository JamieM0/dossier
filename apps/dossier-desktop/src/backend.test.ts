import { describe, expect, test } from "vitest";

process.env.DOSSIER_BACKEND_SKIP_BOOTSTRAP = "1";

await import("./backend.js");

describe("backend bootstrap guard", () => {
  test("module loads without bootstrapping when skip flag is set", () => {
    expect(process.env.DOSSIER_BACKEND_SKIP_BOOTSTRAP).toBe("1");
  });
});
