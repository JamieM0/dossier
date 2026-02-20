import type { Item, TopicBlockRule } from "./types.js";
export declare function isTopicBlockedText(text: string, rules: TopicBlockRule[]): TopicBlockRule | null;
export declare function filterItemsForInternalUse(items: Item[], blockedItemIds: Set<string>): Item[];
export declare function filterItemsForSharingDefault(items: Item[], blockedItemIds: Set<string>): Item[];
export declare function applyOneTimeBlockedOverrides(baseAllowedItemIds: string[], blockedOverrideIds: string[], blockedItemIds: Set<string>): string[];
//# sourceMappingURL=policy.d.ts.map