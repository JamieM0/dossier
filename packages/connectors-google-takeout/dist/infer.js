function normalizeTokens(input) {
    return input
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4);
}
export function inferFromTakeoutArtifacts(artifacts) {
    const tokenCounts = new Map();
    for (const artifact of artifacts) {
        const text = typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content);
        for (const token of normalizeTokens(text)) {
            tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
        }
    }
    const frequentTokens = [...tokenCounts.entries()]
        .filter(([, count]) => count >= 15)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    return frequentTokens.map(([token, count]) => ({
        text: `You frequently engage with content related to "${token}"`,
        itemType: "interest",
        why: `Appears ${count} times across imported Google Takeout artifacts`,
        confidence: Math.min(0.92, 0.45 + count / 200)
    }));
}
//# sourceMappingURL=infer.js.map