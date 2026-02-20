import type { Item, TopicBlockRule } from "./types.js";

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

export function isTopicBlockedText(text: string, rules: TopicBlockRule[]): TopicBlockRule | null {
  const normalized = text.trim().toLowerCase();

  for (const rule of rules) {
    if (!rule.is_enabled) {
      continue;
    }

    const pattern = rule.pattern.trim().toLowerCase();
    if (!pattern) {
      continue;
    }

    if (rule.match_mode === "EXACT" && normalized === pattern) {
      return rule;
    }

    if ((rule.match_mode === "PHRASE" || rule.match_mode === "KEYWORD") && normalized.includes(pattern)) {
      return rule;
    }

    if (rule.match_mode === "REGEX") {
      const regex = safeRegex(rule.pattern);
      if (regex && regex.test(text)) {
        return rule;
      }
    }
  }

  return null;
}

export function filterItemsForInternalUse(items: Item[], blockedItemIds: Set<string>): Item[] {
  return items.filter((item) => !blockedItemIds.has(item.item_id));
}

export function filterItemsForSharingDefault(items: Item[], blockedItemIds: Set<string>): Item[] {
  return items.filter((item) => !blockedItemIds.has(item.item_id));
}

export function applyOneTimeBlockedOverrides(
  baseAllowedItemIds: string[],
  blockedOverrideIds: string[],
  blockedItemIds: Set<string>
): string[] {
  const allowSet = new Set(baseAllowedItemIds);

  for (const id of blockedOverrideIds) {
    if (blockedItemIds.has(id)) {
      allowSet.add(id);
    }
  }

  return [...allowSet];
}
