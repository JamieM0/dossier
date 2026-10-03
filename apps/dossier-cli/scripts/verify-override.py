"""Check reported rankings and ratings independently from the JavaScript scorer."""
import csv
import hashlib
import io
import json
import zipfile
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

root = Path(__file__).resolve().parents[3]
current = json.loads((root / 'reports/observed-rating-override-v1.json').read_bytes())
first = json.loads(Path('/tmp/dossier-override-first.json').read_bytes())
assert current == first, 'Complete runs differ'
fixtures = {name:json.loads((root / path).read_bytes()) for name, path in {
    'original':'apps/dossier-cli/src/lab/real-tmdb-v1.json',
    'confirmation':'apps/dossier-cli/src/lab/new-viewers-v1.json',
    'fresh':'apps/dossier-cli/src/lab/override-viewers-v1.json'}.items()}
viewers = {(name,v['id']):v for name,f in fixtures.items() for v in f['viewers']}
rank_checks = 0
selection_checks = 0
for session in current['sessions']:
    viewer = viewers[session['cohort'],session['viewer']]
    truth = {r['filmKey']:r['rating'] for r in viewer['heldOutRatings']}
    train = {r['filmKey']:r['rating'] for r in viewer['trainingRatings']}
    assert all(r['filmKey'] in train and train[r['filmKey']] == r['suppliedRating'] for r in session['observed'])
    assert not set(train) & set(truth)
    for count in [20,40]:
        snapshot = session['snapshots'][str(count)]
        selected = 'dossier' if snapshot['decision']['useDossier'] else 'candidate'
        assert snapshot['scores']['guard'] == snapshot['scores'][selected]
        selection_checks += 1
        for method, scores in snapshot['scores'].items():
            likes = [k for k,v in truth.items() if v > 0]
            dislikes = [k for k,v in truth.items() if v < 0]
            pairs = [(scores.get(a,0) > scores.get(b,0)) + .5*(scores.get(a,0) == scores.get(b,0)) for a in likes for b in dislikes]
            expected = float(Decimal(sum(pairs)/len(pairs)).quantize(Decimal('.0001'), rounding=ROUND_HALF_UP))
            assert abs(snapshot[method]['auc']-expected) < .00001, (session['viewer'],session['seed'],count,method,snapshot[method]['auc'],expected)
            top = snapshot[method]['top10']
            assert len(top) == len(set(top)) and all(k in truth for k in top)
            assert snapshot[method]['precision10'] == sum(truth[k] > 0 for k in top)/10
            rank_checks += 1
archive = Path('/tmp/dossier-ml-latest-small.zip').read_bytes()
assert hashlib.sha256(archive).hexdigest() == fixtures['fresh']['sources']['ratings']['sha256']
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    source = {(int(r['userId']),int(r['movieId'])):float(r['rating']) for r in csv.DictReader(io.StringIO(z.read('ml-latest-small/ratings.csv').decode()))}
conversion = {.5:-3,1:-3,1.5:-2,2:-2,2.5:-1,3:0,3.5:0,4:2,4.5:3,5:3}
rating_checks = 0
for fixture in fixtures.values():
    for viewer in fixture['viewers']:
        for r in viewer['trainingRatings']+viewer['heldOutRatings']:
            assert source[viewer['sourceUserId'],r['movieLensId']] == r['stars']
            assert conversion[r['stars']] == r['rating']
            rating_checks += 1
results_hash = hashlib.sha256((root / 'reports/observed-rating-override-v1.json').read_bytes()).hexdigest()
verification = {'repeatMatched':True, 'independentRankingChecks':rank_checks, 'sourceRatingChecks':rating_checks,
                'selectionChecks':selection_checks, 'resultsHash':results_hash}
(root / 'reports/observed-rating-override-verification-v1.json').write_text(json.dumps(verification,indent=2)+'\n')
print(json.dumps(verification))
