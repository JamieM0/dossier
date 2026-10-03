"""Build a portable decision register from saved Dossier experiments."""
import hashlib
import json
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[2]
REPORTS = ROOT / 'reports'

def read(name):
    return json.loads((REPORTS / name).read_text())

study = read('dossier-learning-study-tmdb.json')
bundled = read('dossier-learning-study-bundled.json')
confirmation = read('reviews-plus-tags-confirmation-v1.json')
override = read('observed-rating-override-v1.json')
diagnosis = read('backwards-learning-diagnosis-v1.json')
counts = ['1', '3', '5', '10', '20', '40']
methods = ['publicReviews', 'candidate', 'dossier', 'guard']
people = []
for row in override['viewers']:
    sessions = [s for s in override['sessions'] if s['viewer'] == row['id']]
    after = {}
    for count in counts:
        after[count] = {}
        for method in methods:
            after[count][method] = dict(row['after'][count][method])
            after[count][method]['coverage'] = mean(s['snapshots'][count][method]['coverage'] for s in sessions)
    people.append({'id': row['id'], 'cohort': row['cohort'], 'unusual': row['explicitRisk'], 'after': after, 'overrides': row['overrides']})

def component_data(source):
    output = {}
    for count in counts:
        output[count] = {}
        for method, row in source['components'][count].items():
            output[count][method] = {k: row[k]['mean'] for k in ['auc', 'precision10', 'coverage']}
            output[count][method].update({k: row[k] for k in ['deltaCurrent', 'deltaPublic', 'improvedViewers', 'regressedViewers']})
    return output

failures = []
for case in diagnosis['cases']:
    protect = next(f for f in override['failures'] if (f['viewer'], f['seed']) == (case['viewer'], case['seed']))
    session = next(s for s in override['sessions'] if (s['viewer'], s['seed']) == (case['viewer'], case['seed']))
    failures.append({
        'id': case['viewer'], 'seed': case['seed'], 'step': case['worstStep'],
        'dominant': case['dominant'], 'stepDominant': case['stepDominant'],
        'orderRange': [case['orderSensitivity']['min'], case['orderSensitivity']['max']],
        'interventions': {k: case['overall']['interventions'][k] for k in [
            'current', 'freezeLikedContribution', 'freezeDislikeContribution', 'freezeClaims'
        ]},
        'pairs': [{k: p[k] for k in ['liked', 'disliked']} for p in case['transition']['lostPairs'][:2]],
        'scores': {n: {m: session['snapshots'][n][m]['auc'] for m in methods} for n in ['10', '40']},
        'protected': protect['protected'],
    })

belief = []
for row in study['belief']:
    if not row.get('originalClaim'):
        continue
    belief.append({k: row[k] for k in ['viewer', 'outcome', 'claimResolution', 'originalClaim', 'initialEvidence', 'contradictoryEvidence', 'resultingClaims', 'before', 'after', 'recommendationOverlap']})

damage = []
for row in study['damage']['rows']:
    damage.append({'id': row['viewer'], 'scores': {m: {k: v[k] for k in ['auc', 'precision10', 'coverage']} for m, v in row['scores'].items()}})

source_names = ['dossier-learning-study-tmdb.json', 'dossier-learning-study-bundled.json', 'reviews-plus-tags-confirmation-v1.json', 'observed-rating-override-v1.json', 'backwards-learning-diagnosis-v1.json', 'presentations/evidence-summary.json']
data = {
    'version': 2, 'created': '2026-10-03', 'counts': counts,
    'sources': [{'file': n, 'sha256': hashlib.sha256((REPORTS / n).read_bytes()).hexdigest()} for n in source_names],
    'people': people, 'cohorts': override['cohorts'],
    'components': {'tmdb': component_data(study), 'bundled': component_data(bundled)},
    'componentNames': study['componentDefinitions'],
    'baselines': {n: {m: {k: v[k]['mean'] for k in ['auc', 'precision10', 'coverage']} for m, v in study['learning'][n].items()} for n in counts},
    'questions': study['calibration']['byCount'], 'questionUncertainty': study['uncertainty']['questionBenefit40'],
    'confirmation': {'overall': confirmation['overall'], 'highRisk': confirmation['highRisk']},
    'detection': override['detection'], 'checks': override['checks'], 'failures': failures,
    'belief': belief, 'beliefCorrectionRate': study['beliefCorrectionRate'],
    'damage': damage, 'damageSummary': study['damage']['summary'],
}
# Preserve source means for group headlines. Individual charts use saved per-person means.
assert len(people) == 108 and sum(p['unusual'] for p in people) == 8
assert len(failures) == 5 and len(belief) == 28
assert override['cohorts']['fresh']['40']['methods']['candidate']['auc'] == .7456
payload = json.dumps(data, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/')
template = (Path(__file__).parent / 'template.html').read_text()
output = REPORTS / 'dossier-decision-register.html'
output.write_text(template.replace('__REPORT_DATA__', payload))
print(f'{output}: {output.stat().st_size:,} bytes')
