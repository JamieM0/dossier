import type { TakeoutArtifact } from "./parser.js";
export type InferenceProposal = {
    text: string;
    itemType: string;
    why: string;
    confidence: number | null;
};
export declare function inferFromTakeoutArtifacts(artifacts: TakeoutArtifact[]): InferenceProposal[];
//# sourceMappingURL=infer.d.ts.map