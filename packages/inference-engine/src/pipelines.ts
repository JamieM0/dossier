import { chatCompletion } from "./client.js";
import {
  TAKEOUT_INFERENCE_SYSTEM_PROMPT,
  CHAT_INFERENCE_SYSTEM_PROMPT,
  ALTERNATIVES_SYSTEM_PROMPT
} from "./prompts.js";
import type { InferenceEngineConfig, InferenceProposal, AlternativeSet } from "./types.js";

export type TakeoutInferenceOptions = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

function firstBalancedJsonBlock(input: string, opener: "{" | "["): string | null {
  const closer = opener === "{" ? "}" : "]";
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === opener) {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === closer && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return input.slice(start, index + 1);
      }
    }
  }

  return null;
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  const candidates: string[] = [];

  candidates.push(trimmed);

  const unwrappedFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  if (unwrappedFence !== trimmed) {
    candidates.push(unwrappedFence);
  }

  const firstArray = firstBalancedJsonBlock(trimmed, "[");
  if (firstArray) {
    candidates.push(firstArray);
  }

  const firstObject = firstBalancedJsonBlock(trimmed, "{");
  if (firstObject) {
    candidates.push(firstObject);
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  return null;
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

function extractReplyText(value: unknown, depth = 0): string | null {
  if (depth > 4) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return (
    extractReplyText(record.text, depth + 1) ??
    extractReplyText(record.reply, depth + 1) ??
    extractReplyText(record.message, depth + 1) ??
    extractReplyText(record.content, depth + 1) ??
    extractReplyText(record.response, depth + 1)
  );
}

function parseJsonStringAt(input: string, quoteIndex: number): { value: string; end: number } | null {
  if (input[quoteIndex] !== '"') {
    return null;
  }

  let escaped = false;
  for (let index = quoteIndex + 1; index < input.length; index += 1) {
    const char = input[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      const raw = input.slice(quoteIndex, index + 1);
      try {
        return { value: JSON.parse(raw) as string, end: index + 1 };
      } catch {
        return null;
      }
    }
  }

  return null;
}

function extractChatFallback(raw: string): ChatInferenceResult | null {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  const replyKeyMatch = /"reply"\s*:/i.exec(text);
  if (!replyKeyMatch) {
    return null;
  }

  const afterReplyColon = replyKeyMatch.index + replyKeyMatch[0].length;
  let replyStart = afterReplyColon;
  while (replyStart < text.length && /\s/.test(text[replyStart]!)) {
    replyStart += 1;
  }

  let reply: string | null = null;
  if (text[replyStart] === '"') {
    reply = parseJsonStringAt(text, replyStart)?.value ?? null;
  } else if (text[replyStart] === "{") {
    const replyObject = firstBalancedJsonBlock(text.slice(replyStart), "{");
    if (replyObject) {
      try {
        reply = extractReplyText(JSON.parse(replyObject));
      } catch {
        reply = null;
      }
    }
  }

  if (!reply) {
    return null;
  }

  const proposalsMatch = /"proposals"\s*:/i.exec(text);
  if (!proposalsMatch) {
    return { reply, proposals: [] };
  }

  const afterProposalsColon = proposalsMatch.index + proposalsMatch[0].length;
  const proposalsBlock = firstBalancedJsonBlock(text.slice(afterProposalsColon), "[");
  if (!proposalsBlock) {
    return { reply, proposals: [] };
  }

  try {
    const parsed = JSON.parse(proposalsBlock);
    return { reply, proposals: isProposalArray(parsed) ? parsed : [] };
  } catch {
    return { reply, proposals: [] };
  }
}

export async function inferFromTakeoutText(
  config: InferenceEngineConfig,
  artifactSummary: string,
  options: TakeoutInferenceOptions = {}
): Promise<InferenceProposal[]> {
  const result = await chatCompletion(config, [
    { role: "system", content: TAKEOUT_INFERENCE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Analyse the following imported data and extract profile inferences:\n\n${artifactSummary}`
    }
  ], {
    temperature: options.temperature ?? 0.2,
    maxTokens: options.maxTokens ?? 800,
    timeoutMs: options.timeoutMs ?? 300_000
  });

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
  userMessage: string,
  profileContext?: string
): Promise<ChatInferenceResult> {
  const profileContextBlock = profileContext?.trim()
    ? `\n\nPROFILE_CONTEXT_JSON:\n${profileContext}`
    : "";

  const messages = [
    {
      role: "system" as const,
      content: `${CHAT_INFERENCE_SYSTEM_PROMPT}${profileContextBlock}`
    },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content
    })),
    { role: "user" as const, content: userMessage }
  ];

  const result = await chatCompletion(config, messages);
  const parsed = tryParseJson(result.content);

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const nested = obj.reply && typeof obj.reply === "object" ? (obj.reply as Record<string, unknown>) : null;
    const reply =
      extractReplyText(obj.reply) ??
      extractReplyText(obj.text) ??
      extractReplyText(obj.message) ??
      extractReplyText(obj.content) ??
      extractReplyText(obj.response);
    const proposals =
      isProposalArray(obj.proposals)
        ? obj.proposals
        : nested && isProposalArray(nested.proposals)
          ? nested.proposals
          : [];

    if (reply) {
      return { reply, proposals };
    }
  }

  const fallback = extractChatFallback(result.content);
  if (fallback) {
    return fallback;
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
