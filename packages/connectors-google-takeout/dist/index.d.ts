export type RunTakeoutImportResult = {
    artifactsScanned: number;
    inferencesCreated: number;
    inferencesSuppressed: number;
};
type TakeoutStorePort = {
    repository: {
        addEvidenceSummary(input: {
            sourceLabel: string;
            summaryKind: string;
            summaryJson: Record<string, unknown>;
        }): unknown;
        addRawArtifact(input: {
            sourceLabel: string;
            artifactKind: string;
            encryptedPayloadBase64: string;
            capturedAt: string | null;
        }): unknown;
        createInference(input: {
            text: string;
            itemType: string;
            categoryId: string | null;
            createdVia: "CONNECTOR" | "IMPORT" | "CHAT";
            sourceLabel?: string;
            whyDossierThinksThis?: string | null;
            confidence?: number | null;
            evidenceSummaryId?: string | null;
        }): unknown;
    };
};
export declare function runGoogleTakeoutImport(store: TakeoutStorePort, rootPath: string): RunTakeoutImportResult;
export {};
//# sourceMappingURL=index.d.ts.map