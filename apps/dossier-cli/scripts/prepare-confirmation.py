"""Prepare an unseen viewer cohort without measuring candidate performance."""
import csv
import hashlib
import io
import json
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
source_path = ROOT / 'apps/dossier-cli/src/lab/real-tmdb-v1.json'
source_bytes = source_path.read_bytes()
source = json.loads(source_bytes)
archive = Path('/tmp/dossier-ml-latest-small.zip').read_bytes()
assert hashlib.sha256(archive).hexdigest() == source['sources']['ratings']['sha256']
by_ml = {item['source']['movieLensIds'][0]: item for item in source['items']}
old = {viewer['sourceUserId'] for viewer in source['viewers']}
rows = defaultdict(list)
conversion = {.5:-3,1:-3,1.5:-2,2:-2,2.5:-1,3:0,3.5:0,4:2,4.5:3,5:3}
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    for row in csv.DictReader(io.StringIO(z.read('ml-latest-small/ratings.csv').decode())):
        user, film, stars = int(row['userId']), int(row['movieId']), float(row['rating'])
        if user in old or film not in by_ml:
            continue
        rows[user].append({'movieLensId':film,'filmKey':f"movie:{by_ml[film]['id']}", 'stars':stars,'rating':conversion[stars],'timestamp':int(row['timestamp'])})
viewers = []
for user in sorted(rows):
    ratings = rows[user]
    if len(ratings) < 100 or sum(r['rating']>0 for r in ratings)<16 or sum(r['rating']<0 for r in ratings)<16:
        continue
    order = sorted(ratings, key=lambda r:hashlib.sha256(f"20261002:confirmation:{user}:{r['movieLensId']}".encode()).hexdigest())
    positive = [r for r in order if r['rating']>0][:12]
    negative = [r for r in order if r['rating']<0][:12]
    reserved = {r['filmKey'] for r in positive+negative}
    holdout = positive+negative+[r for r in order if r['filmKey'] not in reserved][:36]
    hidden = {r['filmKey'] for r in holdout}
    viewers.append({'id':f'movielens-{user}', 'sourceUserId':user,
                    'trainingRatings':sorted([r for r in ratings if r['filmKey'] not in hidden],key=lambda r:r['movieLensId']),
                    'heldOutRatings':sorted(holdout,key=lambda r:r['movieLensId'])})
fixture = {'version':'new-viewers-v1', 'parentFixtureHash':hashlib.sha256(source_bytes).hexdigest(),
           'sources':source['sources'], 'selection':{'rule':'All viewers outside the original 31 with at least 100 matched ratings, 16 clear likes, and 16 clear dislikes.',
           'holdout':'60 films per viewer; 12 likes, 12 dislikes, 36 more from fixed hash order.',
           'caveat':'New individuals from the same MovieLens source and frozen catalogue. This is not an independent population or a test of candidate retrieval.'},
           'items':source['items'],'viewers':viewers}
output = ROOT / 'apps/dossier-cli/src/lab/new-viewers-v1.json'
if output.exists():
    raise SystemExit('Confirmation fixture exists; preserve the untouched cohort')
output.write_text(json.dumps(fixture,separators=(',',':'),ensure_ascii=False)+'\n')
print(json.dumps({'viewers':len(viewers),'fixtureHash':hashlib.sha256(output.read_bytes()).hexdigest()}))
