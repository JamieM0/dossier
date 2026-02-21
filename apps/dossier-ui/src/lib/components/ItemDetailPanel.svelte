<script lang="ts">
  import { onMount } from "svelte";
  import IconXRegular from "phosphor-icons-svelte/IconXRegular.svelte";
  import IconPencilSimpleRegular from "phosphor-icons-svelte/IconPencilSimpleRegular.svelte";
  import IconTrashRegular from "phosphor-icons-svelte/IconTrashRegular.svelte";
  import IconSpinnerRegular from "phosphor-icons-svelte/IconSpinnerRegular.svelte";
  import type { ItemDetailView, AuditEvent } from "$lib/types";

  let {
    itemId,
    onClose,
    onEdit,
    onDelete
  } = $props<{
    itemId: string;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }>();

  let detail = $state<ItemDetailView | null>(null);
  let loading = $state(true);
  let error = $state("");

  onMount(() => {
    void loadDetail();
  });

  async function loadDetail(): Promise<void> {
    loading = true;
    error = "";
    try {
      const result = await window.dossier?.profile.getItemDetail(itemId);
      detail = result ?? null;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load item detail";
    } finally {
      loading = false;
    }
  }

  function formatTimestamp(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return iso;
    }
  }

  function eventLabel(eventType: string): string {
    const labels: Record<string, string> = {
      ITEM_CREATED: "Created",
      ITEM_EDITED: "Edited",
      INFERENCE_CONFIRMED: "Inference confirmed",
      INFERENCE_CREATED: "Inference proposed",
      INFERENCE_DISMISSED: "Inference dismissed",
      INFERENCE_SUPPRESSED: "Inference suppressed",
      CONSENT_DECIDED: "Consent decided",
      DISCLOSURE_SENT: "Disclosed to service"
    };
    return labels[eventType] ?? eventType.toLowerCase().replace(/_/g, " ");
  }
</script>

