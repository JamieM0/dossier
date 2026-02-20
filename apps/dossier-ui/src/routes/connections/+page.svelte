<script lang="ts">
  import IconArrowSquareOutRegular from "phosphor-icons-svelte/IconArrowSquareOutRegular.svelte";
</script>

<section class="connections-view">
  <div class="connections-content">
    <h1 class="page-heading">Connected Services</h1>

    <div class="services-list">
      <article class="service-card">
        <div class="service-header">
          <div class="service-icon">
            <IconArrowSquareOutRegular class="icon-20" />
          </div>
          <div class="service-info">
            <h3 class="service-name">Perspectives</h3>
            <span class="consent-badge">Always ask</span>
          </div>
        </div>

        <div class="service-access">
          <p class="access-label">Can access:</p>
          <ul class="access-items">
            <li>Communication preferences</li>
            <li>Topic boundaries</li>
          </ul>
        </div>

        <div class="service-actions">
          <button class="btn-secondary">Manage</button>
          <button class="btn-danger-sm">Revoke all access</button>
        </div>
      </article>
    </div>
  </div>
</section>

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
    transition: box-shadow var(--duration-standard) var(--ease-out),
                border-color var(--duration-standard) var(--ease-out);
  }

  .service-card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--border);
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
    gap: var(--space-3);
  }

  .service-name {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    font-weight: 500;
    line-height: 1.6;
    color: var(--text-primary);
  }

  .consent-badge {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 400;
    line-height: 1.4;
    color: var(--text-tertiary);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
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

  .access-items {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .access-items li {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-secondary);
    padding-left: var(--space-3);
    position: relative;
  }

  .access-items li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 7px;
    width: 4px;
    height: 4px;
    border-radius: var(--radius-full);
    background: var(--text-tertiary);
  }

  .service-actions {
    display: flex;
    gap: var(--space-3);
  }

  .btn-secondary {
    min-height: 40px;
    min-width: 80px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    border: 1px solid var(--border);
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-secondary:hover {
    background: var(--base-tertiary);
  }

  .btn-danger-sm {
    min-height: 40px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--error);
    color: #ffffff;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 600;
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-danger-sm:hover {
    background: color-mix(in srgb, var(--error) 85%, #000);
  }
</style>
