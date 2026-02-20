import { describe, expect, test } from "vitest";
import {
  canCreateInference,
  createInferenceItem,
  dismissInference,
  editThenConfirmInference,
  normalizeInferenceFingerprint
} from "./state-machines.js";

describe("state machine invariants", () => {
  test("dismissed fingerprint blocks resuggestion", () => {
    const item = createInferenceItem({
      profileId: crypto.randomUUID(),
      text: "User values concise communication",
      itemType: "preference",
      categoryId: null,
      createdVia: "IMPORT"
    });

    const dismissed = dismissInference(item, item.profile_id, null);
    expect(canCreateInference(dismissed.fingerprint, [dismissed])).toBe(false);
  });

  test("edit-then-confirm preserves before and after text", () => {
    const item = createInferenceItem({
      profileId: crypto.randomUUID(),
      text: "User likes long responses",
      itemType: "preference",
      categoryId: null,
      createdVia: "CONNECTOR"
    });

    const result = editThenConfirmInference(item, "User prefers concise responses");

    expect(result.item.state).toBe("CONFIRMED");
    expect(result.editHistory.before_text).toBe("User likes long responses");
    expect(result.editHistory.after_text).toBe("User prefers concise responses");
  });

  test("fingerprint normalizes text consistently", () => {
    const a = normalizeInferenceFingerprint("  Likes  Tea ", "preference");
    const b = normalizeInferenceFingerprint("likes tea", "preference");
    expect(a).toBe(b);
  });
});
