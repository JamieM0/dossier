import type { LlmAuthMethod, LlmProfile, LlmProviderId } from "$lib/types";

export type LlmProviderDefinition = {
  id: LlmProviderId;
  label: string;
  defaultEndpoint: string;
  defaultModel: string;
  defaultAuthMethod: LlmAuthMethod;
  description: string;
  supportsOllamaDetection: boolean;
};

export const LLM_PROVIDER_DEFINITIONS: LlmProviderDefinition[] = [
  {
    id: "ollama",
    label: "Ollama",
    defaultEndpoint: "http://127.0.0.1:11434/v1",
    defaultModel: "",
    defaultAuthMethod: "apiKey",
    description: "Local runtime on your machine",
    supportsOllamaDetection: true
  },
  {
    id: "custom",
    label: "Custom",
    defaultEndpoint: "",
    defaultModel: "",
    defaultAuthMethod: "apiKey",
    description: "Any OpenAI-compatible endpoint",
    supportsOllamaDetection: false
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultEndpoint: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    defaultAuthMethod: "apiKey",
    description: "Hosted by OpenAI",
    supportsOllamaDetection: false
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultEndpoint: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-latest",
    defaultAuthMethod: "apiKey",
    description: "Hosted by Anthropic",
    supportsOllamaDetection: false
  },
  {
    id: "google",
    label: "Google",
    defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    defaultAuthMethod: "apiKey",
    description: "Gemini via Google AI",
    supportsOllamaDetection: false
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultEndpoint: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/auto",
    defaultAuthMethod: "apiKey",
    description: "Unified routing across models",
    supportsOllamaDetection: false
  },
  {
    id: "grok",
    label: "Grok",
    defaultEndpoint: "https://api.x.ai/v1",
    defaultModel: "grok-2-latest",
    defaultAuthMethod: "apiKey",
    description: "Hosted by xAI",
    supportsOllamaDetection: false
  }
];

const PROVIDER_ID_SET = new Set<LlmProviderId>(
  LLM_PROVIDER_DEFINITIONS.map((provider) => provider.id)
);

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `llm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toProviderId(value: unknown): LlmProviderId {
  if (typeof value === "string" && PROVIDER_ID_SET.has(value as LlmProviderId)) {
    return value as LlmProviderId;
  }
  return "custom";
}

function toAuthMethod(value: unknown): LlmAuthMethod {
  return value === "oauth" ? "oauth" : "apiKey";
}

export function getProviderDefinition(providerId: LlmProviderId): LlmProviderDefinition {
  return (
    LLM_PROVIDER_DEFINITIONS.find((provider) => provider.id === providerId) ??
    LLM_PROVIDER_DEFINITIONS[1]!
  );
}

export function createLlmProfile(providerId: LlmProviderId, name?: string): LlmProfile {
  const provider = getProviderDefinition(providerId);
  return {
    id: uuid(),
    name: name?.trim() || provider.label,
    provider: provider.id,
    endpoint: provider.defaultEndpoint,
    model: provider.defaultModel,
    authMethod: provider.defaultAuthMethod,
    apiKey: "",
    oauthToken: ""
  };
}

function normalizeProfile(input: unknown, index: number): LlmProfile | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const providerId = toProviderId(raw.provider);
  const provider = getProviderDefinition(providerId);
  const name = sanitizeString(raw.name) || `${provider.label} ${index + 1}`;
  const endpoint = sanitizeString(raw.endpoint) || provider.defaultEndpoint;
  const model = sanitizeString(raw.model) || provider.defaultModel;

  return {
    id: sanitizeString(raw.id) || uuid(),
    name,
    provider: providerId,
    endpoint,
    model,
    authMethod: toAuthMethod(raw.authMethod),
    apiKey: sanitizeString(raw.apiKey),
    oauthToken: sanitizeString(raw.oauthToken)
  };
}

function inferLegacyProviderId(endpoint: string): LlmProviderId {
  const lowered = endpoint.toLowerCase();
  if (lowered.includes("127.0.0.1:11434") || lowered.includes("localhost:11434")) {
    return "ollama";
  }
  return "custom";
}

export function normalizeLlmProfiles(input: {
  llmProfiles?: unknown;
  activeLlmProfileId?: unknown;
  localModelEndpoint?: unknown;
  localModelName?: unknown;
}): {
  profiles: LlmProfile[];
  activeLlmProfileId: string | null;
} {
  const parsedProfiles = Array.isArray(input.llmProfiles)
    ? input.llmProfiles
        .map((profile, index) => normalizeProfile(profile, index))
        .filter((profile): profile is LlmProfile => Boolean(profile))
    : [];

  if (parsedProfiles.length === 0) {
    const legacyEndpoint = sanitizeString(input.localModelEndpoint);
    const legacyModel = sanitizeString(input.localModelName);
    if (legacyEndpoint && legacyModel) {
      const providerId = inferLegacyProviderId(legacyEndpoint);
      const provider = getProviderDefinition(providerId);
      parsedProfiles.push({
        id: uuid(),
        name: provider.label,
        provider: providerId,
        endpoint: legacyEndpoint,
        model: legacyModel,
        authMethod: "apiKey",
        apiKey: "",
        oauthToken: ""
      });
    }
  }

  const requestedActiveId = sanitizeString(input.activeLlmProfileId);
  const active =
    parsedProfiles.find((profile) => profile.id === requestedActiveId)?.id ??
    parsedProfiles[0]?.id ??
    null;

  return {
    profiles: parsedProfiles,
    activeLlmProfileId: active
  };
}

export function getActiveLlmProfile(
  profiles: LlmProfile[],
  activeLlmProfileId: string | null
): LlmProfile | null {
  if (profiles.length === 0) {
    return null;
  }
  if (!activeLlmProfileId) {
    return profiles[0] ?? null;
  }
  return profiles.find((profile) => profile.id === activeLlmProfileId) ?? profiles[0] ?? null;
}

export function toLegacyLocalModelSettings(
  profiles: LlmProfile[],
  activeLlmProfileId: string | null
): { localModelEndpoint: string; localModelName: string } {
  const active = getActiveLlmProfile(profiles, activeLlmProfileId);
  if (!active) {
    return { localModelEndpoint: "", localModelName: "" };
  }
  return {
    localModelEndpoint: active.endpoint,
    localModelName: active.model
  };
}

export function isRemoteProvider(providerId: LlmProviderId): boolean {
  return ["openai", "anthropic", "google", "openrouter", "grok"].includes(providerId);
}
