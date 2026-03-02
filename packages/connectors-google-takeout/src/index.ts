import { inferFromTakeoutArtifacts, type LlmConfig } from "./infer.js";
import {
  scanTakeoutSource,
  parseTakeoutSourceFiles,
  TAKEOUT_PRODUCT_KEYS,
  type TakeoutArtifact,
  type TakeoutProductKey,
  type TakeoutSourceFile,
  type TakeoutSourceType
} from "./parser.js";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";

type TakeoutDateRangePreset = "last_12_months" | "all_time";

export type TakeoutImportScope = {
  dateRangePreset?: TakeoutDateRangePreset;
  includedProducts?: TakeoutProductKey[];
  prioritiseHighSignalItems?: boolean;
};

export type TakeoutImportProgressStage = "inventory" | "parse" | "scope" | "infer" | "store" | "complete";

export type TakeoutImportProgressEvent = {
  stage: TakeoutImportProgressStage;
  status: "started" | "progress" | "completed";
  message: string;
  metrics?: Record<string, string | number | boolean | null>;
};

export type TakeoutImportPlanProduct = {
  key: TakeoutProductKey;
  label: string;
  fileCount: number;
  parseableFileCount: number;
  totalBytes: number;
  parseableBytes: number;
  selectedByDefault: boolean;
};

export type TakeoutImportPlan = {
  workspaceId: string;
  sourcePath: string;
  sourceType: TakeoutSourceType;
  generatedAt: string;
  totalFiles: number;
  parseableFiles: number;
  totalBytes: number;
  parseableBytes: number;
  detectedAccount: {
    email: string | null;
    label: string;
  };
  products: TakeoutImportPlanProduct[];
  defaultScope: {
    dateRangePreset: TakeoutDateRangePreset;
    includedProducts: TakeoutProductKey[];
  };
  warnings: string[];
};

export type RunTakeoutImportResult = {
  workspaceId: string;
  sourceType: TakeoutSourceType;
  artifactsScanned: number;
  artifactsImported: number;
  parseErrors: number;
  inferencesCreated: number;
  inferencesSuppressed: number;
  startedAt: string;
  completedAt: string;
  scope: {
    dateRangePreset: TakeoutDateRangePreset;
    includedProducts: TakeoutProductKey[];
    prioritiseHighSignalItems: boolean;
  };
  warnings: string[];
};

export type RunTakeoutImportOptions = {
  workspaceId?: string;
  scope?: TakeoutImportScope;
  onProgress?: (event: TakeoutImportProgressEvent) => void;
};

type TakeoutStorePort = {
  repository: {
    addEvidenceSummary(input: {
      sourceLabel: string;
      summaryKind: string;
      summaryJson: Record<string, unknown>;
    }): { evidence_summary_id: string } | unknown;
    addRawArtifact(input: {
      sourceLabel: string;
      artifactKind: string;
      encryptedPayloadBase64: string;
      capturedAt: string | null;
    }): unknown;
    createInference(input: {
      text: string;
      itemType: string;
      categoryId: string | null;
      createdVia: "CONNECTOR" | "IMPORT" | "CHAT";
      sourceLabel?: string;
      whyDossierThinksThis?: string | null;
      confidence?: number | null;
      evidenceSummaryId?: string | null;
    }): unknown;
    listItems?: () => Array<{
      item_id: string;
      state?: string;
      text?: string;
      created_via?: string;
    }>;
    dismissInference?: (itemId: string, dismissReason?: string | null) => unknown;
  };
};

const PRODUCT_LABELS: Record<TakeoutProductKey, string> = {
  gmail: "Gmail",
  calendar: "Calendar",
  youtube: "YouTube",
  drive: "Drive",
  photos: "Photos",
  contacts: "Contacts",
  location: "Location",
  other: "Other"
};

const DEFAULT_PRODUCT_ORDER: TakeoutProductKey[] = [
  "gmail",
  "calendar",
  "youtube",
  "drive",
  "contacts",
  "photos",
  "location",
  "other"
];

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const TAKEOUT_FILE_SUFFIXES = new Set(["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar"]);

