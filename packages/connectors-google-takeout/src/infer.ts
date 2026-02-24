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

export type InferenceRunDiagnostics = {
  mode: "llm" | "deterministic";
  contextArtifacts: number;
  contextLines: number;
  contextChars: number;
  llmChunks: number;
  llmFailedChunks: number;
  llmRawProposals: number;
  llmAcceptedProposals: number;
  fallbackReason: string | null;
};

export type InferFromTakeoutArtifactsResult = {
  proposals: InferenceProposal[];
  diagnostics: InferenceRunDiagnostics;
};

type EvidenceRecord = {
  productKey: TakeoutProductKey;
  path: string;
  lines: string[];
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
  "div",
  "span",
  "font"
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
  "organization",
  "creator",
  "author",
  "text",
  "note"
]);

const PRODUCT_PRIORITY: TakeoutProductKey[] = [
  "youtube",
  "gmail",
  "calendar",
  "drive",
  "contacts",
  "photos",
  "location",
  "other"
];

const PRODUCT_RECORD_CAP: Record<TakeoutProductKey, number> = {
  youtube: 60,
  gmail: 40,
  calendar: 35,
  drive: 25,
  contacts: 20,
  photos: 20,
  location: 20,
  other: 20
};

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
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function sanitizeText(input: string): string {
  return normalizeWhitespace(decodeHtmlEntities(stripHtml(input)));
}

