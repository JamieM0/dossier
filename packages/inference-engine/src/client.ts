import type { InferenceEngineConfig, ChatMessage, ChatCompletionResult } from "./types.js";

const DEFAULT_TIMEOUT_MS = 300_000;

type OpenAIChatResponse = {
  id: string;
  model: string;
  choices: {
    index: number;
    message: { role: string; content: string; reasoning?: string };
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

type OllamaChatResponse = {
  model?: string;
  message?: { role?: string; content?: string };
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
};

function isOpenAIChatResponse(data: unknown): data is OpenAIChatResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "choices" in data &&
    Array.isArray((data as { choices?: unknown }).choices)
  );
}

type AnthropicResponse = {
  id: string;
  model: string;
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
};

function getCredential(config: InferenceEngineConfig): string | undefined {
  if (config.authMethod === "oauth") {
    return config.oauthToken?.trim();
  }
  return config.apiKey?.trim();
}

function authHeaders(config: InferenceEngineConfig): Record<string, string> {
  const token = getCredential(config);
  if (!token) {
    return {};
  }

  if (config.provider === "anthropic") {
    return {
      "x-api-key": token,
      "anthropic-version": "2023-06-01"
    };
  }

  return {
    Authorization: `Bearer ${token}`
  };
}

function normalizeUsage(usage: OpenAIChatResponse["usage"] | undefined):
  | {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    }
  | undefined {
  if (!usage) {
    return undefined;
  }
  return {
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens
  };
}

async function anthropicCompletion(
  config: InferenceEngineConfig,
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<ChatCompletionResult> {
  const url = `${config.endpoint.replace(/\/+$/, "")}/messages`;
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n")
    .trim();
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content }));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(config)
    },
    body: JSON.stringify({
      model: config.model,
      ...(system ? { system } : {}),
      messages: conversation,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 1024
    }),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`LLM request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const content =
    data.content
      ?.map((part) => (part.type === "text" ? part.text ?? "" : ""))
      .join("")
      .trim() ?? "";
  if (!content) {
    throw new Error("LLM returned no content");
  }

  return {
    content,
    model: data.model,
    usage: data.usage
      ? {
          prompt_tokens: data.usage.input_tokens,
          completion_tokens: data.usage.output_tokens,
          total_tokens: data.usage.input_tokens + data.usage.output_tokens
        }
      : undefined
  };
}

export async function chatCompletion(
  config: InferenceEngineConfig,
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number; timeoutMs?: number; think?: boolean }
): Promise<ChatCompletionResult> {
  if (config.provider === "anthropic") {
    return anthropicCompletion(config, messages, opts);
  }

  const url = `${config.endpoint.replace(/\/+$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(config)
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: opts?.temperature ?? 0.7,
      ...(opts?.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {}),
      ...(opts?.think !== undefined ? { think: opts.think } : {})
    }),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`LLM request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as unknown;
  if (isOpenAIChatResponse(data)) {
    const choice = data.choices[0];
    const content =
      (typeof choice?.message?.content === "string" ? choice.message.content.trim() : "") ||
      (typeof choice?.message?.reasoning === "string" ? choice.message.reasoning.trim() : "");
    if (!content) {
      throw new Error("LLM returned no choices");
    }

    return {
      content,
      model: data.model,
      usage: normalizeUsage(data.usage)
    };
  }

  const ollama = data as OllamaChatResponse;

  if (typeof ollama.message?.content === "string" && ollama.message.content.trim()) {
    return {
      content: ollama.message.content,
      model: ollama.model ?? config.model,
      usage:
        typeof ollama.prompt_eval_count === "number" && typeof ollama.eval_count === "number"
          ? {
              prompt_tokens: ollama.prompt_eval_count,
              completion_tokens: ollama.eval_count,
              total_tokens: ollama.prompt_eval_count + ollama.eval_count
            }
          : undefined
    };
  }

  if (typeof ollama.response === "string" && ollama.response.trim()) {
    return {
      content: ollama.response,
      model: ollama.model ?? config.model,
      usage: undefined
    };
  }

  throw new Error("LLM returned no usable content");
}
