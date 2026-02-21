import type { InferenceEngineConfig, InferenceProposal, AlternativeSet } from "./types.js";
export declare function inferFromTakeoutText(config: InferenceEngineConfig, artifactSummary: string): Promise<InferenceProposal[]>;
export type ChatInferenceResult = {
    reply: string;
    proposals: InferenceProposal[];
};
export declare function inferFromChatMessage(config: InferenceEngineConfig, conversationHistory: {
    role: "user" | "assistant";
    content: string;
}[], userMessage: string): Promise<ChatInferenceResult>;
export declare function generateAlternatives(config: InferenceEngineConfig, text: string, itemType: string, why?: string): Promise<AlternativeSet>;
//# sourceMappingURL=pipelines.d.ts.map