function looksLikeNoise(input: string): boolean {
  const cleaned = input.toLowerCase();
  if (!cleaned) {
    return true;
  }
  if (cleaned.length < 6 || cleaned.length > 340) {
    return true;
  }
  if (/^https?:\/\//.test(cleaned)) {
    return true;
  }
  if (/^[a-z0-9_-]{1,24}$/.test(cleaned) && NOISE_TOKENS.has(cleaned)) {
    return true;
  }
  if (/\b(?:doctype|font-family|display:\s*grid|var\(--|\.css|@media|javascript:|onclick|mdl-cell)\b/i.test(cleaned)) {
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

function keyPathToLabel(path: string): string {
  const segment = path.split(".").at(-1) ?? path;
  return segment.replace(/_/g, " ");
}

function pushUnique(target: string[], value: string, limit: number): void {
  const normalized = normalizeWhitespace(value);
  if (!normalized || looksLikeNoise(normalized)) {
    return;
  }
  if (!target.includes(normalized)) {
    target.push(normalized);
  }
  if (target.length > limit) {
    target.splice(limit);
  }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  out.push(current);
  return out.map((value) => normalizeWhitespace(value));
}

function parseCsvRecords(text: string, maxRows = 50): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]!);
  const rows: Array<Record<string, string>> = [];

  for (const line of lines.slice(1, maxRows + 1)) {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    for (const [idx, header] of headers.entries()) {
      if (!header) {
        continue;
      }
      row[header] = values[idx] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function readRowValue(row: Record<string, string>, candidates: string[]): string | null {
  const lowered = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  for (const candidate of candidates) {
    const value = lowered.get(candidate.toLowerCase());
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
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
    if (["SUMMARY", "DESCRIPTION", "LOCATION", "DTSTART", "DTEND", "ATTENDEE"].includes(key)) {
      pushUnique(out, `${key}: ${value}`, 12);
    }
  }

  return out;
}

function extractMailLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let bodyStart = lines.findIndex((line) => line.trim().length === 0);
  if (bodyStart < 0) {
    bodyStart = Math.min(35, lines.length);
  }

  for (const line of lines.slice(0, Math.max(40, bodyStart))) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (/^Subject:/i.test(trimmed)) {
      pushUnique(out, `Subject: ${sanitizeText(trimmed.replace(/^Subject:\s*/i, ""))}`, 12);
    } else if (/^From:/i.test(trimmed)) {
      pushUnique(out, `From: ${sanitizeText(trimmed.replace(/^From:\s*/i, ""))}`, 12);
    } else if (/^To:/i.test(trimmed)) {
      pushUnique(out, `To: ${sanitizeText(trimmed.replace(/^To:\s*/i, ""))}`, 12);
    } else if (/^Date:/i.test(trimmed)) {
      pushUnique(out, `Date: ${sanitizeText(trimmed.replace(/^Date:\s*/i, ""))}`, 12);
    }
  }

  const bodyLines = lines.slice(bodyStart + 1);
  for (const line of bodyLines) {
    const trimmed = sanitizeText(line);
    if (!trimmed || trimmed.startsWith(">") || looksLikeNoise(trimmed)) {
      continue;
    }
    pushUnique(out, `Body: ${trimmed}`, 14);
    if (out.length >= 14) {
      break;
    }
  }

  return out;
}

function extractJsonSnippets(
  value: unknown,
  snippets: string[],
  keyPath = "",
  depth = 0,
  budget = { count: 0 }
): void {
  if (depth > 6 || budget.count >= 120) {
    return;
  }

  if (typeof value === "string") {
    const cleaned = sanitizeText(value);
    if (!cleaned || looksLikeNoise(cleaned)) {
      return;
    }

    const lastKey = keyPath.split(".").at(-1)?.toLowerCase() ?? "";
    if (CONTEXT_KEYS.has(lastKey) || cleaned.split(" ").length >= 4) {
      const label = keyPath ? keyPathToLabel(keyPath) : "text";
      pushUnique(snippets, `${label}: ${cleaned}`, 18);
      budget.count += 1;
    }
    return;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const lastKey = keyPath.split(".").at(-1)?.toLowerCase() ?? "";
    if (/(count|duration|rating|score|size|timestamp|time|age)/.test(lastKey)) {
      const label = keyPath ? keyPathToLabel(keyPath) : "value";
      pushUnique(snippets, `${label}: ${String(value)}`, 18);
      budget.count += 1;
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const [index, entry] of value.slice(0, 30).entries()) {
      extractJsonSnippets(entry, snippets, `${keyPath}[${index}]`, depth + 1, budget);
      if (budget.count >= 120) {
        return;
      }
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 45)) {
    const childPath = keyPath ? `${keyPath}.${key}` : key;
    extractJsonSnippets(child, snippets, childPath, depth + 1, budget);
    if (budget.count >= 120) {
      return;
    }
  }
}

function extractGenericTextLines(text: string): string[] {
  const cleaned = sanitizeText(text);
  if (!cleaned) {
    return [];
  }

  const out: string[] = [];
  const sentences = cleaned
    .split(/[.!?]\s+/)
    .map((entry) => normalizeWhitespace(entry))
    .filter((entry) => !looksLikeNoise(entry));

  for (const sentence of sentences) {
    pushUnique(out, sentence, 8);
    if (out.length >= 8) {
      break;
    }
  }

  return out;
}

function extractYouTubeHistoryLines(rawHtml: string): string[] {
  const out: string[] = [];

  for (const match of rawHtml.matchAll(/Watched(?:\s|&nbsp;)*<a[^>]*>([\s\S]*?)<\/a>/gi)) {
    pushUnique(out, `watch: ${sanitizeText(match[1] ?? "")}`, 16);
  }

  for (const match of rawHtml.matchAll(/Searched\s*for(?:\s|&nbsp;)*<a[^>]*>([\s\S]*?)<\/a>/gi)) {
    pushUnique(out, `search: ${sanitizeText(match[1] ?? "")}`, 16);
  }

  for (const match of rawHtml.matchAll(/<a[^>]*href="https?:\/\/www\.youtube\.com\/channel\/[^"]+"[^>]*>([\s\S]*?)<\/a>/gi)) {
    pushUnique(out, `creator: ${sanitizeText(match[1] ?? "")}`, 16);
  }

  return out;
}

function extractYouTubeCsvLines(pathLower: string, rawCsv: string): string[] {
  const out: string[] = [];
  const rows = parseCsvRecords(rawCsv, 80);
  if (rows.length === 0) {
    return out;
  }

  if (pathLower.endsWith("/channels/channel.csv")) {
    const row = rows[0]!;
    const title = readRowValue(row, ["Channel Title (Original)", "Channel Title"]);
    const visibility = readRowValue(row, ["Channel Visibility", "Visibility"]);
    if (title) {
      pushUnique(out, `channel title: ${title}`, 12);
    }
    if (visibility) {
      pushUnique(out, `channel visibility: ${visibility}`, 12);
    }
    return out;
  }

  if (pathLower.endsWith("/subscriptions/subscriptions.csv")) {
    for (const row of rows) {
      const title = readRowValue(row, ["Channel Title", "Channel name", "Name"]);
      if (title) {
        pushUnique(out, `subscription: ${title}`, 20);
      }
    }
    return out;
  }

  if (pathLower.endsWith("/playlists/playlists.csv")) {
    for (const row of rows) {
      const title = readRowValue(row, ["Playlist Title (Original)", "Playlist Title"]);
      const visibility = readRowValue(row, ["Playlist Visibility", "Visibility"]);
      if (title) {
        pushUnique(out, `playlist: ${title}${visibility ? ` (${visibility})` : ""}`, 20);
      }
    }
    return out;
  }

  if (pathLower.endsWith("/music (library and uploads)/music library songs.csv")) {
    for (const row of rows) {
      const song = readRowValue(row, ["Song Title", "Title"]);
      const artist = readRowValue(row, ["Artist Name 1", "Artist", "Artist Name"]);
      if (song) {
        pushUnique(out, `song: ${song}${artist ? ` by ${artist}` : ""}`, 24);
      }
    }
    return out;
  }

  if (pathLower.endsWith("/video metadata/videos.csv")) {
    for (const row of rows) {
      const title = readRowValue(row, ["Video Title (Original)", "Video Title", "Title"]);
      const category = readRowValue(row, ["Video Category", "Category"]);
      if (title) {
        pushUnique(out, `uploaded video: ${title}${category ? ` (${category})` : ""}`, 18);
      }
    }
    return out;
  }

  if (pathLower.endsWith("/comments/comments.csv")) {
    for (const row of rows) {
      const comment = readRowValue(row, ["Comment Text", "Comment"]);
      if (comment) {
        pushUnique(out, `comment: ${sanitizeText(comment).slice(0, 160)}`, 12);
      }
    }
    return out;
  }

  const candidateColumns = [
    "title",
    "name",
    "query",
    "text",
    "description",
    "artist",
    "album",
    "category"
  ];

  for (const row of rows) {
    for (const [header, value] of Object.entries(row)) {
      const lower = header.toLowerCase();
      if (!candidateColumns.some((candidate) => lower.includes(candidate))) {
        continue;
      }
      if (!value || looksLikeNoise(value)) {
        continue;
      }
      pushUnique(out, `${header}: ${sanitizeText(value)}`, 16);
    }
  }

  return out;
}

function extractArtifactEvidence(artifact: TakeoutArtifact): string[] {
  if (artifact.kind === "json") {
    const snippets: string[] = [];
    extractJsonSnippets(artifact.content, snippets);
    return snippets.slice(0, 12);
  }

  const raw = typeof artifact.content === "string" ? artifact.content : "";
  const pathLower = artifact.path.toLowerCase();

  if (pathLower.endsWith(".ics") || artifact.productKey === "calendar") {
    return extractCalendarLines(raw);
  }
  if (pathLower.endsWith(".mbox") || pathLower.endsWith(".eml") || artifact.productKey === "gmail") {
    return extractMailLines(raw);
  }
  if (artifact.productKey === "youtube") {
    if (pathLower.includes("/history/") && pathLower.endsWith(".html")) {
      return extractYouTubeHistoryLines(raw);
    }
    if (pathLower.endsWith(".csv")) {
      return extractYouTubeCsvLines(pathLower, raw);
    }
  }

  return extractGenericTextLines(raw);
}

function buildEvidenceRecords(artifacts: TakeoutArtifact[]): {
  records: EvidenceRecord[];
  productCounts: Map<TakeoutProductKey, number>;
} {
  const productCounts = new Map<TakeoutProductKey, number>();
  for (const artifact of artifacts) {
    productCounts.set(artifact.productKey, (productCounts.get(artifact.productKey) ?? 0) + 1);
  }

  const priority = new Map(PRODUCT_PRIORITY.map((product, index) => [product, index]));
  const ordered = [...artifacts].sort(
    (a, b) => (priority.get(a.productKey) ?? 99) - (priority.get(b.productKey) ?? 99)
  );

  const recordsByProduct = new Map<TakeoutProductKey, number>();
  const records: EvidenceRecord[] = [];

  for (const artifact of ordered.slice(0, 500)) {
    const cap = PRODUCT_RECORD_CAP[artifact.productKey] ?? 20;
    const count = recordsByProduct.get(artifact.productKey) ?? 0;
    if (count >= cap) {
      continue;
    }

    const lines = extractArtifactEvidence(artifact);
    if (lines.length === 0) {
      continue;
    }

    records.push({
      productKey: artifact.productKey,
      path: artifact.path,
      lines: lines.slice(0, 12)
    });
    recordsByProduct.set(artifact.productKey, count + 1);

    if (records.length >= 180) {
      break;
    }
  }

  return { records, productCounts };
}

function buildLlmContext(records: EvidenceRecord[], productCounts: Map<TakeoutProductKey, number>): string {
  const header = [...productCounts.entries()]
    .map(([product, count]) => `${product}=${count}`)
    .join(", ");
  const chunks: string[] = [`Artifacts by product: ${header || "none"}`];

  for (const [index, record] of records.entries()) {
    chunks.push(
      [
        `Artifact ${index + 1}`,
        `product: ${record.productKey}`,
        `path: ${record.path}`,
        ...record.lines.map((line) => `evidence: ${line}`)
      ].join("\n")
    );
  }

  return chunks.join("\n\n---\n\n");
}

function chunkByCharacters(text: string, target = 3200): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let buffer: string[] = [];
  let currentChars = 0;

  for (const line of lines) {
    const next = line.length + 1;
    if (currentChars > 0 && currentChars + next > target) {
      chunks.push(buffer.join("\n"));
      buffer = [];
      currentChars = 0;
    }
    buffer.push(line);
    currentChars += next;
  }

  if (buffer.length > 0) {
    chunks.push(buffer.join("\n"));
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
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
  if (normalized.text.length < 12 || normalized.text.length > 260) {
    return false;
  }
  if (normalized.why.length < 12 || normalized.why.length > 380) {
    return false;
  }
  if (/^you frequently engage with content related to\s+"[^"]+"$/i.test(normalized.text)) {
    return false;
  }
  const lowerText = normalized.text.toLowerCase();
  if ([...NOISE_TOKENS].some((token) => lowerText === token || lowerText.includes(`"${token}"`))) {
    return false;
  }
  return true;
}