function normalizeScope(
  scope: TakeoutImportScope | undefined,
  availableProducts: TakeoutProductKey[]
): {
  dateRangePreset: TakeoutDateRangePreset;
  includedProducts: TakeoutProductKey[];
  prioritiseHighSignalItems: boolean;
} {
  const dedupedAvailable = [...new Set(availableProducts)] as TakeoutProductKey[];
  const dateRangePreset = scope?.dateRangePreset === "all_time" ? "all_time" : "last_12_months";
  const includedProductsRaw = scope?.includedProducts?.filter((product) => dedupedAvailable.includes(product));
  const includedProducts =
    includedProductsRaw && includedProductsRaw.length > 0
      ? [...new Set(includedProductsRaw)]
      : dedupedAvailable.filter((product) => ["gmail", "calendar", "youtube"].includes(product));

  const normalizedIncluded = includedProducts.length > 0 ? includedProducts : dedupedAvailable;

  return {
    dateRangePreset,
    includedProducts: normalizedIncluded,
    prioritiseHighSignalItems: scope?.prioritiseHighSignalItems !== false
  };
}

function extractEmails(value: string): string[] {
  const pattern = new RegExp(EMAIL_REGEX.source, "gi");
  const out = new Set<string>();

  for (const match of value.toLowerCase().matchAll(pattern)) {
    const candidate = match[0]?.trim() ?? "";
    if (!candidate) {
      continue;
    }

    const [localPart, domainPart] = candidate.split("@");
    if (!localPart || !domainPart) {
      out.add(candidate);
      continue;
    }

    const domainSegments = domainPart.split(".");
    if (domainSegments.length >= 3) {
      const last = domainSegments[domainSegments.length - 1];
      if (last && TAKEOUT_FILE_SUFFIXES.has(last)) {
        domainSegments.pop();
      }
    }

    out.add(`${localPart}@${domainSegments.join(".")}`);
  }

  return [...out];
}

function normalizeTakeoutPathEmail(email: string): string {
  const [localPart, domainPart] = email.split("@");
  if (!localPart || !domainPart) {
    return email;
  }
  const normalizedLocal = localPart.replace(/^(?:google-)?takeout[-_]+/i, "").trim() || localPart;
  return `${normalizedLocal}@${domainPart}`;
}

function safeReadText(file: TakeoutSourceFile, maxChars = 220_000): string {
  if (!file.parseable || !file.readText) {
    return "";
  }
  try {
    const content = file.readText();
    return content.length > maxChars ? content.slice(0, maxChars) : content;
  } catch {
    return "";
  }
}

function inferAccountFromSource(sourcePath: string, files: TakeoutSourceFile[]): { email: string | null; label: string } {
  const scoredEmails = new Map<string, number>();
  const addScore = (email: string, score: number): void => {
    const next = (scoredEmails.get(email) ?? 0) + score;
    scoredEmails.set(email, next);
  };

  for (const email of extractEmails(sourcePath)) {
    addScore(normalizeTakeoutPathEmail(email), 12);
  }

  const accountCandidateFiles = files.filter((file) => {
    if (!file.parseable || !file.readText) {
      return false;
    }
    const lower = file.logicalPath.toLowerCase();
    if (lower.includes("/mail/") || lower.includes("gmail")) {
      return false;
    }
    return (
      lower.includes("account") ||
      lower.includes("profile") ||
      lower.includes("about") ||
      lower.includes("personal") ||
      lower.includes("settings")
    );
  });

  for (const file of accountCandidateFiles.slice(0, 60)) {
    const content = safeReadText(file, 160_000);
    if (!content) {
      continue;
    }

    const lowerPath = file.logicalPath.toLowerCase();
    let scoreBoost = 2;
    if (lowerPath.includes("account")) {
      scoreBoost += 3;
    }
    if (lowerPath.includes("profile")) {
      scoreBoost += 2;
    }
    if (/primary|owner|account email|email address/i.test(content)) {
      scoreBoost += 2;
    }

    for (const email of extractEmails(content)) {
      addScore(email, scoreBoost);
    }
  }

  const ranked = [...scoredEmails.entries()].sort((a, b) => b[1] - a[1]);
  const accountEmail = ranked[0]?.[0] ?? null;
  const fallbackLabel = basename(sourcePath).trim() || "Google account";

  return {
    email: accountEmail,
    label: accountEmail ?? fallbackLabel
  };
}

