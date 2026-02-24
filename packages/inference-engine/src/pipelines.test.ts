import { afterEach, describe, expect, test, vi } from "vitest";
import { inferFromChatMessage } from "./pipelines.js";
import type { InferenceEngineConfig } from "./types.js";

const baseConfig: InferenceEngineConfig = {
  endpoint: "http://127.0.0.1:11434/v1",
  model: "llama3.1",
  provider: "custom"
};

describe("inferFromChatMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("includes profile context in the single system message", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
      const [systemMessage] = body.messages;

      expect(systemMessage).toBeTruthy();
      expect(systemMessage?.role).toBe("system");
      expect(systemMessage?.content).toContain("PROFILE_CONTEXT_JSON:");
      expect(systemMessage?.content).toContain('"profileItems"');
      expect(body.messages.filter((message) => message.role === "system")).toHaveLength(1);

      return new Response(
        JSON.stringify({
          id: "resp-1",
          model: "llama3.1",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({ reply: "You like jazz.", proposals: [] })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await inferFromChatMessage(
      baseConfig,
      [{ role: "user", content: "hello" }],
      "tell me about myself",
      JSON.stringify({ profileItems: [{ text: "Likes jazz" }] })
    );

    expect(result.reply).toBe("You like jazz.");
    expect(result.proposals).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
