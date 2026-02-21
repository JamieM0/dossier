<script lang="ts">
  import { onMount } from "svelte";
  import IconArrowSquareOutRegular from "phosphor-icons-svelte/IconArrowSquareOutRegular.svelte";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import type { ServiceConnectionStatus } from "$lib/types";

  let services = $state<ServiceConnectionStatus[]>([]);
  let statusMessage = $state("");
  let errorMessage = $state("");
  let statusTimeout: ReturnType<typeof setTimeout> | undefined;

  let revokeTarget = $state<ServiceConnectionStatus | null>(null);

  function setStatus(msg: string, isError = false): void {
    clearTimeout(statusTimeout);
    if (isError) {
      errorMessage = msg;
      statusMessage = "";
    } else {
      statusMessage = msg;
      errorMessage = "";
    }
    statusTimeout = setTimeout(() => {
      statusMessage = "";
      errorMessage = "";
    }, 4000);
  }

  async function refresh(): Promise<void> {
    services = (await window.dossier?.services.list()) ?? [];
  }

  function requestRevoke(service: ServiceConnectionStatus): void {
    revokeTarget = service;
  }

  async function confirmRevoke(): Promise<void> {
    if (!revokeTarget) return;
    const service = revokeTarget;
    revokeTarget = null;

    try {
      await window.dossier?.services.revoke(service.service_id);
      setStatus(`Revoked access for ${service.display_name}.`);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to revoke service.";
      setStatus(message, true);
    }
  }

  onMount(() => {
    void refresh();
  });
</script>

<section class="connections-view">
  <div class="connections-content">
    <h1 class="page-heading">Connected Services</h1>

    {#if statusMessage}
      <p class="status ok">{statusMessage}</p>
    {/if}
    {#if errorMessage}
      <p class="status err">{errorMessage}</p>
    {/if}

    <div class="services-list">
      {#if services.length === 0}
        <p class="empty">No registered services found.</p>
      {/if}

      {#each services as service (service.service_id)}
        <article class="service-card">
          <div class="service-header">
            <div class="service-icon">
              <IconArrowSquareOutRegular class="icon-20" />
            </div>
            <div class="service-info">
              <h3 class="service-name">{service.display_name}</h3>
              <span class="consent-badge">{service.policy_mode === "ALWAYS_ASK" ? "Always ask" : service.policy_mode}</span>
              <span class="status-pill" class:paired={service.status === "PAIRED"}>{service.status === "PAIRED" ? "Connected" : "Not connected"}</span>
            </div>
          </div>

          <div class="service-access">
            <p class="access-label">Allowed origins</p>
            {#if service.allowed_origins_json.length === 0}
              <p class="access-value">None</p>
            {:else}
              <ul class="access-items">
                {#each service.allowed_origins_json as origin}
                  <li>{origin}</li>
                {/each}
              </ul>
            {/if}
          </div>

          <div class="service-actions">
            <button
              class="btn-danger-sm"
              disabled={service.status !== "PAIRED"}
              onclick={() => requestRevoke(service)}
            >
              Revoke access
            </button>
          </div>
        </article>
      {/each}
    </div>
  </div>
</section>

{#if revokeTarget}
  <ConfirmDialog
    title="Revoke access"
    message="Revoke all access for {revokeTarget.display_name}? This service will no longer be able to read your profile data."
    confirmLabel="Revoke"
    cancelLabel="Keep access"
    danger
    onConfirm={confirmRevoke}
    onCancel={() => (revokeTarget = null)}
  />
{/if}

<style>
  .connections-view {
    min-height: 100vh;
    background: var(--base);
  }

  .connections-content {
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--space-10) var(--space-8) var(--space-16);
  }

  .page-heading {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    margin-bottom: var(--space-8);
  }

  .status {
    margin-bottom: var(--space-4);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-body);
    font-size: 0.8125rem;
  }

  .status.ok {
    background: var(--success-subtle);
    color: var(--success);
  }

  .status.err {
    background: var(--error-subtle);
    color: var(--error);
  }

  .empty {
    color: var(--text-tertiary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
  }

  .services-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .service-card {
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    padding: var(--space-6);
    transition: box-shadow var(--duration-standard) var(--ease-out);
  }

  .service-card:hover {
    box-shadow: var(--shadow-md);
  }

  .service-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .service-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    background: var(--base-tertiary);
    color: var(--text-secondary);
  }

  .service-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .service-name {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    font-weight: 500;
    line-height: 1.6;
    color: var(--text-primary);
  }

  .consent-badge,
  .status-pill {
    font-family: var(--font-body);
    font-size: 0.75rem;
    line-height: 1.4;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
  }

  .status-pill.paired {
    border-color: var(--success);
    color: var(--success);
  }

  .service-access {
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--border-subtle);
  }

  .access-label {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-tertiary);
    margin-bottom: var(--space-2);
  }

  .access-value {
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.8125rem;
  }

  .access-items {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.8125rem;
  }

  .service-actions {
    display: flex;
    gap: var(--space-3);
  }

  .btn-danger-sm {
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--error);
    color: #ffffff;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 600;
    box-shadow: var(--shadow-sm);
    transition: background-color var(--duration-standard) var(--ease-out),
                box-shadow var(--duration-standard) var(--ease-out);
  }

  .btn-danger-sm:hover:not(:disabled) {
    background: color-mix(in srgb, var(--error) 85%, #000);
    box-shadow: var(--shadow-md);
  }

  .btn-danger-sm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