function takeoutTimestampFromContent(content: unknown): number | null {
  if (!content || typeof content !== "object") {
    return null;
  }

  const queue: unknown[] = [content];
  let depth = 0;

  while (queue.length > 0 && depth < 4) {
    const batch = queue.splice(0, queue.length);
    for (const entry of batch) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const candidates = [
        record.time,
        record.time_usec,
        record.timeUsec,
        record.timestamp,
        record.startTime,
        record.creationTime,
        record.date
      ];

      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
          const parsed = Date.parse(candidate);
          if (Number.isFinite(parsed)) {
            return parsed;
          }
          if (/^\d{10,16}$/.test(candidate.trim())) {
            const raw = Number(candidate.trim());
            if (Number.isFinite(raw)) {
              const millis = candidate.trim().length > 12 ? Math.floor(raw / 1000) : raw * 1000;
              if (Number.isFinite(millis)) {
                return millis;
              }
            }
          }
        }

        if (typeof candidate === "number" && Number.isFinite(candidate)) {
          if (candidate > 10_000_000_000) {
            return Math.floor(candidate / 1000);
          }
          return candidate * 1000;
        }
      }

      for (const value of Object.values(record)) {
        if (value && typeof value === "object") {
          queue.push(value);
        }
      }
    }
    depth += 1;
  }

  return null;
}

function artifactPassesScope(artifact: TakeoutArtifact, scope: { dateRangePreset: TakeoutDateRangePreset }): boolean {
  if (scope.dateRangePreset === "all_time") {
    return true;
  }

  const timestamp = artifact.kind === "json" ? takeoutTimestampFromContent(artifact.content) : null;
  if (!timestamp) {
    return true;
  }

  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
  return timestamp >= cutoff;
}

function emitProgress(
  onProgress: ((event: TakeoutImportProgressEvent) => void) | undefined,
  event: TakeoutImportProgressEvent
): void {
  onProgress?.(event);
}

export function planGoogleTakeoutImport(sourcePath: string, scope?: TakeoutImportScope): TakeoutImportPlan {
  const workspaceId = randomUUID();
  const scan = scanTakeoutSource(sourcePath);
  const detectedAccount = inferAccountFromSource(sourcePath, scan.files);
  const productSummaries = new Map<
    TakeoutProductKey,
    { fileCount: number; parseableFileCount: number; totalBytes: number; parseableBytes: number }
  >();

  for (const product of TAKEOUT_PRODUCT_KEYS) {
    productSummaries.set(product, {
      fileCount: 0,
      parseableFileCount: 0,
      totalBytes: 0,
      parseableBytes: 0
    });
  }

  for (const file of scan.files) {
    const existing = productSummaries.get(file.productKey);
    if (!existing) {
      continue;
    }
    existing.fileCount += 1;
    existing.totalBytes += file.bytes;
    if (file.parseable) {
      existing.parseableFileCount += 1;
      existing.parseableBytes += file.bytes;
    }
  }

  const availableProducts = [...productSummaries.entries()]
    .filter(([, counts]) => counts.fileCount > 0)
    .map(([product]) => product);
  const normalizedScope = normalizeScope(scope, availableProducts);

  const products = DEFAULT_PRODUCT_ORDER.map((productKey) => {
    const counts = productSummaries.get(productKey);
    if (!counts || counts.fileCount === 0) {
      return null;
    }

    return {
      key: productKey,
      label: PRODUCT_LABELS[productKey],
      fileCount: counts.fileCount,
      parseableFileCount: counts.parseableFileCount,
      totalBytes: counts.totalBytes,
      parseableBytes: counts.parseableBytes,
      selectedByDefault: normalizedScope.includedProducts.includes(productKey)
    } satisfies TakeoutImportPlanProduct;
  }).filter((entry): entry is TakeoutImportPlanProduct => Boolean(entry));

  const totalFiles = scan.files.length;
  const parseableFiles = scan.files.filter((file) => file.parseable).length;
  const totalBytes = scan.files.reduce((sum, file) => sum + file.bytes, 0);
  const parseableBytes = scan.files.filter((file) => file.parseable).reduce((sum, file) => sum + file.bytes, 0);
  const warnings = [...scan.warnings];

  if (totalFiles === 0) {
    warnings.push("No files were found in the selected source.");
  }
  if (parseableFiles === 0 && totalFiles > 0) {
    warnings.push("No supported artifacts were found. Supported types: JSON, TXT, MD, CSV, ICS, VCF, HTML, MBOX, EML.");
  }

  return {
    workspaceId,
    sourcePath,
    sourceType: scan.sourceType,
    generatedAt: new Date().toISOString(),
    totalFiles,
    parseableFiles,
    totalBytes,
    parseableBytes,
    detectedAccount,
    products,
    defaultScope: {
      dateRangePreset: normalizedScope.dateRangePreset,
      includedProducts: normalizedScope.includedProducts
    },
    warnings
  };
}

