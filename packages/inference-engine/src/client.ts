import type { InferenceEngineConfig, ChatMessage, ChatCompletionResult } from "./types.js";

type OpenAIChatResponse = {
  id: string;
  model: string;
  choices: { index: number; message: { role: string; content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

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
  opts?: { temperature?: number; maxTokens?: number }
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
    signal: AbortSignal.timeout(60_000)
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
  opts?: { temperature?: number; maxTokens?: number }
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
      ...(opts?.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {})
    }),
    signal: AbortSignal.timeout(60_000)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`LLM request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as OpenAIChatResponse;
  const choice = data.choices[0];
  if (!choice) {
    throw new Error("LLM returned no choices");
  }

  return {
    content: choice.message.content,
    model: data.model,
    usage: normalizeUsage(data.usage)
  };
}
