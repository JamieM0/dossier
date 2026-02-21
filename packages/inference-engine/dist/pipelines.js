import { chatCompletion } from "./client.js";
import { TAKEOUT_INFERENCE_SYSTEM_PROMPT, CHAT_INFERENCE_SYSTEM_PROMPT, ALTERNATIVES_SYSTEM_PROMPT } from "./prompts.js";
function tryParseJson(text) {
    const trimmed = text.trim();
    // Strip markdown code fences if present
    const cleaned = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    try {
        return JSON.parse(cleaned);
    }
    catch {
        return null;
    }
}
function isProposalArray(value) {
    if (!Array.isArray(value))
        return false;
    return value.every((item) => typeof item === "object" &&
        item !== null &&
        typeof item.text === "string" &&
        typeof item.itemType === "string");
}
export async function inferFromTakeoutText(config, artifactSummary) {
    const result = await chatCompletion(config, [
        { role: "system", content: TAKEOUT_INFERENCE_SYSTEM_PROMPT },
        {
            role: "user",
            content: `Analyse the following imported data and extract profile inferences:\n\n${artifactSummary}`
        }
    ]);
    const parsed = tryParseJson(result.content);
    if (isProposalArray(parsed)) {
        return parsed;
    }
    // Try extracting proposals from nested object
    if (parsed && typeof parsed === "object" && "proposals" in parsed) {
        const proposals = parsed.proposals;
        if (isProposalArray(proposals)) {
            return proposals;
        }
    }
    return [];
}
export async function inferFromChatMessage(config, conversationHistory, userMessage) {
    const messages = [
        { role: "system", content: CHAT_INFERENCE_SYSTEM_PROMPT },
        ...conversationHistory.map((msg) => ({
            role: msg.role,
            content: msg.content
        })),
        { role: "user", content: userMessage }
    ];
    const result = await chatCompletion(config, messages);
    const parsed = tryParseJson(result.content);
    if (parsed &&
        typeof parsed === "object" &&
        typeof parsed.reply === "string") {
        const obj = parsed;
        return {
            reply: obj.reply,
            proposals: isProposalArray(obj.proposals) ? obj.proposals : []
        };
    }
    // If we can't parse structured response, treat the whole thing as a reply
    return { reply: result.content, proposals: [] };
}
export async function generateAlternatives(config, text, itemType, why) {
    const context = why ? `\n\nOriginal evidence: ${why}` : "";
    const result = await chatCompletion(config, [
        { role: "system", content: ALTERNATIVES_SYSTEM_PROMPT },
        {
            role: "user",
            content: `Statement: "${text}"\nItem type: ${itemType}${context}`
        }
    ]);
    const parsed = tryParseJson(result.content);
    if (parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.alternatives)) {
        const alts = parsed.alternatives;
        const valid = alts.filter((alt) => typeof alt === "object" &&
            alt !== null &&
            typeof alt.text === "string" &&
            typeof alt.reason === "string");
        return { original: text, alternatives: valid };
    }
    return { original: text, alternatives: [] };
}
//# sourceMappingURL=pipelines.js.map