export async function runGoogleTakeoutImport(
  store: TakeoutStorePort,
  sourcePath: string,
  llmConfig?: LlmConfig | null,
  options: RunTakeoutImportOptions = {}
): Promise<RunTakeoutImportResult> {
  const workspaceId = options.workspaceId ?? randomUUID();
  const startedAt = new Date().toISOString();

  emitProgress(options.onProgress, {
    stage: "inventory",
    status: "started",
    message: "Scanning selected Google Takeout source..."
  });

  const scan = scanTakeoutSource(sourcePath);
  const productsInSource = [...new Set(scan.files.map((file) => file.productKey))] as TakeoutProductKey[];
  const normalizedScope = normalizeScope(options.scope, productsInSource);

  emitProgress(options.onProgress, {
    stage: "inventory",
    status: "completed",
    message: "Inventory complete.",
    metrics: {
      workspace_id: workspaceId,
      source_type: scan.sourceType,
      total_files: scan.files.length,
      parseable_files: scan.files.filter((file) => file.parseable).length
    }
  });

  emitProgress(options.onProgress, {
    stage: "parse",
    status: "started",
    message: "Parsing supported artifacts..."
  });

  const scopedFiles = scan.files.filter((file) => normalizedScope.includedProducts.includes(file.productKey));

  const { artifacts: parsedArtifacts, parseErrors } = parseTakeoutSourceFiles(
    scopedFiles,
    (index, total, currentPath) => {
      if (index === 1 || index === total || index % 20 === 0) {
        emitProgress(options.onProgress, {
          stage: "parse",
          status: "progress",
          message: `Parsing ${currentPath}`,
          metrics: {
            parsed: index,
            total,
            product: inferProductFromPath(currentPath)
          }
        });
      }
    }
  );

  emitProgress(options.onProgress, {
    stage: "parse",
    status: "completed",
    message: "Artifact parsing complete.",
    metrics: {
      parsed_artifacts: parsedArtifacts.length,
      parse_errors: parseErrors
    }
  });

  emitProgress(options.onProgress, {
    stage: "scope",
    status: "started",
    message: "Applying import scope filters..."
  });

  const artifacts = parsedArtifacts.filter((artifact) => artifactPassesScope(artifact, normalizedScope));

  emitProgress(options.onProgress, {
    stage: "scope",
    status: "completed",
    message: "Scope filters applied.",
    metrics: {
      kept_artifacts: artifacts.length,
      skipped_artifacts: Math.max(0, parsedArtifacts.length - artifacts.length),
      date_range: normalizedScope.dateRangePreset
    }
  });

  emitProgress(options.onProgress, {
    stage: "infer",
    status: "started",
    message:
      llmConfig?.endpoint && llmConfig?.model
        ? "Generating candidate profile inferences..."
        : "No model configured. Running deterministic extraction from high-signal artifacts."
  });

  emitProgress(options.onProgress, {
    stage: "infer",
    status: "progress",
    message: "Building evidence bundle for extraction.",
    metrics: {
      artifacts_for_inference: artifacts.length,
      llm_model: llmConfig?.model ?? null
    }
  });

  const inferenceResult = await inferFromTakeoutArtifacts(artifacts, llmConfig);
  const proposals = inferenceResult.proposals;
  const inferenceDiagnostics = inferenceResult.diagnostics;

  emitProgress(options.onProgress, {
    stage: "infer",
    status: "completed",
    message:
      inferenceDiagnostics.mode === "llm"
        ? "Inference pass complete with LLM-backed extraction."
        : "Inference pass complete with deterministic fallback extraction.",
    metrics: {
      proposals: proposals.length,
      llm_enabled: Boolean(llmConfig?.endpoint && llmConfig?.model),
      context_artifacts: inferenceDiagnostics.contextArtifacts,
      context_lines: inferenceDiagnostics.contextLines,
      context_chars: inferenceDiagnostics.contextChars,
      llm_chunks: inferenceDiagnostics.llmChunks,
      llm_failed_chunks: inferenceDiagnostics.llmFailedChunks,
      llm_raw_proposals: inferenceDiagnostics.llmRawProposals,
      llm_accepted_proposals: inferenceDiagnostics.llmAcceptedProposals,
      fallback_reason: inferenceDiagnostics.fallbackReason
    }
  });

  emitProgress(options.onProgress, {
    stage: "store",
    status: "started",
    message: "Storing import evidence and proposals..."
  });

  let legacyNoiseDismissed = 0;
  if (store.repository.listItems && store.repository.dismissInference) {
    const existingItems = store.repository.listItems();
    for (const item of existingItems) {
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (
        item.state === "INFERENCE_PENDING" &&
        /^you frequently engage with content related to\s+"[^"]+"$/i.test(text)
      ) {
        try {
          store.repository.dismissInference(item.item_id, "legacy_takeout_noise_cleanup");
          legacyNoiseDismissed += 1;
        } catch {
          // Keep import running if cleanup fails for any individual item.
        }
      }
    }
  }

  if (legacyNoiseDismissed > 0) {
    emitProgress(options.onProgress, {
      stage: "store",
      status: "progress",
      message: "Removed legacy low-quality Takeout inferences.",
      metrics: {
        legacy_noise_dismissed: legacyNoiseDismissed
      }
    });
  }

  const evidenceSummary = store.repository.addEvidenceSummary({
    sourceLabel: "Google Takeout",
    summaryKind: "takeout_import",
    summaryJson: {
      workspace_id: workspaceId,
      source_path: sourcePath,
      source_type: scan.sourceType,
      date_range_preset: normalizedScope.dateRangePreset,
      included_products: normalizedScope.includedProducts,
      artifact_count: artifacts.length,
      proposal_count: proposals.length,
      inference_mode: inferenceDiagnostics.mode,
      inference_context_artifacts: inferenceDiagnostics.contextArtifacts,
      inference_context_lines: inferenceDiagnostics.contextLines,
      inference_context_chars: inferenceDiagnostics.contextChars,
      inference_llm_chunks: inferenceDiagnostics.llmChunks,
      inference_llm_failed_chunks: inferenceDiagnostics.llmFailedChunks,
      inference_llm_raw_proposals: inferenceDiagnostics.llmRawProposals,
      inference_llm_accepted_proposals: inferenceDiagnostics.llmAcceptedProposals,
      inference_fallback_reason: inferenceDiagnostics.fallbackReason,
      parse_errors: parseErrors,
      generated_at: new Date().toISOString()
    }
  });

  const evidenceSummaryId =
    evidenceSummary &&
    typeof evidenceSummary === "object" &&
    "evidence_summary_id" in evidenceSummary &&
    typeof (evidenceSummary as { evidence_summary_id?: unknown }).evidence_summary_id === "string"
      ? (evidenceSummary as { evidence_summary_id: string }).evidence_summary_id
      : null;

  const rawArtifactLimit = 300;
  for (const [index, artifact] of artifacts.slice(0, rawArtifactLimit).entries()) {
    store.repository.addRawArtifact({
      sourceLabel: "Google Takeout",
      artifactKind: artifact.kind === "json" ? "json_artifact" : "text_artifact",
      encryptedPayloadBase64: Buffer.from(JSON.stringify(artifact.content), "utf8").toString("base64"),
      capturedAt: null
    });

    if (index === 0 || index + 1 === Math.min(rawArtifactLimit, artifacts.length) || (index + 1) % 25 === 0) {
      emitProgress(options.onProgress, {
        stage: "store",
        status: "progress",
        message: `Stored raw artifact ${index + 1} of ${Math.min(rawArtifactLimit, artifacts.length)}`,
        metrics: {
          raw_artifacts_stored: index + 1,
          raw_artifacts_limit: rawArtifactLimit
        }
      });
    }
  }

  let inferencesCreated = 0;
  let inferencesSuppressed = 0;

  for (const [index, proposal] of proposals.entries()) {
    const result = store.repository.createInference({
      text: proposal.text,
      itemType: proposal.itemType,
      categoryId: null,
      createdVia: "IMPORT",
      sourceLabel: "Google Takeout",
      whyDossierThinksThis: proposal.why,
      confidence: proposal.confidence,
      evidenceSummaryId
    });

    if (result) {
      inferencesCreated += 1;
    } else {
      inferencesSuppressed += 1;
    }

    if (index === 0 || index + 1 === proposals.length || (index + 1) % 10 === 0) {
      emitProgress(options.onProgress, {
        stage: "store",
        status: "progress",
        message: `Persisted proposal ${index + 1} of ${proposals.length}`,
        metrics: {
          proposals_persisted: index + 1,
          proposals_created: inferencesCreated,
          proposals_suppressed: inferencesSuppressed
        }
      });
    }
  }

  emitProgress(options.onProgress, {
    stage: "store",
    status: "completed",
    message: "Storage complete.",
    metrics: {
      inferences_created: inferencesCreated,
      inferences_suppressed: inferencesSuppressed,
      legacy_noise_dismissed: legacyNoiseDismissed
    }
  });

  const completedAt = new Date().toISOString();
  const warnings = [...scan.warnings];
  if (!llmConfig?.endpoint || !llmConfig?.model) {
    warnings.push("No LLM configured; used deterministic extraction only. Connect a model in welcome flow for richer candidate facts.");
  }
  if (inferenceDiagnostics.fallbackReason) {
    warnings.push(`Inference fallback used: ${inferenceDiagnostics.fallbackReason}.`);
  }
  if (artifacts.length === 0) {
    warnings.push("No artifacts matched the selected scope.");
  }

  emitProgress(options.onProgress, {
    stage: "complete",
    status: "completed",
    message: "Takeout import completed.",
    metrics: {
      workspace_id: workspaceId,
      artifacts_scanned: artifacts.length,
      inferences_created: inferencesCreated,
      inferences_suppressed: inferencesSuppressed,
      legacy_noise_dismissed: legacyNoiseDismissed
    }
  });

  return {
    workspaceId,
    sourceType: scan.sourceType,
    artifactsScanned: artifacts.length,
    artifactsImported: Math.min(rawArtifactLimit, artifacts.length),
    parseErrors,
    inferencesCreated,
    inferencesSuppressed,
    startedAt,
    completedAt,
    scope: normalizedScope,
    warnings
  };
}

function inferProductFromPath(path: string): string {
  const lowered = path.toLowerCase();
  if (lowered.includes("/mail/")) return "gmail";
  if (lowered.includes("/calendar/")) return "calendar";
  if (lowered.includes("youtube")) return "youtube";
  if (lowered.includes("/drive/")) return "drive";
  if (lowered.includes("/contacts/")) return "contacts";
  if (lowered.includes("photos")) return "photos";
  if (lowered.includes("location")) return "location";
  return "other";
}
