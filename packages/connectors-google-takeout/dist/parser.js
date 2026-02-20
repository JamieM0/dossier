import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
function walk(path, files = []) {
    const entries = readdirSync(path);
    for (const entry of entries) {
        const full = join(path, entry);
        const stats = statSync(full);
        if (stats.isDirectory()) {
            walk(full, files);
            continue;
        }
        files.push(full);
    }
    return files;
}
export function parseTakeoutDirectory(rootPath) {
    const files = walk(rootPath);
    const artifacts = [];
    for (const file of files) {
        const ext = extname(file).toLowerCase();
        try {
            if (ext === ".json") {
                const raw = readFileSync(file, "utf8");
                artifacts.push({ path: file, kind: "json", content: JSON.parse(raw) });
            }
            else if ([".txt", ".md", ".csv"].includes(ext)) {
                artifacts.push({ path: file, kind: "text", content: readFileSync(file, "utf8") });
            }
        }
        catch {
            // Corrupt artifacts are ignored here and surfaced at higher layers.
        }
    }
    return artifacts;
}
//# sourceMappingURL=parser.js.map