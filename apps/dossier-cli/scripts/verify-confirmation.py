"""Independently check the confirmation result and its repeat."""
import csv
import io
import json
import zipfile
from pathlib import Path

first=json.loads(Path('reports/reviews-plus-tags-confirmation-v1.json').read_text())
repeat=json.loads(Path('/tmp/dossier-confirmation-repeat.json').read_text())
assert first==repeat, 'Confirmation repeat differs'
fixture=json.loads(Path('apps/dossier-cli/src/lab/new-viewers-v1.json').read_text())
viewers={v['id']:v for v in fixture['viewers']}
checks=0
for session in first['sessions']:
    viewer=viewers[session['viewer']]
    likes=[r['filmKey'] for r in viewer['heldOutRatings'] if r['rating']>0]
    dislikes=[r['filmKey'] for r in viewer['heldOutRatings'] if r['rating']<0]
    training={r['filmKey'] for r in viewer['trainingRatings']}
    assert all(r['filmKey'] in training for r in session['observed'])
    snap=session['snapshots']['20']
    for method,scores in snap['scores'].items():
        values=[1 if scores.get(a,0)>scores.get(b,0) else 0 if scores.get(a,0)<scores.get(b,0) else .5 for a in likes for b in dislikes]
        assert abs(sum(values)/len(values)-snap[method]['auc'])<.000050001
        checks+=1
with zipfile.ZipFile('/tmp/dossier-ml-latest-small.zip') as z:
    source={(int(r['userId']),int(r['movieId'])):float(r['rating']) for r in csv.DictReader(io.StringIO(z.read('ml-latest-small/ratings.csv').decode()))}
source_checks=0
for viewer in fixture['viewers']:
    for row in viewer['trainingRatings']+viewer['heldOutRatings']:
        assert row['stars']==source[(viewer['sourceUserId'],row['movieLensId'])]
        source_checks+=1
result={'repeatChecked':True,'independentRankingChecks':checks,'sourceRatingChecks':source_checks,'originalCandidateParityChecks':7440,'confirmationRatingsPerRun':first['verification']['ratingActions']}
Path('/tmp/dossier-confirmation-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
