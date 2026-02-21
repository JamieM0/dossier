export async function chatCompletion(config, messages, opts) {
    const url = `${config.endpoint.replace(/\/+$/, "")}/chat/completions`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: config.model,
            messages,
            temperature: opts?.temperature ?? 0.7,
            ...(opts?.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {})
        }),
        signal: AbortSignal.timeout(60_000)
    });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`LLM request failed (${response.status}): ${text}`);
    }
    const data = (await response.json());
    const choice = data.choices[0];
    if (!choice) {
        throw new Error("LLM returned no choices");
    }
    return {
        content: choice.message.content,
        model: data.model,
        usage: data.usage
    };
}
//# sourceMappingURL=client.js.map