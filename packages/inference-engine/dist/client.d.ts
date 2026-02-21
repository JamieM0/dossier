import type { InferenceEngineConfig, ChatMessage, ChatCompletionResult } from "./types.js";
export declare function chatCompletion(config: InferenceEngineConfig, messages: ChatMessage[], opts?: {
    temperature?: number;
    maxTokens?: number;
}): Promise<ChatCompletionResult>;
//# sourceMappingURL=client.d.ts.map