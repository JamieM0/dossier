<script lang="ts">
  import { onMount } from "svelte";
  import IconCheckCircleRegular from "phosphor-icons-svelte/IconCheckCircleRegular.svelte";
  import IconPaperPlaneRightRegular from "phosphor-icons-svelte/IconPaperPlaneRightRegular.svelte";
  import IconSparkleRegular from "phosphor-icons-svelte/IconSparkleRegular.svelte";
  import IconWarningRegular from "phosphor-icons-svelte/IconWarningRegular.svelte";
  import type { LlmInferenceProposal, ChatMessage } from "$lib/types";
  import { uiSettings } from "$lib/state/ui-settings.svelte";

  type Message = {
    id: string;
    role: "user" | "system";
    text: string;
    isLlmMessage?: boolean;
    proposals?: LlmInferenceProposal[];
    dataUpdate?: string;
  };

  let input = $state("");
  let messages = $state<Message[]>([
    {
      id: "1",
      role: "system",
      text: "Tell me about yourself, and I'll help build your profile. I can extract preferences, interests, and facts from our conversation."
    }
  ]);
  let chatLogRef = $state<HTMLElement | null>(null);
  let textareaRef = $state<HTMLTextAreaElement | null>(null);
  let isSending = $state(false);

  const hasLlm = $derived(Boolean(uiSettings.localModelEndpoint && uiSettings.localModelName));

  function buildHistory(): ChatMessage[] {
    return messages
      .filter((msg) => msg.role === "user" || (msg.role === "system" && msg.isLlmMessage))
      .map((msg) => ({
        role: msg.role === "user" ? "user" as const : "assistant" as const,
        content: msg.text
      }));
  }

  async function send(): Promise<void> {
    if (!input.trim() || isSending) return;

    const userText = input.trim();
    input = "";
    isSending = true;

    messages = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", text: userText }
    ];

    try {
      const result = await window.dossier?.llm.chat(buildHistory(), userText);

      if (!result) {
        messages = [
          ...messages,
          { id: crypto.randomUUID(), role: "system", text: "Unable to connect to the chat service." }
        ];
        return;
      }

      const createdCount = result.createdItems?.length ?? 0;
      messages = [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: result.reply,
          isLlmMessage: true,
          proposals: result.proposals.length > 0 ? result.proposals : undefined,
          dataUpdate: createdCount > 0
            ? `${createdCount} inference${createdCount > 1 ? "s" : ""} added to your profile`
            : undefined
        }
      ];
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send message.";
      messages = [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: `Error: ${message}`
        }
      ];
    } finally {
      isSending = false;
      requestAnimationFrame(() => {
        chatLogRef?.scrollTo({ top: chatLogRef.scrollHeight, behavior: "smooth" });
      });
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void send();
    }
    if (event.key === "Escape" && !input.trim()) {
      (event.target as HTMLElement)?.blur();
    }
  }

  onMount(() => {
    textareaRef?.focus();
  });
</script>

