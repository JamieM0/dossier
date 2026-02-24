import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import AdmZip from "adm-zip";

export const TAKEOUT_PRODUCT_KEYS = [
  "gmail",
  "calendar",
  "youtube",
  "drive",
  "photos",
  "contacts",
  "location",
  "other"
] as const;

export type TakeoutProductKey = (typeof TAKEOUT_PRODUCT_KEYS)[number];

export type TakeoutSourceType = "directory" | "zip";

export type TakeoutArtifact = {
  path: string;
  kind: "json" | "text";
  content: unknown;
  bytes: number;
  productKey: TakeoutProductKey;
  sourceType: TakeoutSourceType;
};

export type TakeoutSourceFile = {
  logicalPath: string;
  bytes: number;
  extension: string;
  parseable: boolean;
  productKey: TakeoutProductKey;
  sourceType: TakeoutSourceType;
  readText: (() => string) | null;
};

export type TakeoutSourceScan = {
  sourceType: TakeoutSourceType;
  files: TakeoutSourceFile[];
  warnings: string[];
};

const PARSEABLE_EXTENSIONS = new Set([
  ".json",
  ".txt",
  ".md",
  ".csv",
  ".ics",
  ".vcf",
  ".html",
  ".mbox",
  ".eml"
]);

function normalizePath(rawPath: string): string {
  return rawPath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function inferProductKey(pathLike: string): TakeoutProductKey {
  const normalized = normalizePath(pathLike).toLowerCase();
  if (normalized.includes("/mail/") || normalized.includes("gmail")) {
    return "gmail";
  }
  if (normalized.includes("/calendar/")) {
    return "calendar";
  }
  if (
    normalized.includes("youtube and youtube music") ||
    normalized.includes("/youtube/") ||
    normalized.includes("/my activity/youtube")
  ) {
    return "youtube";
  }
  if (normalized.includes("/drive/")) {
    return "drive";
  }
  if (normalized.includes("/google photos/") || normalized.includes("/photos/")) {
    return "photos";
  }
  if (normalized.includes("/contacts/")) {
    return "contacts";
  }
  if (
    normalized.includes("location history") ||
    normalized.includes("semantic location history") ||
    normalized.includes("/maps")
  ) {
    return "location";
  }
  return "other";
}

function walkDirectory(path: string, files: string[] = []): string[] {
  const entries = readdirSync(path);
  for (const entry of entries) {
    const full = join(path, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walkDirectory(full, files);
      continue;
    }
    files.push(full);
  }
  return files;
}

function scanDirectorySource(rootPath: string): TakeoutSourceScan {
  const files = walkDirectory(rootPath);
  return {
    sourceType: "directory",
    files: files.map((filePath) => {
      const extension = extname(filePath).toLowerCase();
      const parseable = PARSEABLE_EXTENSIONS.has(extension);
      const logicalPath = normalizePath(filePath);
      const bytes = statSync(filePath).size;
      return {
        logicalPath,
        bytes,
        extension,
        parseable,
        productKey: inferProductKey(logicalPath),
        sourceType: "directory",
        readText: parseable ? () => readFileSync(filePath, "utf8") : null
      } satisfies TakeoutSourceFile;
    }),
    warnings: []
  };
}

function scanZipSource(zipPath: string): TakeoutSourceScan {
  const warnings: string[] = [];
  const zip = new AdmZip(zipPath);
  const files: TakeoutSourceFile[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }
    const logicalPath = normalizePath(entry.entryName);
    const extension = extname(logicalPath).toLowerCase();
    const parseable = PARSEABLE_EXTENSIONS.has(extension);

    files.push({
      logicalPath,
      bytes: entry.header.size,
      extension,
      parseable,
      productKey: inferProductKey(logicalPath),
      sourceType: "zip",
      readText: parseable
        ? () => {
            try {
              return entry.getData().toString("utf8");
            } catch {
              warnings.push(`Unable to decode ${logicalPath} from zip.`);
              return "";
            }
          }
        : null
    });
  }

  return {
    sourceType: "zip",
    files,
    warnings
  };
}

export function scanTakeoutSource(sourcePath: string): TakeoutSourceScan {
  const stats = statSync(sourcePath);
  if (stats.isDirectory()) {
    return scanDirectorySource(sourcePath);
  }

  const extension = extname(sourcePath).toLowerCase();
  if (extension !== ".zip") {
    throw new Error(`Unsupported source: ${basename(sourcePath)}. Select a folder or a .zip file.`);
  }

  return scanZipSource(sourcePath);
}

export function parseTakeoutSourceFiles(
  files: TakeoutSourceFile[],
  onProgress?: (index: number, total: number, currentPath: string) => void
): { artifacts: TakeoutArtifact[]; parseErrors: number } {
  const artifacts: TakeoutArtifact[] = [];
  let parseErrors = 0;
  const parseableFiles = files.filter((file) => file.parseable && file.readText);

  for (const [index, file] of parseableFiles.entries()) {
    onProgress?.(index + 1, parseableFiles.length, file.logicalPath);
    const ext = file.extension;
    try {
      const text = file.readText?.() ?? "";
      if (ext === ".json") {
        artifacts.push({
          path: file.logicalPath,
          kind: "json",
          content: JSON.parse(text) as unknown,
          bytes: file.bytes,
          productKey: file.productKey,
          sourceType: file.sourceType
        });
      } else {
        artifacts.push({
          path: file.logicalPath,
          kind: "text",
          content: text,
          bytes: file.bytes,
          productKey: file.productKey,
          sourceType: file.sourceType
        });
      }
    } catch {
      parseErrors += 1;
    }
  }

  return { artifacts, parseErrors };
}