function firstEvidenceLine(records: EvidenceRecord[], product: TakeoutProductKey, startsWith: RegExp): string | null {
  for (const record of records) {
    if (record.productKey !== product) {
      continue;
    }
    for (const line of record.lines) {
      if (startsWith.test(line)) {
        return line;
      }
    }
  }
  return null;
}

function deterministicFallback(records: EvidenceRecord[], productCounts: Map<TakeoutProductKey, number>): InferenceProposal[] {
  const proposals: InferenceProposal[] = [];
  const push = (proposal: InferenceProposal): void => {
    if (isProposalHighQuality(proposal)) {
      proposals.push(normalizeProposal(proposal));
    }
  };

  const gmailCount = productCounts.get("gmail") ?? 0;
  const calendarCount = productCounts.get("calendar") ?? 0;
  const youtubeCount = productCounts.get("youtube") ?? 0;
  const driveCount = productCounts.get("drive") ?? 0;
  const photosCount = productCounts.get("photos") ?? 0;

  if (gmailCount >= 2) {
    const subject = firstEvidenceLine(records, "gmail", /^subject:/i);
    push({
      text: subject
        ? `I discuss topics such as "${subject.replace(/^subject:\s*/i, "")}" over email.`
        : "I actively use Gmail for day-to-day communication.",
      itemType: "communication",
      why: `Gmail artifacts detected (${gmailCount}) with extractable message metadata and content snippets.`,
      confidence: subject ? 0.68 : 0.62
    });
  }

  if (calendarCount >= 2) {
    const summary = firstEvidenceLine(records, "calendar", /^summary:/i);
    push({
      text: summary
        ? `My calendar includes events like "${summary.replace(/^summary:\s*/i, "")}".`
        : "I keep an active calendar with scheduled events and commitments.",
      itemType: "fact",
      why: `Calendar artifacts detected (${calendarCount}) with event summaries, times, or locations.`,
      confidence: summary ? 0.7 : 0.64
    });
  }

  if (youtubeCount >= 2) {
    const watch = firstEvidenceLine(records, "youtube", /^watch:/i);
    const search = firstEvidenceLine(records, "youtube", /^search:/i);
    const subscription = firstEvidenceLine(records, "youtube", /^subscription:/i);
    const song = firstEvidenceLine(records, "youtube", /^song:/i);
    const playlist = firstEvidenceLine(records, "youtube", /^playlist:/i);

    if (watch) {
      push({
        text: `I recently watched YouTube content such as "${watch.replace(/^watch:\s*/i, "")}".`,
        itemType: "interest",
        why: `Watch-history evidence extracted from YouTube history artifacts (${youtubeCount}).`,
        confidence: 0.7
      });
    }
    if (search) {
      push({
        text: `I search YouTube for topics like "${search.replace(/^search:\s*/i, "")}".`,
        itemType: "interest",
        why: "Search-history entries were detected in YouTube activity exports.",
        confidence: 0.66
      });
    }
    if (song) {
      push({
        text: `I listen to music tracks such as "${song.replace(/^song:\s*/i, "")}" on YouTube Music.`,
        itemType: "interest",
        why: "Music library songs were detected in YouTube Music export files.",
        confidence: 0.65
      });
    }
    if (subscription) {
      push({
        text: `I follow channels including "${subscription.replace(/^subscription:\s*/i, "")}" on YouTube.`,
        itemType: "interest",
        why: "Subscription channel titles were extracted from subscriptions.csv.",
        confidence: 0.64
      });
    }
    if (playlist) {
      push({
        text: `I curate YouTube playlists such as "${playlist.replace(/^playlist:\s*/i, "")}".`,
        itemType: "fact",
        why: "Playlist metadata was extracted from playlists.csv in the Takeout export.",
        confidence: 0.62
      });
    }

    if (!watch && !search && !subscription && !song && !playlist) {
      push({
        text: "I regularly watch content on YouTube.",
        itemType: "interest",
        why: `YouTube artifacts detected (${youtubeCount}) with activity metadata.`,
        confidence: 0.58
      });
    }
  }

  if (driveCount >= 2) {
    push({
      text: "I work with files and documents in Google Drive.",
      itemType: "professional",
      why: `Drive artifacts detected (${driveCount}) with document metadata/content excerpts.`,
      confidence: 0.56
    });
  }

  if (photosCount >= 3) {
    push({
      text: "I maintain an archive of photos in Google Photos.",
      itemType: "fact",
      why: `Google Photos artifacts detected (${photosCount}) in this Takeout import.`,
      confidence: 0.55
    });
  }

  if (proposals.length === 0 && records.length > 0) {
    push({
      text: "My Google account history includes enough signal to start building a personal archive profile.",
      itemType: "fact",
      why: `Extracted evidence snippets from ${records.length} artifacts across Google products.`,
      confidence: 0.5
    });
  }

  return proposals.slice(0, 12);
}

