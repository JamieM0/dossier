import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { DossierStoreService } from "./index.js";

describe("store repository policy behavior", () => {
  test("manual blocked item is stored and flagged", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
    const store = await DossierStoreService.init(dataDir);

    store.repository.addTopicRule({
      rule_id: crypto.randomUUID(),
      profile_id: store.repository.snapshot().profile.profile_id,
      pattern: "politics",
      match_mode: "KEYWORD",
      scope: "STORAGE_AND_SHARING",
      is_enabled: true
    });

    const item = store.repository.createManualItem({
      text: "I avoid politics in recommendations",
      itemType: "constraint",
      categoryId: null
    });

    const blockedSet = store.repository.listBlockedItemIds();
    expect(blockedSet.has(item.item_id)).toBe(true);
  });

  test("inference matching topic block is suppressed", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "dossier-store-"));
    const store = await DossierStoreService.init(dataDir);

    store.repository.addTopicRule({
      rule_id: crypto.randomUUID(),
      profile_id: store.repository.snapshot().profile.profile_id,
      pattern: "health",
      match_mode: "KEYWORD",
      scope: "STORAGE_AND_SHARING",
      is_enabled: true
    });

    const result = store.repository.createInference({
      text: "User frequently reads health articles",
      itemType: "interest",
      categoryId: null,
      createdVia: "IMPORT"
    });

    expect(result).toBeNull();
  });
});
