export type InferenceEngineConfig = {
    endpoint: string;
    model: string;
};
export type ChatMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};
export type ChatCompletionResult = {
    content: string;
    model: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    } | undefined;
};
export type InferenceProposal = {
    text: string;
    itemType: string;
    why: string;
    confidence: number | null;
};
export type AlternativeSet = {
    original: string;
    alternatives: {
        text: string;
        reason: string;
    }[];
};
//# sourceMappingURL=types.d.ts.map