<section class="chat-view">
  <div class="chat-content">
    <h1 class="page-heading">Chat</h1>

    {#if !hasLlm}
      <div class="warning-banner">
        <IconWarningRegular class="icon-16" />
        <span>No AI model configured. Chat will store messages directly as inferences. Configure a model in Settings for conversational AI.</span>
      </div>
    {/if}

    <div class="chat-log" bind:this={chatLogRef} aria-live="polite" aria-relevant="additions">
      {#each messages as message (message.id)}
        <article class="message {message.role}">
          <div class="bubble {message.role}">
            {message.text}
          </div>
          {#if message.proposals && message.proposals.length > 0}
            <div class="proposals-list">
              {#each message.proposals as proposal}
                <div class="proposal-card">
                  <div class="proposal-header">
                    <IconSparkleRegular class="icon-14" />
                    <span class="proposal-type">{proposal.itemType}</span>
                    {#if proposal.confidence !== null}
                      <span class="proposal-confidence">{Math.round(proposal.confidence * 100)}%</span>
                    {/if}
                  </div>
                  <p class="proposal-text">{proposal.text}</p>
                  {#if proposal.why}
                    <p class="proposal-why">{proposal.why}</p>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
          {#if message.dataUpdate}
            <div class="data-update-card">
              <IconCheckCircleRegular class="icon-16" />
              <span>{message.dataUpdate}</span>
            </div>
          {/if}
        </article>
      {/each}
    </div>

    <div class="chat-input-area">
      <div class="input-wrapper">
        <textarea
          class="chat-textarea"
          bind:this={textareaRef}
          bind:value={input}
          placeholder={hasLlm ? "Tell Dossier about yourself..." : "Describe a profile update to propose"}
          rows="3"
          onkeydown={handleKeydown}
          disabled={isSending}
        ></textarea>
        <button
          class="send-btn"
          onclick={() => void send()}
          disabled={!input.trim() || isSending}
          aria-label="Send message"
        >
          <IconPaperPlaneRightRegular class="icon-18" />
        </button>
      </div>
    </div>
  </div>
</section>

<style>
  .chat-view {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--base);
  }

  .chat-content {
    max-width: var(--content-max-width);
    width: 100%;
    margin: 0 auto;
    padding: var(--space-10) var(--space-8) 0;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: calc(100vh - var(--space-10));
  }

  .page-heading {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    margin-bottom: var(--space-6);
    flex-shrink: 0;
  }

  .warning-banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--warning-subtle);
    border-left: 3px solid var(--warning);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--warning);
    margin-bottom: var(--space-4);
    flex-shrink: 0;
  }

  .chat-log {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-bottom: var(--space-4);
  }

  .message {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    animation: entrance-fade-up var(--duration-moderate) var(--ease-out);
  }

  .message.user {
    align-items: flex-end;
  }

  .message.system {
    align-items: flex-start;
  }

  .bubble {
    max-width: 85%;
    padding: var(--space-4);
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .bubble.user {
    background: var(--primary-accent);
    color: var(--primary-accent-text);
  }

  .bubble.system {
    background: var(--base-secondary);
    color: var(--text-primary);
  }

  .proposals-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-width: 85%;
  }

  .proposal-card {
    padding: var(--space-3) var(--space-4);
    background: var(--base-secondary);
    border-left: 3px solid var(--secondary-accent);
    border-radius: var(--radius-sm);
    animation: entrance-fade-up var(--duration-standard) var(--ease-out);
  }

  .proposal-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
    color: var(--secondary-accent);
  }

  .proposal-type {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .proposal-confidence {
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }

  .proposal-text {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-primary);
  }

  .proposal-why {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-tertiary);
    margin-top: var(--space-1);
  }

  .data-update-card {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--success-subtle);
    border-left: 3px solid var(--success);
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--success);
    max-width: 85%;
  }

  .chat-input-area {
    flex-shrink: 0;
    padding: var(--space-4) 0 var(--space-8);
  }

  .input-wrapper {
    position: relative;
  }

  .chat-textarea {
    width: 100%;
    min-height: 80px;
    max-height: 200px;
    padding: var(--space-3) var(--space-4);
    padding-right: calc(var(--space-4) + 44px);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-primary);
    background: var(--base-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    resize: vertical;
    transition: border-color var(--duration-standard) var(--ease-out),
                background-color var(--duration-standard) var(--ease-out);
  }

  .chat-textarea::placeholder {
    color: var(--text-tertiary);
  }

  .chat-textarea:focus {
    outline: none;
    border-color: var(--primary-accent);
    background: var(--base);
  }

  .chat-textarea:disabled {
    opacity: 0.6;
  }

  .send-btn {
    position: absolute;
    bottom: var(--space-3);
    right: var(--space-3);
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    background: var(--primary-accent);
    color: var(--primary-accent-text);
    transition: background-color var(--duration-standard) var(--ease-out),
                opacity var(--duration-standard) var(--ease-out);
  }

  .send-btn:hover:not(:disabled) {
    background: var(--primary-accent-hover);
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
