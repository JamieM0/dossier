/** Minimal toast queue. Components render `toasts.items` and call
 *  `toasts.show(...)` / `toasts.dismiss(id)`. A toast may carry an
 *  optional action button (label + handler); typically used for the
 *  "Undo" affordance on the recommendations screen. */

export type ToastAction = {
  label: string;
  run: () => void | Promise<void>;
};

export type Toast = {
  id: number;
  message: string;
  action?: ToastAction;
  /** Auto-dismiss after this many ms. 0 = sticky. */
  durationMs: number;
};

let nextId = 1;

class ToastsState {
  items = $state<Toast[]>([]);

  show(message: string, opts: { action?: ToastAction; durationMs?: number } = {}): number {
    const id = nextId++;
    const t: Toast = {
      id,
      message,
      action: opts.action,
      durationMs: opts.durationMs ?? 5000
    };
    this.items = [...this.items, t];
    if (t.durationMs > 0) {
      setTimeout(() => this.dismiss(id), t.durationMs);
    }
    return id;
  }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toasts = new ToastsState();
