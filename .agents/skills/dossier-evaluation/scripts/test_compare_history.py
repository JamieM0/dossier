"""Exercise historical selection, compatibility and person-level arithmetic."""
import copy
import unittest
from pathlib import Path
from compare_history import compare, validate


def run(sequence, value, **changes):
    row = {'benchmark': 'fixed-film-test', 'method': 'dossier', 'checkpoint': 20,
           'metric': 'ordering', 'cohortHash': 'same-people', 'metadataHash': 'same-films',
           'evidenceHash': 'same-orders', 'evaluatorHash': 'same-scorer',
           'definition': 'pair-ordering-v1', 'unit': 'fraction', 'direction': 'higher',
           'value': value, 'viewers': {'a': value - .1, 'b': value + .1}}
    row.update(changes)
    raw = {'schemaVersion': 1, 'runId': f'run-{sequence}', 'sequence': sequence,
           'completedAt': None, 'chronologyBasis': 'Test sequence', 'role': 'primary',
           'status': 'complete', 'source': {'files': [{'path': 'raw.json', 'sha256': 'test-hash'}]},
           'metrics': [row]}
    return validate(raw, Path(f'test-{sequence}/run.json'))


class HistoryTests(unittest.TestCase):
    def test_recent_two_and_equal_run_weight(self):
        result = compare(run(5, .8), [run(1, .2), run(2, .4), run(3, .5), run(4, .7)])
        row = result['metrics'][0]
        self.assertEqual(result['recentRunIds'], ['run-4', 'run-3'])
        self.assertAlmostEqual(row['previous']['delta'], .1)
        self.assertAlmostEqual(row['earlierAverage']['value'], .3)
        self.assertEqual(row['earlierAverage']['runCount'], 2)
        self.assertAlmostEqual(row['earlierAverage']['viewerDeltas']['a'], .5)

    def test_incompatible_recent_is_not_replaced(self):
        result = compare(run(4, .8), [run(1, .2), run(2, .4), run(3, .7, cohortHash='different-people')])
        row = result['metrics'][0]
        self.assertEqual(row['previous']['status'], 'not-comparable')
        self.assertEqual(row['previous']['runId'], 'run-3')
        self.assertEqual(row['beforePrevious']['runId'], 'run-2')
        self.assertEqual(row['earlierAverage']['contributors'], ['run-1'])

    def test_repeats_and_incomplete_runs_do_not_enter_history(self):
        repeat, partial = run(3, .1), run(4, .9)
        repeat['raw']['role'] = 'repeat'
        partial['raw']['status'] = 'partial'
        result = compare(run(5, .8), [run(1, .2), run(2, .4), repeat, partial])
        self.assertEqual(result['recentRunIds'], ['run-2', 'run-1'])
        self.assertEqual(len(result['excludedRuns']), 2)
        self.assertIsNone(result['metrics'][0]['earlierAverage']['value'])

    def test_lower_is_better(self):
        row = compare(run(2, .2, direction='lower'), [run(1, .4, direction='lower')])['metrics'][0]
        self.assertAlmostEqual(row['previous']['delta'], -.2)
        self.assertAlmostEqual(row['previous']['improvementDelta'], .2)

    def test_changed_person_coverage_refuses_pairing(self):
        old = run(1, .4)
        old['index'][('fixed-film-test', 'dossier', 20, 'ordering')]['viewers'] = {'c': .4}
        row = compare(run(2, .8), [old])['metrics'][0]
        self.assertEqual(row['previous']['status'], 'not-comparable')

    def test_invalid_arithmetic_and_nonfinite_values_fail(self):
        raw = copy.deepcopy(run(1, .4)['raw'])
        raw['metrics'][0]['value'] = .9
        with self.assertRaises(ValueError):
            validate(raw, Path('bad.json'))
        raw['metrics'][0]['value'] = float('nan')
        with self.assertRaises(ValueError):
            validate(raw, Path('bad.json'))

    def test_missing_history_and_duplicate_sequence(self):
        row = compare(run(1, .4), [])['metrics'][0]
        self.assertEqual(row['previous']['status'], 'unavailable')
        with self.assertRaises(ValueError):
            compare(run(1, .4), [run(1, .5)])

    def test_changed_metric_definition_breaks_comparison(self):
        row = compare(run(2, .8), [run(1, .4, definition='different-v2')])['metrics'][0]
        self.assertEqual(row['previous']['status'], 'not-comparable')


if __name__ == '__main__':
    unittest.main()
