export type TakeoutArtifact = {
    path: string;
    kind: "json" | "text";
    content: unknown;
};
export declare function parseTakeoutDirectory(rootPath: string): TakeoutArtifact[];
//# sourceMappingURL=parser.d.ts.map