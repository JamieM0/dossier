import { EventEmitter } from "node:events";
import { DossierStoreService } from "@dossier/store";
import type { LocalServerConfig } from "./types.js";
export declare class LocalProfileServer extends EventEmitter {
    private readonly storeService;
    private readonly config;
    private readonly pairings;
    private readonly usedNonces;
    private server;
    constructor(storeService: DossierStoreService, config?: Partial<LocalServerConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    private requestHandler;
    private authorize;
    private handleCorsPreflight;
}
//# sourceMappingURL=server.d.ts.map