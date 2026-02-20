declare module "@typescript-eslint/types" {
  export namespace TSESTree {
    interface BaseNode {
      type: string;
    }

    interface Node extends BaseNode {}

    interface Expression extends Node {}
  }
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