<div class="detail-overlay" role="dialog" aria-label="Item detail">
  <div class="detail-panel">
    <div class="detail-header">
      <h2 class="detail-title">Item detail</h2>
      <button class="close-btn" onclick={onClose} aria-label="Close detail panel">
        <IconXRegular class="icon-18" />
      </button>
    </div>

    {#if loading}
      <div class="loading">
        <IconSpinnerRegular class="icon-16 spin" />
        <span>Loading...</span>
      </div>
    {:else if error}
      <p class="error-text">{error}</p>
    {:else if detail}
      <div class="detail-body">
        <div class="detail-section">
          <h3 class="section-label">Text</h3>
          <p class="item-text">{detail.text}</p>
        </div>

        <div class="detail-row">
          <div class="detail-section half">
            <h3 class="section-label">Type</h3>
            <p class="detail-value">{detail.item_type}</p>
          </div>
          <div class="detail-section half">
            <h3 class="section-label">State</h3>
            <p class="detail-value">{detail.state === "CONFIRMED" ? "Confirmed" : "Pending"}</p>
          </div>
        </div>

        {#if detail.provenance}
          <div class="detail-section">
            <h3 class="section-label">Provenance</h3>
            <div class="provenance-detail">
              <p class="detail-value">Source: {detail.provenance.source_label} ({detail.provenance.source_kind})</p>
              {#if detail.provenance.why_dossier_thinks_this}
                <p class="detail-value subtle">Why: {detail.provenance.why_dossier_thinks_this}</p>
              {/if}
              {#if detail.provenance.confidence !== null}
                <p class="detail-value subtle">Confidence: {Math.round(detail.provenance.confidence * 100)}%</p>
              {/if}
            </div>
          </div>
        {/if}

        {#if detail.compartment_ids.length > 0}
          <div class="detail-section">
            <h3 class="section-label">Compartments</h3>
            <div class="badge-list">
              {#each detail.compartment_ids as id}
                <span class="badge">{id}</span>
              {/each}
            </div>
          </div>
        {/if}

        {#if detail.topic}
          <div class="detail-section">
            <h3 class="section-label">Topic blocking</h3>
            <p class="detail-value">
              {detail.topic.is_topic_blocked ? "Blocked" : "Not blocked"}
              {#if detail.topic.block_reason}
                — {detail.topic.block_reason}
              {/if}
            </p>
          </div>
        {/if}

        {#if detail.auditEvents.length > 0}
          <div class="detail-section">
            <h3 class="section-label">Audit trail</h3>
            <div class="timeline">
              {#each detail.auditEvents as event (event.event_id)}
                <div class="timeline-entry">
                  <span class="timeline-dot"></span>
                  <div class="timeline-content">
                    <span class="timeline-label">{eventLabel(event.event_type)}</span>
                    <span class="timeline-time">{formatTimestamp(event.timestamp)}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if detail.editHistory.length > 0}
          <div class="detail-section">
            <h3 class="section-label">Edit history</h3>
            <div class="timeline">
              {#each detail.editHistory as edit (edit.edit_id)}
                <div class="timeline-entry">
                  <span class="timeline-dot"></span>
                  <div class="timeline-content">
                    <span class="timeline-label">Edited by {edit.editor}</span>
                    <span class="timeline-time">{formatTimestamp(edit.edited_at)}</span>
                    <p class="edit-diff">"{edit.before_text}" → "{edit.after_text}"</p>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="detail-actions">
          <button class="action-btn" onclick={onEdit}>
            <IconPencilSimpleRegular class="icon-14" />
            <span>Edit</span>
          </button>
          <button class="action-btn danger" onclick={onDelete}>
            <IconTrashRegular class="icon-14" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .detail-overlay {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 420px;
    max-width: 100vw;
    z-index: 50;
    background: var(--base);
    border-left: 1px solid var(--border);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.08);
    overflow-y: auto;
    animation: slide-in-right var(--duration-moderate) var(--ease-out);
  }

  @keyframes slide-in-right {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .detail-panel {
    padding: var(--space-6);
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-6);
  }

  .detail-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    transition: background-color var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out);
  }

  .close-btn:hover {
    background: var(--base-tertiary);
    color: var(--text-primary);
  }

  .loading {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-8) 0;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    color: var(--text-secondary);
  }

  .loading :global(.spin) {
    animation: spin 1s linear infinite;
  }

  .error-text {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    color: var(--error);
    padding: var(--space-4) 0;
  }

  .detail-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .detail-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .detail-row {
    display: flex;
    gap: var(--space-4);
  }

  .half {
    flex: 1;
  }

  .section-label {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-tertiary);
  }

  .item-text {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    line-height: 1.6;
    color: var(--text-primary);
  }

  .detail-value {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--text-primary);
  }

  .detail-value.subtle {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .provenance-detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .badge-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .badge {
    font-family: var(--font-body);
    font-size: 0.75rem;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-full);
    color: var(--text-secondary);
  }

  .timeline {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-left: var(--space-3);
    border-left: 2px solid var(--border-subtle);
  }

  .timeline-entry {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    position: relative;
  }

  .timeline-dot {
    position: absolute;
    left: calc(-1 * var(--space-3) - 5px);
    top: 4px;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--primary-accent);
  }

  .timeline-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .timeline-label {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    color: var(--text-primary);
  }

  .timeline-time {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
  }

  .edit-diff {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--text-secondary);
    font-style: italic;
    margin-top: var(--space-1);
  }

  .detail-actions {
    display: flex;
    gap: var(--space-2);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-subtle);
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 36px;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
    border: 1px solid var(--border-subtle);
    transition: background-color var(--duration-standard) var(--ease-out),
                color var(--duration-standard) var(--ease-out);
  }

  .action-btn:hover {
    background: var(--base-tertiary);
    color: var(--text-primary);
  }

  .action-btn.danger {
    color: var(--error);
  }

  .action-btn.danger:hover {
    background: var(--error-subtle);
    color: var(--error);
  }

  @media (max-width: 480px) {
    .detail-overlay {
      width: 100vw;
    }
  }
</style>
