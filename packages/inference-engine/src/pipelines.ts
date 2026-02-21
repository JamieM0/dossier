import { chatCompletion } from "./client.js";
import {
  TAKEOUT_INFERENCE_SYSTEM_PROMPT,
  CHAT_INFERENCE_SYSTEM_PROMPT,
  ALTERNATIVES_SYSTEM_PROMPT
} from "./prompts.js";
import type { InferenceEngineConfig, InferenceProposal, AlternativeSet } from "./types.js";

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  // Strip markdown code fences if present
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function isProposalArray(value: unknown): value is InferenceProposal[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).text === "string" &&
      typeof (item as Record<string, unknown>).itemType === "string"
  );
}

export async function inferFromTakeoutText(
  config: InferenceEngineConfig,
  artifactSummary: string
): Promise<InferenceProposal[]> {
  const result = await chatCompletion(config, [
    { role: "system", content: TAKEOUT_INFERENCE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Analyse the following imported data and extract profile inferences:\n\n${artifactSummary}`
    }
  ]);

  const parsed = tryParseJson(result.content);
  if (isProposalArray(parsed)) {
    return parsed;
  }

  // Try extracting proposals from nested object
  if (parsed && typeof parsed === "object" && "proposals" in (parsed as Record<string, unknown>)) {
    const proposals = (parsed as Record<string, unknown>).proposals;
    if (isProposalArray(proposals)) {
      return proposals;
    }
  }

  return [];
}

export type ChatInferenceResult = {
  reply: string;
  proposals: InferenceProposal[];
};

export async function inferFromChatMessage(
  config: InferenceEngineConfig,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  userMessage: string
): Promise<ChatInferenceResult> {
  const messages = [
    { role: "system" as const, content: CHAT_INFERENCE_SYSTEM_PROMPT },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content
    })),
    { role: "user" as const, content: userMessage }
  ];

  const result = await chatCompletion(config, messages);
  const parsed = tryParseJson(result.content);

  if (
    parsed &&
    typeof parsed === "object" &&
    typeof (parsed as Record<string, unknown>).reply === "string"
  ) {
    const obj = parsed as { reply: string; proposals?: unknown };
    return {
      reply: obj.reply,
      proposals: isProposalArray(obj.proposals) ? obj.proposals : []
    };
  }

  // If we can't parse structured response, treat the whole thing as a reply
  return { reply: result.content, proposals: [] };
}

export async function generateAlternatives(
  config: InferenceEngineConfig,
  text: string,
  itemType: string,
  why?: string
): Promise<AlternativeSet> {
  const context = why ? `\n\nOriginal evidence: ${why}` : "";
  const result = await chatCompletion(config, [
    { role: "system", content: ALTERNATIVES_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Statement: "${text}"\nItem type: ${itemType}${context}`
    }
  ]);

  const parsed = tryParseJson(result.content);
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Record<string, unknown>).alternatives)
  ) {
    const alts = (parsed as { alternatives: unknown[] }).alternatives;
    const valid = alts.filter(
      (alt): alt is { text: string; reason: string } =>
        typeof alt === "object" &&
        alt !== null &&
        typeof (alt as Record<string, unknown>).text === "string" &&
        typeof (alt as Record<string, unknown>).reason === "string"
    );

    return { original: text, alternatives: valid };
  }

  return { original: text, alternatives: [] };
}
