import { describe, expect, test } from "vitest";
import {
  canCreateInference,
  confirmInference,
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

  test("confirm transitions pending inference to confirmed", () => {
    const item = createInferenceItem({
      profileId: crypto.randomUUID(),
      text: "User prefers direct language",
      itemType: "communication",
      categoryId: null,
      createdVia: "CHAT"
    });

    const confirmed = confirmInference(item);
    expect(confirmed.state).toBe("CONFIRMED");
    expect(confirmed.item_id).toBe(item.item_id);
  });

  test("dismiss produces a fingerprinted suppression record", () => {
    const item = createInferenceItem({
      profileId: crypto.randomUUID(),
      text: "User likes tea",
      itemType: "preference",
      categoryId: null,
      createdVia: "IMPORT"
    });

    const dismissed = dismissInference(item, item.profile_id, "incorrect");
    expect(dismissed.fingerprint).toBe(normalizeInferenceFingerprint(item.text, item.item_type));
    expect(dismissed.dismiss_reason).toBe("incorrect");
  });

  test("fingerprint normalizes text consistently", () => {
    const a = normalizeInferenceFingerprint("  Likes  Tea ", "preference");
    const b = normalizeInferenceFingerprint("likes tea", "preference");
    expect(a).toBe(b);
  });
});
