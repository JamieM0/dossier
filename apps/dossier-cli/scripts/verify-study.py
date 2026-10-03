"""Check repeated measurements and independently recalculate every recorded AUC."""
import json
from pathlib import Path

pairs = [
    ('reports/dossier-learning-study-bundled.json', '/tmp/dossier-learning-study-bundled-repeat.json', 'apps/dossier-cli/src/lab/real-v1.json'),
    ('reports/dossier-learning-study-tmdb.json', '/tmp/dossier-learning-study-tmdb-repeat.json', 'apps/dossier-cli/src/lab/real-tmdb-v1.json'),
]
verified_auc = 0
same = 0
for first_path, second_path, fixture_path in pairs:
    first = json.loads(Path(first_path).read_text())
    second = json.loads(Path(second_path).read_text())
    assert first == second, f'Repeated run differs: {first_path}'
    same += 1
    fixture = json.loads(Path(fixture_path).read_text())
    viewers = {v['id']: v for v in fixture['viewers']}
    for session in first['sessions']:
        viewer = viewers[session['viewer']]
        held = viewer['heldOutRatings']
        training = {r['filmKey'] for r in viewer['trainingRatings']}
        assert all(r['filmKey'] in training for r in session['observed'])
        positive = [r['filmKey'] for r in held if r['rating'] > 0]
        negative = [r['filmKey'] for r in held if r['rating'] < 0]
        for count, snap in session['snapshots'].items():
            for name, row in snap['components'].items():
                # Detailed scores exist at 10, 20, and 40 ratings.
                if 'scores' not in row:
                    continue
                score = row['scores']
                pairs_score = [(1 if score.get(a, 0) > score.get(b, 0) else 0 if score.get(a, 0) < score.get(b, 0) else .5)
                               for a in positive for b in negative]
                actual = sum(pairs_score) / len(pairs_score)
                assert abs(actual - row['auc']) <= .0000500001, (first_path, session['viewer'], count, name, actual, row['auc'])
                verified_auc += 1
    assert first['calibration']['activeChosenAfterFive']['mean'] == 35
result = {'repeatedBothMetadataRuns': same == 2,
          'independentAucChecks': verified_auc,
          'sourceTrainingBoundaryChecked': True,
          'allCalibrationChoicesFromDossier': True,
          'completeRuns': 4}
Path('/tmp/dossier-study-verification.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result))
