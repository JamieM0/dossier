import { registry } from "@dossier/domain";

type Args = Record<string, unknown>;

const aliases: Record<string, string> = { "suggest": "suggest.list", "status": "system.status", "version": "system.version" };
const positional: Record<string, string[]> = {
  "profile.create": ["name"], "profile.use": ["profile"], "profile.inspect": ["profile"], "profile.rename": ["profile", "name"], "profile.archive": ["profile"], "profile.unarchive": ["profile"], "profile.delete": ["profile"], "profile.export": ["profile", "path"], "profile.import": ["path", "name"],
  "rate.set": ["key"], "rate.clear": ["key"], "rate.skip": ["key"],
  "refine.choose": ["winner", "loser"], "refine.correct": ["winner", "loser"], "refine.rank": ["keys"], "suggest.explain": ["key"],
  "taste.claim.inspect": ["id"], "taste.claim.confirm": ["id"], "taste.claim.reject": ["id"], "taste.claim.correct": ["id"],
  "library.inspect": ["key"], "library.remove": ["key"], "library.export": ["path"], "library.import": ["path"],
  "settings.get": ["key"], "settings.set": ["key", "value"], "tmdb.search": ["query"], "backup.restore": ["file"], "backup.delete": ["file"]
};

export function parse(argv: string[]): { action: string; args: Args; flags: Set<string> } {
  let action = argv.shift() ?? "help";
  if (action === "taste" && argv[0] === "claim") action += `.${argv.shift()}`;
  if ((action === "suggest" && argv[0] === "explain") || (!aliases[action] && !registry.some((entry) => entry.name === action) && argv[0] && !argv[0]!.startsWith("-"))) action += `.${argv.shift()}`;
  action = aliases[action] ?? action;
  const args: Args = {}; const flags = new Set<string>(); const values: string[] = [];
  while (argv.length) {
    const word = argv.shift()!;
    if (!word.startsWith("--")) { values.push(word); continue; }
    const key = word.slice(2).replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
    if (key === "token" || key === "passphrase" || key === "apiKey") throw new Error(`Read ${key} from a prompt or stdin`);
    if (["readable", "json", "ndjson", "yes", "dryRun", "passphraseStdin", "tokenStdin"].includes(key)) { flags.add(key); args[key] = true; continue; }
    const value = argv.shift(); if (value === undefined) throw new Error(`Missing value for ${word}`);
    args[key] = value;
  }
  const keys = positional[action] ?? [];
  for (let i = 0; i < values.length; i++) {
    if (keys[i] === "keys") { args.keys = values.slice(i); break; }
    else if (keys[i]) args[keys[i]!] = values[i];
    else throw new Error(`Unexpected argument ${values[i]}`);
  }
  return { action, args, flags };
}
