declare module "node:fs" {
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: string): string;
  export function statSync(path: string): { isDirectory(): boolean; size: number };
}

declare module "node:path" {
  export function basename(path: string): string;
  export function extname(path: string): string;
  export function join(...parts: string[]): string;
}

declare module "adm-zip" {
  export default class AdmZip {
    constructor(path: string);
    getEntries(): Array<{
      isDirectory: boolean;
      entryName: string;
      header: { size: number };
      getData(): { toString(encoding: string): string };
    }>;
  }
}

declare const Buffer: {
  from(input: string, encoding?: string): {
    toString(encoding?: string): string;
  };
};
