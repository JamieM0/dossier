import { describe, expect, test } from "vitest";
import { inferFromTakeoutArtifacts } from "./infer.js";
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
  test("produces deterministic inferences from high-signal products when no LLM is configured", async () => {
    const artifacts: TakeoutArtifact[] = [
      artifact({
        path: "Takeout/Mail/inbox.mbox",
        kind: "text",
        content: "From: Alex Example <alex@example.com>\nSubject: Sprint planning\nFrom: Priya Example <priya@example.com>",
        productKey: "gmail"
      }),
      artifact({
        path: "Takeout/Calendar/events.ics",
        kind: "text",
        content:
          "BEGIN:VEVENT\nSUMMARY:Quarterly strategy sync\nDESCRIPTION:Roadmap and commitments\nLOCATION:HQ\nEND:VEVENT",
        productKey: "calendar"
      }),
      artifact({
        path: "Takeout/YouTube and YouTube Music/history.json",
        kind: "json",
        content: [
          { title: "Watched TypeScript deep dive", subtitles: [{ name: "TS Channel" }] },
          { title: "Watched Product management talk", subtitles: [{ name: "PM Talks" }] },
          { title: "Watched React patterns", subtitles: [{ name: "Frontend Lab" }] }
        ],
        productKey: "youtube"
      }),
      artifact({
        path: "Takeout/Mail/archive-2.mbox",
        kind: "text",
        content: "From: Team <team@example.com>\nSubject: Release checklist",
        productKey: "gmail"
      }),
      artifact({
        path: "Takeout/Mail/archive-3.mbox",
        kind: "text",
        content: "From: Product <product@example.com>\nSubject: Customer interview notes",
        productKey: "gmail"
      }),
      artifact({
        path: "Takeout/Calendar/events-2.ics",
        kind: "text",
        content:
          "BEGIN:VEVENT\nSUMMARY:1:1 with manager\nDESCRIPTION:Career planning\nLOCATION:Video call\nEND:VEVENT",
        productKey: "calendar"
      })
    ];

    const result = await inferFromTakeoutArtifacts(artifacts, null);
    const proposals = result.proposals;

    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.some((proposal) => proposal.itemType === "communication")).toBe(true);
    expect(proposals.some((proposal) => proposal.itemType === "fact")).toBe(true);
    expect(proposals.some((proposal) => proposal.text.includes("Sprint planning"))).toBe(true);
    expect(proposals.some((proposal) => proposal.text.includes("nbsp"))).toBe(false);
    expect(proposals.some((proposal) => /content related to/i.test(proposal.text))).toBe(false);
    expect(result.diagnostics.mode).toBe("deterministic");
    expect(result.diagnostics.contextArtifacts).toBeGreaterThan(0);
  });

  test("abstains for pure markup noise without high-signal product evidence", async () => {
    const artifacts: TakeoutArtifact[] = [
      artifact({
        path: "Takeout/Other/index.html",
        kind: "text",
        content: "<html><body>&nbsp; class typography https google div</body></html>",
        productKey: "other"
      })
    ];

    const result = await inferFromTakeoutArtifacts(artifacts, null);
    expect(result.proposals).toHaveLength(0);
  });
});
