declare module "node:fs" {
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: string): string;
  export function statSync(path: string): { isDirectory(): boolean };
}

declare module "node:path" {
  export function extname(path: string): string;
  export function join(...parts: string[]): string;
}

declare const Buffer: {
  from(input: string, encoding?: string): {
    toString(encoding?: string): string;
  };
};
