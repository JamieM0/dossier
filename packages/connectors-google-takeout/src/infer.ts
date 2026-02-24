import { basename } from "node:path";
import type { TakeoutArtifact, TakeoutProductKey } from "./parser.js";

export type InferenceProposal = {
  text: string;
  itemType: string;
  why: string;
  confidence: number | null;
};

export type LlmConfig = {
  endpoint: string;
  model: string;
  provider?:
    | "ollama"
    | "custom"
    | "openai"
    | "anthropic"
    | "google"
    | "openrouter"
    | "grok";
  authMethod?: "apiKey" | "oauth";
  apiKey?: string;
  oauthToken?: string;
};

const ALLOWED_ITEM_TYPES = new Set([
  "preference",
  "interest",
  "fact",
  "professional",
  "communication",
  "constraint"
]);

const NOISE_TOKENS = new Set([
  "nbsp",
  "https",
  "http",
  "google",
  "class",
  "cell",
  "typography",
  "style",
  "div"
]);

const CONTEXT_KEYS = new Set([
  "title",
  "name",
  "summary",
  "subject",
  "description",
  "location",
  "query",
  "snippet",
  "message",
  "from",
  "to",
  "attendee",
  "attendees",
  "event",
  "category",
  "label",
  "channel",
  "organization"
]);

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripHtml(input: string): string {
  return input.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

function sanitizeText(input: string): string {
  return normalizeWhitespace(decodeHtmlEntities(stripHtml(input)));
}

function looksLikeNoise(input: string): boolean {
  const cleaned = input.toLowerCase();
  if (!cleaned) {
    return true;
  }
  if (cleaned.length < 6 || cleaned.length > 280) {
    return true;
  }
  if (/^https?:\/\//.test(cleaned)) {
    return true;
  }
  if (/^[a-z0-9_-]{1,20}$/.test(cleaned) && NOISE_TOKENS.has(cleaned)) {
    return true;
  }
  if (/\b(?:doctype|font-family|display:\s*grid|var\(--|\.css|@media)\b/i.test(cleaned)) {
    return true;
  }
  const words = cleaned.split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
  if (words.length > 0) {
    const informative = words.filter(
      (token) => !NOISE_TOKENS.has(token) && !/^https?$/.test(token) && !/^www$/.test(token)
    );
    if (informative.length === 0) {
      return true;
    }
  }
  const letters = cleaned.replace(/[^a-z]/g, "").length;
  return letters < 5;
}

function extractCalendarLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (!line.includes(":")) {
      continue;
    }
    const [prefix, ...rest] = line.split(":");
    const key = prefix?.split(";")[0]?.toUpperCase() ?? "";
    const value = sanitizeText(rest.join(":"));
    if (!value || looksLikeNoise(value)) {
      continue;
    }
    if (["SUMMARY", "DESCRIPTION", "LOCATION"].includes(key)) {
      out.push(value);
    }
    if (out.length >= 4) {
      break;
    }
  }
  return out;
}

function extractMailLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (/^Subject:/i.test(trimmed)) {
      out.push(sanitizeText(trimmed.replace(/^Subject:\s*/i, "")));
    } else if (/^From:/i.test(trimmed)) {
      out.push(sanitizeText(trimmed.replace(/^From:\s*/i, "")));
    }
    if (out.length >= 4) {
      break;
    }
  }
  return out.filter((entry) => !looksLikeNoise(entry));
}

