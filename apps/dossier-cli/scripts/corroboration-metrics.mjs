import { average, distribution, round } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';

export function summarizeCorroboration(viewers, protocol) {
  return Object.fromEntries(protocol.arms.map(arm => {
    const final = viewers.map(v => average(v.sessions.map(s => s.steps.at(-1).measures[arm].auc)));
    const current = viewers.map(v => average(v.sessions.map(s => s.steps.at(-1).measures.current.auc)));
    const updateSteps = v => v.sessions.flatMap(s => s.steps.filter(x => x.count > 10));
    const phaseGains = viewers.map(v => average(updateSteps(v).map(x => x.phase[arm].auc - x.phase.current.auc)));
    const deltas = viewers.flatMap(v => updateSteps(v).map(x => x.phaseDeltas[arm]));
    const changing = viewers.filter(v => v.type === 'changing_taste');
    const adaptation40 = changing.map(v => average(v.sessions.map(s => {
      const step = s.steps.find(x => x.count === 40); return step.measures[arm].auc - step.measures.current.auc;
    })));
    return [arm, { auc: distribution(final), gain: meanInterval(final.map((x, i) => x - current[i])),
      precision10: round(average(viewers.map(v => average(v.sessions.map(s => s.steps.at(-1).measures[arm].precision10))))),
      contemporaneousGain: meanInterval(phaseGains), worstStep: round(Math.min(0, ...deltas)),
      largeLossRate: round(deltas.filter(x => x < -.05).length / Math.max(1, deltas.length)), adaptation40: meanInterval(adaptation40),
      orderSpread: round(Math.max(0, ...viewers.flatMap(v => v.sessions.map(s => s.order[arm].aucSpread)))) }];
  }));
}

export function corroborationDecision(viewers, failures, protocol, limited = false) {
  const g = protocol.gates;
  const partitions = Object.fromEntries(['sealed', 'confirmation'].map(partition => {
    const selected = viewers.filter(v => v.partition === partition), summary = summarizeCorroboration(selected, protocol);
    const groups = Object.fromEntries(['stable_axes', 'changing_taste', 'isolated_noise', 'repeated_noise', 'biased_noise']
      .map(t => [t, summarizeCorroboration(selected.filter(v => v.type === t), protocol)]));
    return [partition, protocol.arms.filter(a => a.startsWith('supported')).map(arm => {
      const r = summary[arm], historical = failures.map(f => f.arms[arm]);
      const gates = {
        completeCohort: selected.length === (partition === 'sealed' ? protocol.selectionViewers : protocol.confirmationViewers),
        meanGain: r.gain.mean >= g.minimumMeanGain, positiveLowerBound: r.gain.lower > 0,
        worstTenth: r.auc.p10 >= summary.current.auc.p10 + g.worstDecileDelta,
        contemporaneousTaste: r.contemporaneousGain.lower >= g.subgroupLowerDelta,
        ...Object.fromEntries(Object.entries(groups).map(([t, s]) => [t, s[arm].gain.lower >= g.subgroupLowerDelta])),
        adaptation40: r.adaptation40.lower >= g.subgroupLowerDelta,
        adaptationRetention: groups.changing_taste[arm].gain.mean >= Math.max(0, groups.changing_taste.local_recent.gain.mean) * g.retainedAdaptation,
        singleRatingSafety: r.worstStep >= -g.maxSingleRatingLoss,
        largeLossFrequency: r.largeLossRate <= summary.current.largeLossRate * g.largeLossRateRatio,
        orderInvariant: selected.length > 0 && selected.every(v => v.sessions.every(s => s.order[arm].scoreSignatures === 1)),
        historicalGain: historical.length === 5 && historical.every(f => f.gainCurrent40 >= g.historicalFinalGain),
        historicalDecline: historical.length === 5 && historical.every(f => f.change >= g.historicalTotalDecline),
        historicalStep: historical.length === 5 && historical.every(f => f.worstStep >= -g.maxSingleRatingLoss),
        contracts: selected.length > 0 && selected.every(v => v.sessions.every(s => Object.values(s.contracts).every(Boolean) && s.scorerRestoration[arm]))
      };
      return { arm, gates, passed: Object.values(gates).every(Boolean) };
    })];
  }));
  const eligible = partitions.sealed.filter(c => c.passed && partitions.confirmation.find(x => x.arm === c.arm).passed);
  const selection = summarizeCorroboration(viewers.filter(v => v.partition === 'sealed'), protocol);
  eligible.sort((a, b) => selection[b.arm].gain.mean - selection[a.arm].gain.mean);
  return { candidateGates: partitions, decision: { status: limited ? 'smoke_only' : eligible.length ? 'eligible_for_adoption_review' : 'do_not_promote',
    selected: limited ? null : eligible[0]?.arm ?? null,
    reason: limited ? 'Limited runs cannot decide adoption.' : eligible.length ? 'Both reserved cohorts pass every frozen requirement.' : 'No candidate passes every requirement in both reserved cohorts.' } };
}