function withDiagnostics(
  proposals: InferenceProposal[],
  diagnostics: InferenceRunDiagnostics
): InferFromTakeoutArtifactsResult {
  return { proposals, diagnostics };
}

export async function inferFromTakeoutArtifacts(
  artifacts: TakeoutArtifact[],
  llmConfig?: LlmConfig | null
): Promise<InferFromTakeoutArtifactsResult> {
  const { records, productCounts } = buildEvidenceRecords(artifacts);
  const context = buildLlmContext(records, productCounts);
  const contextLines = records.reduce((sum, record) => sum + record.lines.length, 0);

  if (!llmConfig?.endpoint || !llmConfig?.model) {
    return withDiagnostics(deterministicFallback(records, productCounts), {
      mode: "deterministic",
      contextArtifacts: records.length,
      contextLines,
      contextChars: context.length,
      llmChunks: 0,
      llmFailedChunks: 0,
      llmRawProposals: 0,
      llmAcceptedProposals: 0,
      fallbackReason: "llm_not_configured"
    });
  }

  let inferFromTakeoutTextFn: ((
    config: {
      endpoint: string;
      model: string;
      provider?: LlmConfig["provider"];
      authMethod?: LlmConfig["authMethod"];
      apiKey?: string;
      oauthToken?: string;
    },
    artifactSummary: string,
    options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
  ) => Promise<InferenceProposal[]>) | null = null;

  try {
    const module = await import("@dossier/inference-engine");
    inferFromTakeoutTextFn = module.inferFromTakeoutText as unknown as (
      config: {
        endpoint: string;
        model: string;
        provider?: LlmConfig["provider"];
        authMethod?: LlmConfig["authMethod"];
        apiKey?: string;
        oauthToken?: string;
      },
      artifactSummary: string,
      options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
    ) => Promise<InferenceProposal[]>;
  } catch {
    return withDiagnostics(deterministicFallback(records, productCounts), {
      mode: "deterministic",
      contextArtifacts: records.length,
      contextLines,
      contextChars: context.length,
      llmChunks: 0,
      llmFailedChunks: 0,
      llmRawProposals: 0,
      llmAcceptedProposals: 0,
      fallbackReason: "llm_module_load_failed"
    });
  }

  if (!inferFromTakeoutTextFn) {
    return withDiagnostics(deterministicFallback(records, productCounts), {
      mode: "deterministic",
      contextArtifacts: records.length,
      contextLines,
      contextChars: context.length,
      llmChunks: 0,
      llmFailedChunks: 0,
      llmRawProposals: 0,
      llmAcceptedProposals: 0,
      fallbackReason: "llm_module_load_failed"
    });
  }

  const chunks = chunkByCharacters(context, 3200).slice(0, 12);
  const aggregated: InferenceProposal[] = [];
  let failedChunks = 0;

  for (const chunk of chunks) {
    const promptPayload = [
      "Use the artifact evidence below to extract specific, user-correctable profile facts.",
      "Every proposal must be directly grounded in the provided content excerpts.",
      "Prefer concrete facts over broad summaries.",
      "If no specific fact is supported, return [].",
      "",
      chunk
    ].join("\n");

    try {
      const chunkProposals = await inferFromTakeoutTextFn(
        {
          endpoint: llmConfig.endpoint,
          model: llmConfig.model,
          ...(llmConfig.provider ? { provider: llmConfig.provider } : {}),
          ...(llmConfig.authMethod ? { authMethod: llmConfig.authMethod } : {}),
          ...(llmConfig.apiKey ? { apiKey: llmConfig.apiKey } : {}),
          ...(llmConfig.oauthToken ? { oauthToken: llmConfig.oauthToken } : {})
        },
        promptPayload,
        {
          temperature: 0.15,
          maxTokens: 500,
          timeoutMs: 90_000
        }
      );

      aggregated.push(...chunkProposals);
    } catch {
      failedChunks += 1;
    }
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

  const accepted = [...deduped.values()].slice(0, 20);
  if (accepted.length > 0) {
    return withDiagnostics(accepted, {
      mode: "llm",
      contextArtifacts: records.length,
      contextLines,
      contextChars: context.length,
      llmChunks: chunks.length,
      llmFailedChunks: failedChunks,
      llmRawProposals: aggregated.length,
      llmAcceptedProposals: accepted.length,
      fallbackReason: null
    });
  }

  const fallbackReason =
    chunks.length > 0 && failedChunks === chunks.length
      ? "llm_request_failed"
      : "llm_returned_no_accepted_proposals";

  return withDiagnostics(deterministicFallback(records, productCounts), {
    mode: "deterministic",
    contextArtifacts: records.length,
    contextLines,
    contextChars: context.length,
    llmChunks: chunks.length,
    llmFailedChunks: failedChunks,
    llmRawProposals: aggregated.length,
    llmAcceptedProposals: 0,
    fallbackReason
  });
}
