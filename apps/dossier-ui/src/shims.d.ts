/** Injected at build time by vite.config.ts from apps/dossier-desktop's
 * package.json — the same version `version-bump.py` bumps and tags. */
declare const __APP_VERSION__: string;

declare module "@typescript-eslint/types" {
  export namespace TSESTree {
    interface BaseNode {
      type: string;
    }

    interface Node extends BaseNode {}

    interface Expression extends Node {}
  }
}

declare module "@tauri-apps/api/core" {
  export function invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
}

declare module "@tauri-apps/api/event" {
  export type UnlistenFn = () => void;
  export type Event<T> = { payload: T };
  export function listen<T = unknown>(event: string, handler: (event: Event<T>) => void): Promise<UnlistenFn>;
}

declare module "phosphor-icons-svelte" {
  import type { ComponentType } from "svelte";

  export const Check: ComponentType;
  export const X: ComponentType;
  export const ChatCircle: ComponentType;
  export const GearSix: ComponentType;
  export const LinkSimple: ComponentType;
  export const Question: ComponentType;
  export const User: ComponentType;
  export const Sparkle: ComponentType;
  export const CheckCircle: ComponentType;
  export const CircleNotch: ComponentType;
}
