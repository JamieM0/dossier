import type { InferenceEngineConfig, ChatMessage, ChatCompletionResult } from "./types.js";

type OpenAIChatResponse = {
  id: string;
  model: string;
  choices: { index: number; message: { role: string; content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

export async function chatCompletion(
  config: InferenceEngineConfig,
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<ChatCompletionResult> {
  const url = `${config.endpoint.replace(/\/+$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    usage: data.usage
  };
}
