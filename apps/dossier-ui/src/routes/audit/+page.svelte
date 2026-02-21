<script lang="ts">
  import { onMount } from "svelte";
  import type { AuditEvent, ServiceConnectionStatus } from "$lib/types";

  type AuditView = "shared" | "used";

  const SHARED_TYPES = ["CONSENT_DECIDED", "DISCLOSURE_SENT", "DISCLOSURE_BLOCKED_ITEM_OVERRIDDEN"];
  const USED_TYPES = ["OUTPUT_USED_ITEM", "INFERENCE_CREATED", "INFERENCE_CONFIRMED", "INFERENCE_SUPPRESSED"];

  const EVENT_LABELS: Record<string, string> = {
    CONSENT_DECIDED: "Consent decided",
    DISCLOSURE_SENT: "Data shared",
    DISCLOSURE_BLOCKED_ITEM_OVERRIDDEN: "Blocked item override",
    OUTPUT_USED_ITEM: "Item used internally",
    INFERENCE_CREATED: "Inference created",
    INFERENCE_CONFIRMED: "Inference confirmed",
    INFERENCE_SUPPRESSED: "Inference suppressed"
  };

  let activeView = $state<AuditView>("shared");
  let events = $state<AuditEvent[]>([]);
  let services = $state<ServiceConnectionStatus[]>([]);
  let isLoading = $state(false);
  let status = $state("");

  let serviceFilter = $state("");
  let itemFilter = $state("");
  let dateFrom = $state("");
  let dateTo = $state("");

  function activeEventTypes(): string[] {
    return activeView === "shared" ? SHARED_TYPES : USED_TYPES;
  }

  function humanizeEventType(raw: string): string {
    return EVENT_LABELS[raw] ?? raw.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }

  function formatTimestamp(iso: string): string {
    try {
      const date = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 1) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 1 ? "Just now" : `${diffMinutes} minutes ago`;
      }
      if (diffHours < 24) {
        return `${Math.floor(diffHours)} hours ago`;
      }
      if (diffHours < 48) {
        return "Yesterday";
      }
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return iso;
    }
  }

  function formatDetails(json: unknown): { key: string; value: string }[] {
    if (!json || typeof json !== "object") return [];
    const entries: { key: string; value: string }[] = [];
    for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
      const label = key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
      entries.push({ key: label, value: typeof value === "string" ? value : JSON.stringify(value) });
    }
    return entries;
  }

  async function loadAudit(): Promise<void> {
    isLoading = true;
    status = "";
    try {
      const response = await window.dossier?.audit.list({
        eventType: activeEventTypes(),
        service: serviceFilter.trim() || undefined,
        item: itemFilter.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });
      events = (response?.events ?? []).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
      status = `${events.length} ${events.length === 1 ? "event" : "events"}`;
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
      events = [];
    } finally {
      isLoading = false;
    }
  }

  async function loadServices(): Promise<void> {
    services = (await window.dossier?.services.list()) ?? [];
  }

  onMount(() => {
    void loadAudit();
    void loadServices();
  });
</script>

