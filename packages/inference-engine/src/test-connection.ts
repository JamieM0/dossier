import { chatCompletion } from "./client.js";
import type { InferenceEngineConfig } from "./types.js";

export type TestConnectionResult = {
  ok: boolean;
  model: string;
  error?: string;
};

export async function testLlmConnection(
  config: InferenceEngineConfig
): Promise<TestConnectionResult> {
  try {
    const result = await chatCompletion(
      config,
      [
        { role: "system", content: "You are a test assistant. Reply with exactly: OK" },
        { role: "user", content: "Are you ready?" }
      ],
      { temperature: 0, maxTokens: 2048, think: false }
    );

    return { ok: true, model: result.model };
  } catch (error) {
    return {
      ok: false,
      model: config.model,
      error: error instanceof Error ? error.message : "Unknown connection error"
    };
  }
}