function extractJsonSnippets(
  value: unknown,
  snippets: string[],
  contextKey = "",
  depth = 0,
  budget = { count: 0 }
): void {
  if (depth > 5 || budget.count >= 40) {
    return;
  }

  if (typeof value === "string") {
    const cleaned = sanitizeText(value);
    if (!cleaned || looksLikeNoise(cleaned)) {
      return;
    }

    const key = contextKey.toLowerCase();
    if (CONTEXT_KEYS.has(key) || (cleaned.split(" ").length >= 3 && !/^\w+@\w+/.test(cleaned))) {
      snippets.push(cleaned);
      budget.count += 1;
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value.slice(0, 25)) {
      extractJsonSnippets(entry, snippets, contextKey, depth + 1, budget);
      if (budget.count >= 40) {
        return;
      }
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.entries(record);
  for (const [key, child] of entries.slice(0, 35)) {
    extractJsonSnippets(child, snippets, key, depth + 1, budget);
    if (budget.count >= 40) {
      return;
    }
  }
}

function extractArtifactEvidence(artifact: TakeoutArtifact): string[] {
  if (artifact.kind === "json") {
    const snippets: string[] = [];
    extractJsonSnippets(artifact.content, snippets);
    return [...new Set(snippets)].slice(0, 5);
  }

  const raw = typeof artifact.content === "string" ? artifact.content : "";
  const pathLower = artifact.path.toLowerCase();

  if (pathLower.endsWith(".ics") || artifact.productKey === "calendar") {
    return extractCalendarLines(raw);
  }

  if (pathLower.endsWith(".mbox") || pathLower.endsWith(".eml") || artifact.productKey === "gmail") {
    return extractMailLines(raw);
  }

  const cleaned = sanitizeText(raw);
  if (!cleaned) {
    return [];
  }

  const sentences = cleaned
    .split(/[.!?]\s+/)
    .map((entry) => normalizeWhitespace(entry))
    .filter((entry) => !looksLikeNoise(entry));
  return [...new Set(sentences)].slice(0, 4);
}

function buildEvidenceBundle(artifacts: TakeoutArtifact[]): {
  summaryText: string;
  productCounts: Map<TakeoutProductKey, number>;
  evidenceLineCount: number;
} {
  const productCounts = new Map<TakeoutProductKey, number>();
  const lines: string[] = [];

  for (const artifact of artifacts.slice(0, 160)) {
    productCounts.set(artifact.productKey, (productCounts.get(artifact.productKey) ?? 0) + 1);
    const evidence = extractArtifactEvidence(artifact);
    if (evidence.length === 0) {
      continue;
    }

    const fileName = basename(artifact.path);
    lines.push(`[${artifact.productKey}] ${fileName}: ${evidence.join(" | ")}`);
    if (lines.length >= 100) {
      break;
    }
  }

  const countsLine = [...productCounts.entries()]
    .map(([product, count]) => `${product}=${count}`)
    .join(", ");
  const summaryText = [`Artifacts by product: ${countsLine || "none"}`, ...lines].join("\n");

  return { summaryText, productCounts, evidenceLineCount: lines.length };
}

function normalizeProposal(proposal: InferenceProposal): InferenceProposal {
  return {
    text: normalizeWhitespace(proposal.text),
    itemType: proposal.itemType.trim().toLowerCase(),
    why: normalizeWhitespace(proposal.why),
    confidence:
      typeof proposal.confidence === "number"
        ? Math.max(0, Math.min(1, proposal.confidence))
        : null
  };
}

function isProposalHighQuality(proposal: InferenceProposal): boolean {
  const normalized = normalizeProposal(proposal);
  if (!ALLOWED_ITEM_TYPES.has(normalized.itemType)) {
    return false;
  }
  if (normalized.text.length < 12 || normalized.text.length > 240) {
    return false;
  }
  if (normalized.why.length < 12 || normalized.why.length > 320) {
    return false;
  }
  if (/^you frequently engage with content related to\s+"[^"]+"$/i.test(normalized.text)) {
    return false;
  }
  const lower = normalized.text.toLowerCase();
  if ([...NOISE_TOKENS].some((token) => lower === token || lower.includes(`"${token}"`))) {
    return false;
  }
  return true;
}

function inferFromTakeoutArtifactsFallback(artifacts: TakeoutArtifact[]): InferenceProposal[] {
  const { productCounts, evidenceLineCount } = buildEvidenceBundle(artifacts);
  const fallback: InferenceProposal[] = [];

  const push = (proposal: InferenceProposal): void => {
    if (isProposalHighQuality(proposal)) {
      fallback.push(normalizeProposal(proposal));
    }
  };

  const gmailCount = productCounts.get("gmail") ?? 0;
  const calendarCount = productCounts.get("calendar") ?? 0;
  const youtubeCount = productCounts.get("youtube") ?? 0;
  const driveCount = productCounts.get("drive") ?? 0;
  const photosCount = productCounts.get("photos") ?? 0;

  if (gmailCount >= 3) {
    push({
      text: "I actively use Gmail for day-to-day communication.",
      itemType: "communication",
      why: `Google Takeout import included ${gmailCount} Gmail artifacts.`,
      confidence: 0.62
    });
  }
  if (calendarCount >= 2) {
    push({
      text: "I keep an active calendar with scheduled events and commitments.",
      itemType: "fact",
      why: `Google Takeout import included ${calendarCount} Calendar artifacts.`,
      confidence: 0.64
    });
  }
  if (youtubeCount >= 3) {
    push({
      text: "I regularly watch content on YouTube.",
      itemType: "interest",
      why: `Google Takeout import included ${youtubeCount} YouTube history artifacts.`,
      confidence: 0.58
    });
  }
  if (driveCount >= 2) {
    push({
      text: "I work with files and documents in Google Drive.",
      itemType: "professional",
      why: `Google Takeout import included ${driveCount} Drive artifacts.`,
      confidence: 0.56
    });
  }
  if (photosCount >= 3) {
    push({
      text: "I maintain an archive of photos in Google Photos.",
      itemType: "fact",
      why: `Google Takeout import included ${photosCount} Google Photos artifacts.`,
      confidence: 0.55
    });
  }

  if (fallback.length === 0 && artifacts.length > 0 && evidenceLineCount > 0) {
    const productFootprint = [...productCounts.entries()]
      .filter(([, count]) => count > 0)
      .map(([product]) => product)
      .slice(0, 4)
      .join(", ");

    push({
      text: "My Google account history contains usable behavioral signals across multiple products.",
      itemType: "fact",
      why: `Takeout artifacts detected across: ${productFootprint || "Google data export"}.`,
      confidence: 0.5
    });
  }

  return fallback.slice(0, 8);
}

function chunkLines(text: string, maxLines = 28): string[] {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const chunks: string[] = [];

  for (let index = 0; index < lines.length; index += maxLines) {
    chunks.push(lines.slice(index, index + maxLines).join("\n"));
  }

  return chunks;
}

export async function inferFromTakeoutArtifacts(
  artifacts: TakeoutArtifact[],
  llmConfig?: LlmConfig | null
): Promise<InferenceProposal[]> {
  const { summaryText } = buildEvidenceBundle(artifacts);

  if (!llmConfig?.endpoint || !llmConfig?.model) {
    return inferFromTakeoutArtifactsFallback(artifacts);
  }

  try {
    const { inferFromTakeoutText } = await import("@dossier/inference-engine");
    const chunks = chunkLines(summaryText, 26).slice(0, 4);
    const aggregated: InferenceProposal[] = [];

    for (const chunk of chunks) {
      const proposals = await inferFromTakeoutText(
        {
          endpoint: llmConfig.endpoint,
          model: llmConfig.model,
          ...(llmConfig.provider ? { provider: llmConfig.provider } : {}),
          ...(llmConfig.authMethod ? { authMethod: llmConfig.authMethod } : {}),
          ...(llmConfig.apiKey ? { apiKey: llmConfig.apiKey } : {}),
          ...(llmConfig.oauthToken ? { oauthToken: llmConfig.oauthToken } : {})
        },
        `Extract only evidence-grounded facts from this Takeout bundle:\n${chunk}`
      );
      aggregated.push(...proposals);
    }

    const deduped = new Map<string, InferenceProposal>();
    for (const proposal of aggregated) {
      const normalized = normalizeProposal(proposal);
      if (!isProposalHighQuality(normalized)) {
        continue;
      }

      const key = `${normalized.itemType}:${normalized.text.toLowerCase()}`;
      const existing = deduped.get(key);
      if (!existing || (normalized.confidence ?? 0) > (existing.confidence ?? 0)) {
        deduped.set(key, normalized);
      }
    }

    const filtered = [...deduped.values()].slice(0, 12);
    if (filtered.length > 0) {
      return filtered;
    }

    return inferFromTakeoutArtifactsFallback(artifacts);
  } catch {
    return inferFromTakeoutArtifactsFallback(artifacts);
  }
}
