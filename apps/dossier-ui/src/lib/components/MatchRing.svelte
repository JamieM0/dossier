<script lang="ts">
  /** Circular match% indicator — a compact alternative to a text pill,
   * used on poster corners (FilmCard) and the Recommendations hero. */
  let {
    value,
    size = 34
  }: {
    /** 0–100 */
    value: number;
    size?: number
  } = $props();

  const stroke = $derived(Math.max(2, size * 0.09));
  const radius = $derived((size - stroke) / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const offset = $derived(circumference * (1 - Math.max(0, Math.min(100, value)) / 100));
</script>

<div class="ring" style={`width:${size}px;height:${size}px`}>
  <svg viewBox={`0 0 ${size} ${size}`}>
    <circle
      class="track"
      cx={size / 2}
      cy={size / 2}
      r={radius}
      stroke-width={stroke}
      fill="none"
    />
    <circle
      class="fill"
      cx={size / 2}
      cy={size / 2}
      r={radius}
      stroke-width={stroke}
      fill="none"
      stroke-dasharray={circumference}
      stroke-dashoffset={offset}
      transform={`rotate(-90 ${size / 2} ${size / 2})`}
    />
  </svg>
  <span class="label" style={`font-size:${Math.max(9, size * 0.32)}px`}>{Math.round(value)}</span>
</div>

<style>
  .ring {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    border-radius: 999px;
    background: rgba(20, 22, 28, 0.55);
    backdrop-filter: blur(10px) saturate(180%);
    -webkit-backdrop-filter: blur(10px) saturate(180%);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  svg {
    width: 100%;
    height: 100%;
  }
  .track {
    stroke: rgba(255, 255, 255, 0.25);
  }
  .fill {
    stroke: var(--accent);
    stroke-linecap: round;
    transition: stroke-dashoffset var(--duration-standard, 200ms) var(--ease-out, ease-out);
  }
  .label {
    position: absolute;
    color: white;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
</style>
