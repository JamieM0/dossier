import type { TakeoutArtifact } from "./parser.js";
export type InferenceProposal = {
    text: string;
    itemType: string;
    why: string;
    confidence: number | null;
};
export type LlmConfig = {
    endpoint: string;
    model: string;
};
export declare function inferFromTakeoutArtifacts(artifacts: TakeoutArtifact[], llmConfig?: LlmConfig | null): Promise<InferenceProposal[]>;
//# sourceMappingURL=infer.d.ts.map