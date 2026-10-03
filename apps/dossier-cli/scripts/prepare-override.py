"""Reserve new viewers without reading experiment outcomes."""
import csv
import hashlib
import io
import json
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
old = json.loads((ROOT / 'apps/dossier-cli/src/lab/real-tmdb-v1.json').read_bytes())
used = json.loads((ROOT / 'apps/dossier-cli/src/lab/new-viewers-v1.json').read_bytes())
excluded = {v['sourceUserId'] for f in [old, used] for v in f['viewers']}
archive = Path('/tmp/dossier-ml-latest-small.zip').read_bytes()
assert hashlib.sha256(archive).hexdigest() == old['sources']['ratings']['sha256']
by_ml = {item['source']['movieLensIds'][0]: item for item in old['items']}
conversion = {.5:-3, 1:-3, 1.5:-2, 2:-2, 2.5:-1, 3:0, 3.5:0, 4:2, 4.5:3, 5:3}
rows = defaultdict(list)
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    for row in csv.DictReader(io.StringIO(z.read('ml-latest-small/ratings.csv').decode())):
        user, film, stars = int(row['userId']), int(row['movieId']), float(row['rating'])
        if user not in excluded and film in by_ml:
            rows[user].append({'movieLensId':film, 'filmKey':f"movie:{by_ml[film]['id']}",
                              'stars':stars, 'rating':conversion[stars], 'timestamp':int(row['timestamp'])})
viewers = []
for user in sorted(rows):
    ratings = rows[user]
    if len(ratings) < 80 or sum(r['rating'] > 0 for r in ratings) < 12 or sum(r['rating'] < 0 for r in ratings) < 12:
        continue
    order = sorted(ratings, key=lambda r:hashlib.sha256(f"override-v1:{user}:{r['movieLensId']}".encode()).hexdigest())
    selected = [r for r in order if r['rating'] > 0][:8] + [r for r in order if r['rating'] < 0][:8]
    reserved = {r['filmKey'] for r in selected}
    holdout = selected + [r for r in order if r['filmKey'] not in reserved][:24]
    hidden = {r['filmKey'] for r in holdout}
    viewers.append({'id':f'movielens-{user}', 'sourceUserId':user,
                    'trainingRatings':sorted([r for r in ratings if r['filmKey'] not in hidden], key=lambda r:r['movieLensId']),
                    'heldOutRatings':sorted(holdout, key=lambda r:r['movieLensId'])})
output = ROOT / 'apps/dossier-cli/src/lab/override-viewers-v1.json'
if output.exists():
    raise SystemExit('Preserve the reserved override fixture; create a new version for another cohort')
fixture = {'version':'override-viewers-v1', 'sources':old['sources'],
           'selection':{'rule':'All unused viewers with at least 80 matched ratings, 12 clear likes, and 12 clear dislikes.',
                        'holdout':'40 films: eight likes, eight dislikes, and 24 further films in a fixed hash order.',
                        'excludedViewerIds':sorted(excluded),
                        'limits':'Same archive and catalogue; fewer matched ratings and less balanced raters than the previous cohort.'},
           'items':old['items'], 'viewers':viewers}
output.write_text(json.dumps(fixture, separators=(',',':'), ensure_ascii=False)+'\n')
print(json.dumps({'viewers':len(viewers), 'fixtureHash':hashlib.sha256(output.read_bytes()).hexdigest()}))
