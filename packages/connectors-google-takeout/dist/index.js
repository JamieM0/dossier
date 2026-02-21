import { inferFromTakeoutArtifacts } from "./infer.js";
import { parseTakeoutDirectory } from "./parser.js";
export function runGoogleTakeoutImport(store, rootPath) {
    const artifacts = parseTakeoutDirectory(rootPath);
    const proposals = inferFromTakeoutArtifacts(artifacts);
    store.repository.addEvidenceSummary({
        sourceLabel: "Google Takeout",
        summaryKind: "takeout_import",
        summaryJson: { artifact_count: artifacts.length, proposal_count: proposals.length }
    });
    for (const artifact of artifacts.slice(0, 50)) {
        store.repository.addRawArtifact({
            sourceLabel: "Google Takeout",
            artifactKind: artifact.kind === "json" ? "json_artifact" : "text_artifact",
            encryptedPayloadBase64: Buffer.from(JSON.stringify(artifact.content), "utf8").toString("base64"),
            capturedAt: null
        });
    }
    let inferencesCreated = 0;
    let inferencesSuppressed = 0;
    for (const proposal of proposals) {
        const result = store.repository.createInference({
            text: proposal.text,
            itemType: proposal.itemType,
            categoryId: null,
            createdVia: "IMPORT",
            sourceLabel: "Google Takeout",
            whyDossierThinksThis: proposal.why,
            confidence: proposal.confidence
        });
        if (result) {
            inferencesCreated += 1;
        }
        else {
            inferencesSuppressed += 1;
        }
    }
    return {
        artifactsScanned: artifacts.length,
        inferencesCreated,
        inferencesSuppressed
    };
}
//# sourceMappingURL=index.js.map