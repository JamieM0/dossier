import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, closeSync, existsSync, linkSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { createDefaultState, withDefaults, type PersistedState } from "@dossier/domain";
import { decryptJson, encryptJson, type EncryptedBlob } from "@dossier/store";

export type Profile = { id: string; name: string; archived: boolean; revision: number; state: PersistedState };
export type Vault = { activeId: string | null; profiles: Profile[] };
const SERVICE = "Dossier CLI";
const KEY_ACCOUNT = "master-key";

export function cliRoot(): string {
  const root = resolve(process.env.DOSSIER_CLI_HOME ?? join(homedir(), "Library", "Application Support", "Dossier", "cli"));
  const guiRoots = [
    join(homedir(), "Library", "Application Support", "com.dossier.desktop"),
    join(homedir(), "Library", "Application Support", "Dossier", "dossier")
  ].map((path) => resolve(path));
  if (guiRoots.some((gui) => root === gui || root.startsWith(gui + sep) || gui.startsWith(root + sep))) throw new Error("CLI data root overlaps the GUI store");
  return root;
}

function secureDirectory(path: string): void {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error("CLI data root must not be a symlink");
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}

function writePrivate(path: string, content: string): void {
  secureDirectory(dirname(path));
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, content, { mode: 0o600, flag: "wx" });
  renameSync(temp, path);
  chmodSync(path, 0o600);
}

async function keytar() {
  const module = await import("keytar");
  return module.default || module;
}

export class CliStorage {
  private constructor(readonly root: string, private readonly key: Buffer) {}

  static async open(root = cliRoot(), keyOverride?: Buffer): Promise<CliStorage> {
    secureDirectory(root);
    let key = keyOverride;
    if (!key) {
      const lock = join(root, "key-init.lock");
      let handle: number | undefined;
      for (let attempt = 0; attempt < 600; attempt++) {
        try { handle = openSync(lock, "wx", 0o600); break; }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          try { if (Date.now() - statSync(lock).mtimeMs > 60_000) unlinkSync(lock); }
          catch (lookupError) { if ((lookupError as NodeJS.ErrnoException).code !== "ENOENT") throw lookupError; }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      if (handle === undefined) throw new Error("CLI key initialization timed out");
      try {
        const kc = await keytar();
        let encoded = await kc.getPassword(SERVICE, KEY_ACCOUNT);
        if (!encoded) {
          encoded = randomBytes(32).toString("base64");
          await kc.setPassword(SERVICE, KEY_ACCOUNT, encoded);
        }
        key = Buffer.from(encoded, "base64");
      } finally { closeSync(handle); unlinkSync(lock); }
    }
    if (key.length !== 32) throw new Error("Invalid CLI encryption key");
    return new CliStorage(root, key);
  }

  socketPath(): string { return join(this.root, "service.sock"); }
  authToken(): string {
    const path = join(this.root, "client.token");
    if (!existsSync(path)) {
      const candidate = `${path}.${randomUUID()}.tmp`;
      writeFileSync(candidate, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
      try { linkSync(candidate, path); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
      finally { unlinkSync(candidate); }
    }
    if ((lstatSync(path).mode & 0o077) !== 0) throw new Error("Insecure client token permissions");
    return readFileSync(path, "utf8");
  }

  load(): Vault {
    const path = join(this.root, "profiles.enc.json");
    if (!existsSync(path)) return { activeId: null, profiles: [] };
    return decryptJson<Vault>(JSON.parse(readFileSync(path, "utf8")) as EncryptedBlob, this.key);
  }

  save(vault: Vault): void {
    const path = join(this.root, "profiles.enc.json");
    if (existsSync(path)) writePrivate(join(this.root, "backup.enc.json"), readFileSync(path, "utf8"));
    writePrivate(path, JSON.stringify(encryptJson(vault, this.key)));
  }

  createBackup(): string {
    const source = join(this.root, "profiles.enc.json");
    if (!existsSync(source)) throw new Error("No profiles to back up");
    const name = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.enc.json`;
    writePrivate(join(this.root, name), readFileSync(source, "utf8"));
    this.audit("backup.create");
    return name;
  }

  listBackups(): string[] {
    return readdirSync(this.root).filter((name) => /^backup-[\dTZ-]+\.enc\.json$/.test(name)).sort().reverse();
  }

  deleteBackup(name: string): void {
    if (!this.listBackups().includes(name)) throw new Error("Backup not found");
    unlinkSync(join(this.root, name));
    this.audit("backup.delete");
  }

  restoreBackup(name: string, current: Vault, dryRun: boolean): { profiles: number; restored?: boolean } {
    if (!/^backup-[\dTZ-]+\.enc\.json$/.test(name)) throw new Error("Invalid backup name");
    const saved = decryptJson<Vault>(JSON.parse(readFileSync(join(this.root, name), "utf8")) as EncryptedBlob, this.key);
    if (!Array.isArray(saved.profiles)) throw new Error("Invalid backup contents");
    if (dryRun) return { profiles: saved.profiles.length };
    const revisions = new Map(current.profiles.map((profile) => [profile.id, profile.revision]));
    for (const profile of saved.profiles) profile.revision = Math.max(profile.revision, revisions.get(profile.id) ?? 0) + 1;
    this.save(saved);
    this.audit("backup.restore");
    return { profiles: saved.profiles.length, restored: true };
  }

  audit(event: string, profileId?: string): void {
    const path = join(this.root, "audit.jsonl");
    const line = JSON.stringify({ at: new Date().toISOString(), event, profileId }) + "\n";
    writeFileSync(path, line, { flag: "a", mode: 0o600 });
  }

  async getTmdbToken(): Promise<string | null> { return (await keytar()).getPassword(SERVICE, "tmdb-token"); }
  async setTmdbToken(value: string): Promise<void> { await (await keytar()).setPassword(SERVICE, "tmdb-token", value); this.audit("credential.set"); }
  async clearTmdbToken(): Promise<void> { await (await keytar()).deletePassword(SERVICE, "tmdb-token"); this.audit("credential.clear"); }
  async getTmdbApiKey(): Promise<string | null> { return (await keytar()).getPassword(SERVICE, "tmdb-api-key"); }
  async setTmdbApiKey(value: string): Promise<void> { await (await keytar()).setPassword(SERVICE, "tmdb-api-key", value); this.audit("credential.set"); }
  async clearTmdbApiKey(): Promise<void> { await (await keytar()).deletePassword(SERVICE, "tmdb-api-key"); this.audit("credential.clear"); }
}

export function newProfile(name: string): Profile {
  return { id: randomUUID(), name, archived: false, revision: 1, state: createDefaultState() };
}

export function publicProfile(profile: Profile) {
  return { id: profile.id, name: profile.name, archived: profile.archived, revision: profile.revision, ratings: Object.keys(profile.state.ratings).length };
}
