#!/usr/bin/env python3
"""Compare normalized Dossier measurements within unchanged test conditions."""
import argparse
import json
import math
from pathlib import Path
from statistics import mean

IDENTITY = ('benchmark', 'method', 'checkpoint', 'metric')
CONDITION = ('cohortHash', 'metadataHash', 'evidenceHash', 'evaluatorHash',
             'definition', 'unit', 'direction')


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate(raw, path):
    if raw.get('schemaVersion') != 1:
        raise ValueError(f'{path}: unsupported manifest schema')
    for field in ('runId', 'chronologyBasis', 'role', 'status'):
        if not isinstance(raw.get(field), str) or not raw[field].strip():
            raise ValueError(f'{path}: missing {field}')
    if not isinstance(raw.get('sequence'), int) or isinstance(raw['sequence'], bool) or raw['sequence'] < 0:
        raise ValueError(f'{path}: sequence must be a nonnegative integer')
    if not isinstance(raw.get('source'), dict) or not raw['source'].get('files'):
        raise ValueError(f'{path}: source files and their hashes are required')
    for source in raw['source']['files']:
        if not source.get('path') or not source.get('sha256'):
            raise ValueError(f'{path}: source path or hash missing')
    rows = raw.get('metrics')
    if not isinstance(rows, list):
        raise ValueError(f'{path}: metrics must be an array')
    index = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError(f'{path}: metric must be an object')
        for field in IDENTITY + CONDITION:
            if field not in row or row[field] is None or row[field] == '':
                raise ValueError(f'{path}: metric missing {field}')
        if row['direction'] not in ('higher', 'lower') or not finite(row.get('value')):
            raise ValueError(f'{path}: invalid direction or value')
        if not isinstance(row['checkpoint'], int) or isinstance(row['checkpoint'], bool):
            raise ValueError(f'{path}: checkpoint must be an integer')
        for field in IDENTITY + CONDITION:
            if field != 'checkpoint' and not isinstance(row[field], str):
                raise ValueError(f'{path}: {field} must be a string')
        viewers = row.get('viewers')
        if viewers is not None:
            if not isinstance(viewers, dict) or not viewers or not all(finite(v) for v in viewers.values()):
                raise ValueError(f'{path}: invalid person-level measurements')
            if abs(mean(viewers.values()) - row['value']) > 0.000051:
                raise ValueError(f'{path}: person mean differs from recorded value')
        key = tuple(row[f] for f in IDENTITY)
        if key in index:
            raise ValueError(f'{path}: duplicate metric {key}')
        index[key] = row
    return {'raw': raw, 'index': index, 'path': str(path)}


def comparison(current, previous):
    if previous is None:
        return {'status': 'unavailable', 'reason': 'No earlier result set'}
    run = previous['raw']
    prior = previous['index'].get(tuple(current[f] for f in IDENTITY))
    result = {'runId': run['runId'], 'sequence': run['sequence'], 'completedAt': run.get('completedAt')}
    if prior is None:
        return {**result, 'status': 'not-measured', 'reason': 'Metric absent from this result set'}
    differences = [field for field in CONDITION if current[field] != prior[field]]
    if differences:
        return {**result, 'status': 'not-comparable', 'changedConditions': differences}
    delta = current['value'] - prior['value']
    result.update(status='comparable', value=prior['value'], delta=delta,
                  improvementDelta=delta if current['direction'] == 'higher' else -delta)
    a, b = current.get('viewers', {}), prior.get('viewers', {})
    if bool(a) != bool(b) or (a and set(a) != set(b)):
        return {**result, 'status': 'not-comparable', 'changedConditions': ['person-level measurement coverage']}
    if a:
        result['viewerDeltas'] = {v: a[v] - b[v] for v in sorted(a)}
        result['viewerCount'] = len(a)
    return result


def compare(latest, history):
    ids, sequences = set(), set()
    for item in [latest] + history:
        raw = item['raw']
        if raw['runId'] in ids or raw['sequence'] in sequences:
            raise ValueError('Duplicate run ID or sequence in the history registry')
        ids.add(raw['runId'])
        sequences.add(raw['sequence'])
    eligible, excluded = [], []
    for item in history:
        raw = item['raw']
        reason = None
        if raw['sequence'] >= latest['raw']['sequence']:
            reason = 'Not earlier than latest'
        elif raw['role'] not in ('primary', 'historical-import'):
            reason = 'Repeat or discarded trial'
        elif raw['status'] != 'complete':
            reason = 'Incomplete result set'
        if reason:
            excluded.append({'runId': raw['runId'], 'reason': reason})
        else:
            eligible.append(item)
    eligible.sort(key=lambda r: r['raw']['sequence'], reverse=True)
    recent = eligible[:2]
    older = eligible[2:]
    rows = []
    for current in latest['raw']['metrics']:
        previous = [comparison(current, recent[i] if i < len(recent) else None) for i in range(2)]
        old = [comparison(current, r) for r in older]
        contributors = [r for r in old if r['status'] == 'comparable']
        older_mean = mean(r['value'] for r in contributors) if contributors else None
        delta = current['value'] - older_mean if older_mean is not None else None
        aggregate = {'status': 'comparable' if contributors else 'unavailable',
                     'value': older_mean, 'delta': delta, 'runCount': len(contributors),
                     'improvementDelta': None if delta is None else delta if current['direction'] == 'higher' else -delta,
                     'contributors': [r['runId'] for r in contributors],
                     'excluded': [r for r in old if r['status'] != 'comparable']}
        if current.get('viewers') and contributors:
            aggregate['viewerMeans'] = {v: mean(r['index'][tuple(current[f] for f in IDENTITY)]['viewers'][v]
                for r in older if r['raw']['runId'] in aggregate['contributors']) for v in current['viewers']}
            aggregate['viewerDeltas'] = {v: value - aggregate['viewerMeans'][v] for v, value in current['viewers'].items()}
        rows.append({**{f: current[f] for f in IDENTITY}, 'unit': current['unit'],
                     'direction': current['direction'], 'latest': current['value'],
                     'previous': previous[0], 'beforePrevious': previous[1], 'earlierAverage': aggregate})
    return {'schemaVersion': 1, 'latestRunId': latest['raw']['runId'],
            'latestStatus': latest['raw']['status'],
            'recentRunIds': [r['raw']['runId'] for r in recent],
            'olderEligibleRunCount': len(older), 'excludedRuns': excluded, 'metrics': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--latest', type=Path, required=True)
    parser.add_argument('--history', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    latest_path = args.latest.resolve()
    latest = validate(json.loads(latest_path.read_text()), latest_path)
    history = [validate(json.loads(p.read_text()), p) for p in sorted(args.history.rglob('run.json')) if p.resolve() != latest_path]
    result = compare(latest, history)
    if args.output.resolve() == latest_path or args.output.exists():
        raise ValueError('Choose a new output path; existing evidence stays unchanged')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    print(json.dumps({'latest': result['latestRunId'], 'recent': result['recentRunIds'],
                      'metrics': len(result['metrics']), 'output': str(args.output)}))


if __name__ == '__main__':
    main()
