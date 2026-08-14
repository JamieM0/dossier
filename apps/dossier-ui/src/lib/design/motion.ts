import { animate, hover, inView, press, stagger } from "motion";

function reduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function motionPress(node: HTMLElement, options: { scale?: number } = {}) {
  const scale = options.scale ?? 0.975;
  const stop = press(node, (element) => {
    if (!reduced()) void animate(element, { scale }, { type: "spring", stiffness: 720, damping: 38 });
    return () => {
      if (!reduced()) void animate(element, { scale: 1 }, { type: "spring", stiffness: 520, damping: 30 });
    };
  });
  return { destroy: stop };
}

export function motionHoverLift(node: HTMLElement, options: { y?: number; scale?: number } = {}) {
  const stop = hover(node, (element) => {
    if (!reduced()) void animate(element, { y: options.y ?? -3, scale: options.scale ?? 1.012 }, { type: "spring", stiffness: 430, damping: 32 });
    return () => {
      if (!reduced()) void animate(element, { y: 0, scale: 1 }, { type: "spring", stiffness: 400, damping: 31 });
    };
  });
  return { destroy: stop };
}

export function motionReveal(node: HTMLElement, options: { delay?: number; y?: number } = {}) {
  if (reduced()) return {};
  node.style.opacity = "0";
  const stop = inView(node, (element) => {
    void animate(element, { opacity: 1, y: [options.y ?? 10, 0] }, { duration: 0.42, delay: options.delay ?? 0, ease: [0.16, 1, 0.3, 1] });
  }, { amount: 0.12 });
  return { destroy: stop };
}

export function motionStaggerChildren(node: HTMLElement) {
  if (reduced()) return {};
  const children = Array.from(node.children) as HTMLElement[];
  for (const child of children) child.style.opacity = "0";
  const stop = inView(node, () => {
    void animate(children, { opacity: 1, y: [9, 0] }, { duration: 0.38, delay: stagger(0.045), ease: [0.16, 1, 0.3, 1] });
  }, { amount: 0.08 });
  return { destroy: stop };
}

export function glassPointer(node: HTMLElement) {
  function move(event: PointerEvent) {
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--glass-x", `${event.clientX - rect.left}px`);
    node.style.setProperty("--glass-y", `${event.clientY - rect.top}px`);
  }
  node.addEventListener("pointermove", move);
  return { destroy: () => node.removeEventListener("pointermove", move) };
}
