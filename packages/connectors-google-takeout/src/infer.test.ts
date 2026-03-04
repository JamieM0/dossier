import { describe, expect, test } from "vitest";
import { inferFromTakeoutArtifacts, InferenceConfigError } from "./infer.js";
import type { TakeoutArtifact } from "./parser.js";

function artifact(input: Partial<TakeoutArtifact> & Pick<TakeoutArtifact, "path" | "kind" | "content">): TakeoutArtifact {
  return {
    bytes: 1024,
    productKey: "other",
    sourceType: "directory",
    ...input
  };
}

describe("inferFromTakeoutArtifacts", () => {
  test("throws InferenceConfigError when no LLM is configured", async () => {
    const artifacts: TakeoutArtifact[] = [
      artifact({
        path: "Takeout/Mail/inbox.mbox",
        kind: "text",
        content: "From: Alex Example <alex@example.com>\nSubject: Sprint planning",
        productKey: "gmail"
      })
    ];

    await expect(inferFromTakeoutArtifacts(artifacts, null)).rejects.toThrow(InferenceConfigError);
    await expect(inferFromTakeoutArtifacts(artifacts, null)).rejects.toThrow(
      "No LLM configured"
    );
  });

  test("throws InferenceConfigError when endpoint or model is missing", async () => {
    const artifacts: TakeoutArtifact[] = [
      artifact({
        path: "Takeout/Other/index.html",
        kind: "text",
        content: "Some content",
        productKey: "other"
      })
    ];

    await expect(
      inferFromTakeoutArtifacts(artifacts, { endpoint: "", model: "gpt-4" })
    ).rejects.toThrow(InferenceConfigError);

    await expect(
      inferFromTakeoutArtifacts(artifacts, { endpoint: "http://localhost:11434", model: "" })
    ).rejects.toThrow(InferenceConfigError);
  });
});
