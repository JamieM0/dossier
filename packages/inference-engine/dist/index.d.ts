export type { InferenceEngineConfig, ChatMessage, ChatCompletionResult, InferenceProposal, AlternativeSet } from "./types.js";
export { chatCompletion } from "./client.js";
export { testLlmConnection, type TestConnectionResult } from "./test-connection.js";
export { TAKEOUT_INFERENCE_SYSTEM_PROMPT, CHAT_INFERENCE_SYSTEM_PROMPT, ALTERNATIVES_SYSTEM_PROMPT } from "./prompts.js";
export { inferFromTakeoutText, inferFromChatMessage, generateAlternatives, type ChatInferenceResult } from "./pipelines.js";
//# sourceMappingURL=index.d.ts.map