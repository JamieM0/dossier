import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import keytar from 'keytar';
import { TmdbClient } from '@dossier/domain';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2);
const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const archive = value('--movielens-zip', '/tmp/dossier-ml-latest-small.zip');
const sourceBytes = readFileSync(new URL('../src/lab/real-v1.json', import.meta.url));
const source = JSON.parse(sourceBytes);
if (sha256(readFileSync(archive)) !== source.sources.ratings.sha256) throw new Error('MovieLens archive differs from frozen source');
const links = JSON.parse(execFileSync('python3', ['-c', `import csv,io,json,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
 print(json.dumps({r['movieId']:r for r in csv.DictReader(io.StringIO(z.read('ml-latest-small/links.csv').decode()))}))`, archive], { encoding: 'utf8' }));
const output = value('--output', 'apps/dossier-cli/src/lab/real-tmdb-v1.json');
if (existsSync(output)) throw new Error('A fixture already exists at this path. Choose a new --output to preserve the frozen benchmark.');
const checkpoint = value('--checkpoint', '/tmp/dossier-tmdb-normalized');
mkdirSync(checkpoint, { recursive: true });
const token = await keytar.getPassword('Dossier CLI', 'tmdb-token') ?? await keytar.getPassword('Dossier CLI', 'tmdb-api-key');
if (!token) throw new Error('The CLI has no saved TMDB credential');
const api = new TmdbClient({ token });
await api.validate();
const matches = source.items.map(item => {
  if (item.source.movieLensIds.length !== 1) throw new Error(`Ambiguous MovieLens link: ${item.id}`);
  const link = links[item.source.movieLensIds[0]];
  if (!link?.tmdbId) throw new Error(`Missing TMDB link: ${item.id}`);
  return { item, tmdbId: Number(link.tmdbId), imdbId: `tt${link.imdbId}` };
});
if (new Set(matches.map(row => row.tmdbId)).size !== matches.length) throw new Error('TMDB links collapse distinct films');
let next = 0, complete = 0;
const unresolved = [];
const workers = Array.from({ length: 3 }, async () => {
  while (next < matches.length) {
    const row = matches[next++];
    const path = `${checkpoint}/${row.tmdbId}.json`;
    if (!existsSync(path)) {
      let detail;
      if (row.imdbId === 'tt0185906') detail = await api.detail('tv', 4613);
      for (let attempt = 0; !detail && attempt < 4; attempt++) {
        try { detail = await api.detail('movie', row.tmdbId); break; }
        catch (error) {
          if (String(error.message).includes('HTTP 404')) {
            const headers = token.length > 40 ? { Authorization: `Bearer ${token}` } : {};
            const query = token.length > 40 ? '' : `&api_key=${encodeURIComponent(token)}`;
            const response = await fetch(`https://api.themoviedb.org/3/find/${row.imdbId}?external_source=imdb_id${query}`, { headers });
            if (!response.ok) throw new Error(`TMDB identity lookup HTTP ${response.status}`);
            const found = await response.json();
            if (found.movie_results?.length === 1) { row.resolvedTmdbId = found.movie_results[0].id; detail = await api.detail('movie', row.resolvedTmdbId); }
            else unresolved.push({ originalId: row.tmdbId, filmKey: `movie:${row.item.id}`, title: row.item.title, imdbId: row.imdbId, matches: found });
            break;
          }
          if (attempt === 3) throw new Error(`Metadata fetch failed for TMDB ${row.tmdbId}: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
        }
      }
      if (detail) {
        const { features: _features, ...publicMetadata } = detail;
        writeFileSync(path, JSON.stringify(publicMetadata) + '\n');
      }
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    complete++;
    if (complete % 100 === 0) process.stderr.write(`TMDB metadata ${complete}/${matches.length}\n`);
  }
});
await Promise.all(workers);
if (unresolved.length) { writeFileSync('/tmp/dossier-tmdb-unresolved.json', JSON.stringify(unresolved, null, 2)); throw new Error(`${unresolved.length} identities need review; public details saved in /tmp/dossier-tmdb-unresolved.json`); }
const name = title => title.toLowerCase().replace(/[^a-z0-9]/g, '');
const discrepancies = [];
const items = matches.map(({ item, tmdbId, imdbId }) => {
  const metadata = JSON.parse(readFileSync(`${checkpoint}/${tmdbId}.json`));
  if (metadata.medium !== 'movie' && imdbId !== 'tt0185906') throw new Error(`Unexpected TV identity ${tmdbId}`);

  if (name(metadata.title) !== name(item.title) || metadata.year !== item.year) discrepancies.push({ filmKey: `movie:${item.id}`, originalTitle: item.title, originalYear: item.year, tmdbId, title: metadata.title, year: metadata.year, imdbId });
  return { ...metadata, id: item.id, medium: 'movie', source: { ...item.source, tmdbId: metadata.id, tmdbMedium: metadata.medium, linkedTmdbId: tmdbId, imdbId } };
});
const identityAudit = [];
for (const item of items.filter(item => discrepancies.some(row => row.filmKey === `movie:${item.id}`) || item.source.tmdbId !== item.source.linkedTmdbId || item.source.tmdbMedium !== 'movie')) {
  const { tmdbId, tmdbMedium, imdbId } = item.source;
  const headers = token.length > 40 ? { Authorization: `Bearer ${token}` } : {};
  const query = token.length > 40 ? '' : `?api_key=${encodeURIComponent(token)}`;
  const response = await fetch(`https://api.themoviedb.org/3/${tmdbMedium}/${tmdbId}/external_ids${query}`, { headers });
  if (!response.ok) throw new Error(`External identity check HTTP ${response.status}`);
  const external = await response.json();
  if (external.imdb_id !== imdbId) throw new Error(`External identity mismatch: ${item.title}`);
  identityAudit.push({ filmKey: `movie:${item.id}`, imdbId, tmdbId, tmdbMedium, verified: true });
}
const fixture = { ...source, version: 'real-tmdb-v1', parentFixtureHash: sha256(sourceBytes),
  sources: { ...source.sources, filmMetadata: 'TMDB full detail, through the same TmdbClient used by Dossier. IDs come from the pinned MovieLens links.csv.', tmdb: { attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.', fetchedDate: new Date().toISOString().slice(0,10), website: 'https://www.themoviedb.org/' } },
  selection: { ...source.selection, caveat: 'The evaluation can score only films a viewer chose to rate. These rated films are not a random sample of all films. Candidate retrieval is not evaluated.', identity: 'Keep evaluator film keys unchanged to preserve the exact viewer splits and training order. Actual TMDB IDs remain in public source metadata.', metadataDiscrepancies: discrepancies, identityAudit, tvException: 'Band of Brothers is a TV miniseries in TMDB. Use its full TV detail while keeping the original evaluator film key. It appears only in viewer 414 training candidates, never in hidden answers.' }, items };
writeFileSync(output, JSON.stringify(fixture) + '\n');
process.stdout.write(JSON.stringify({ output, sha256: sha256(readFileSync(output)), viewers: fixture.viewers.length, films: items.length, directorsPresent: items.filter(item => item.directorIds.length).length, collectionsPresent: items.filter(item => item.collection).length, discrepancies }) + '\n');
