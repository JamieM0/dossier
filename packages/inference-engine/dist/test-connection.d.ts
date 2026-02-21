import type { InferenceEngineConfig } from "./types.js";
export type TestConnectionResult = {
    ok: boolean;
    model: string;
    error?: string;
};
export declare function testLlmConnection(config: InferenceEngineConfig): Promise<TestConnectionResult>;
//# sourceMappingURL=test-connection.d.ts.map