<section class="audit-view">
  <div class="audit-content">
    <h1 class="page-heading">Audit</h1>

    <div class="tab-row" role="tablist" aria-label="Audit view">
      <button
        class="tab"
        class:active={activeView === "shared"}
        onclick={() => { activeView = "shared"; void loadAudit(); }}
        role="tab"
        aria-selected={activeView === "shared"}
        id="tab-shared"
        aria-controls="panel-shared"
      >
        Shared externally
      </button>
      <button
        class="tab"
        class:active={activeView === "used"}
        onclick={() => { activeView = "used"; void loadAudit(); }}
        role="tab"
        aria-selected={activeView === "used"}
        id="tab-used"
        aria-controls="panel-used"
      >
        Used by Dossier
      </button>
    </div>

    <div class="filters">
      <select class="text-input" bind:value={serviceFilter}>
        <option value="">All services</option>
        {#each services as service}
          <option value={service.service_id}>{service.display_name}</option>
        {/each}
      </select>
      <input class="text-input" bind:value={itemFilter} placeholder="Item text filter" />
      <input class="text-input" type="date" bind:value={dateFrom} aria-label="Date from" />
      <input class="text-input" type="date" bind:value={dateTo} aria-label="Date to" />
      <button class="btn-secondary" onclick={() => void loadAudit()} disabled={isLoading}>
        Apply
      </button>
    </div>

    <p class="status-text">{status}</p>

    <div
      class="events"
      role="tabpanel"
      id={activeView === "shared" ? "panel-shared" : "panel-used"}
      aria-labelledby={activeView === "shared" ? "tab-shared" : "tab-used"}
    >
      {#if events.length === 0 && !isLoading}
        <p class="empty">No matching audit events.</p>
      {/if}

      {#each events as event (event.event_id)}
        <article class="event-card">
          <header>
            <h2 class="event-type">{humanizeEventType(event.event_type)}</h2>
            <time class="event-time">{formatTimestamp(event.timestamp)}</time>
          </header>
          <div class="event-meta">
            <span><strong>Actor:</strong> {event.actor}</span>
            {#if event.service_id}
              <span><strong>Service:</strong> {services.find((s) => s.service_id === event.service_id)?.display_name ?? event.service_id}</span>
            {/if}
            {#if event.item_id}
              <span><strong>Item:</strong> {event.item_id}</span>
            {/if}
          </div>
          {#if event.details_json}
            {@const details = formatDetails(event.details_json)}
            {#if details.length > 0}
              <div class="event-details">
                {#each details as detail}
                  <div class="detail-row">
                    <span class="detail-key">{detail.key}</span>
                    <span class="detail-value">{detail.value}</span>
                  </div>
                {/each}
              </div>
            {/if}
          {/if}
        </article>
      {/each}
    </div>
  </div>
</section>

<style>
  .audit-view {
    min-height: 100vh;
    background: var(--base);
  }

  .audit-content {
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--space-10) var(--space-8) var(--space-16);
  }

  .page-heading {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--space-5);
  }

  .tab-row {
    display: flex;
    gap: var(--space-1);
    margin-bottom: var(--space-4);
    border-bottom: 1px solid var(--border-subtle);
  }

  .tab {
    min-height: 44px;
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 400;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color var(--duration-standard) var(--ease-out),
                border-color var(--duration-standard) var(--ease-out);
  }

  .tab:hover {
    color: var(--text-primary);
  }

  .tab.active {
    color: var(--text-primary);
    font-weight: 500;
    border-bottom-color: var(--primary-accent);
  }

  .filters {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr auto;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .text-input {
    min-height: 44px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    background: var(--base-tertiary);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    padding: var(--space-3) var(--space-4);
    transition: border-color var(--duration-standard) var(--ease-out),
                background-color var(--duration-standard) var(--ease-out);
  }

  .text-input::placeholder {
    color: var(--text-tertiary);
  }

  .text-input:focus {
    outline: none;
    border-color: var(--primary-accent);
    background: var(--base);
  }

  .btn-secondary {
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-secondary:hover {
    background: var(--base-tertiary);
  }

  .status-text {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-bottom: var(--space-3);
  }

  .events {
    display: grid;
    gap: var(--space-3);
  }

  .event-card {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--base-secondary);
    padding: var(--space-4);
    transition: box-shadow var(--duration-standard) var(--ease-out);
  }

  .event-card:hover {
    box-shadow: var(--shadow-sm);
  }

  .event-card header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .event-type {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .event-time {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    white-space: nowrap;
  }

  .event-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
  }

  .event-details {
    margin-top: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--base);
    border: 1px solid var(--border-subtle);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--border-subtle);
    font-family: var(--font-body);
    font-size: 0.8125rem;
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .detail-key {
    color: var(--text-tertiary);
    font-weight: 500;
  }

  .detail-value {
    color: var(--text-secondary);
    text-align: right;
    word-break: break-word;
  }

  .empty {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    color: var(--text-tertiary);
    text-align: center;
    padding: var(--space-10) 0;
  }

  @media (max-width: 960px) {
    .filters {
      grid-template-columns: 1fr 1fr;
    }

    .audit-content {
      padding: var(--space-8) var(--space-4) var(--space-12);
    }
  }

  @media (max-width: 600px) {
    .filters {
      grid-template-columns: 1fr;
    }
  }
</style>
