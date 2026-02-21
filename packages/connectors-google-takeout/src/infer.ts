import type { TakeoutArtifact } from "./parser.js";

export type InferenceProposal = {
  text: string;
  itemType: string;
  why: string;
  confidence: number | null;
};

export type LlmConfig = {
  endpoint: string;
  model: string;
};

function normalizeTokens(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function inferFromTakeoutArtifactsFallback(artifacts: TakeoutArtifact[]): InferenceProposal[] {
  const tokenCounts = new Map<string, number>();

  for (const artifact of artifacts) {
    const text = typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content);
    for (const token of normalizeTokens(text)) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
  }

  const frequentTokens = [...tokenCounts.entries()]
    .filter(([, count]) => count >= 15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return frequentTokens.map(([token, count]) => ({
    text: `You frequently engage with content related to "${token}"`,
    itemType: "interest",
    why: `Appears ${count} times across imported Google Takeout artifacts`,
    confidence: Math.min(0.92, 0.45 + count / 200)
  }));
}

export async function inferFromTakeoutArtifacts(
  artifacts: TakeoutArtifact[],
  llmConfig?: LlmConfig | null
): Promise<InferenceProposal[]> {
  if (!llmConfig?.endpoint || !llmConfig?.model) {
    return inferFromTakeoutArtifactsFallback(artifacts);
  }

  // Summarise artifacts for the LLM
  const summaryParts: string[] = [];
  for (const artifact of artifacts.slice(0, 30)) {
    const text = typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content);
    summaryParts.push(`[${artifact.kind}] ${text.slice(0, 500)}`);
  }
  const summary = summaryParts.join("\n---\n");

  try {
    // Dynamic import to avoid hard dependency on inference-engine
    const { inferFromTakeoutText } = await import("@dossier/inference-engine");
    return await inferFromTakeoutText({ endpoint: llmConfig.endpoint, model: llmConfig.model }, summary);
  } catch {
    // Fall back to word-frequency approach on LLM failure
    return inferFromTakeoutArtifactsFallback(artifacts);
  }
}
