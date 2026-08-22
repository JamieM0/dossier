import { describe, expect, it } from "vitest";
import {
  MAX_CLAIM_SCORE_ADJUSTMENT,
  deriveTasteClaims,
  matchesTasteClaim,
  projectTasteSpace2D,
  reconcileTasteClaims,
  tasteClaimId,
  tasteClaimScoreAdjustment,
  withTasteClaimFeedback
} from "./taste-claims.js";
import { buildTasteSpace } from "./taste-space.js";
import type { FeatureVector } from "./lens.js";
import type { Rating, RatingEntry, TasteClaim, TasteClaimCondition } from "./store/model.js";

const zero = (): FeatureVector => ({ pacing:0,tone:0,emotional_intensity:0,complexity:0,scope:0,realism:0,thematic_weight:0,character_focus:0,moral_clarity:0,structure:0 });
function entry(id: number, rating: Rating, genres: string[], keywords: string[], over: Partial<FeatureVector> = {}): RatingEntry {
  return { rating, ts:id, item:{ key:`movie:${id}`,medium:"movie",id,title:`Title ${id}`,year:2020,posterPath:null,voteAverage:7,genres,keywords,collection:null,directorIds:[],creatorIds:[],features:{...zero(),...over} } };
}

function simpleClaim(condition: TasteClaimCondition, effect: TasteClaim["effect"] = "positive"): TasteClaim {
  return { id:tasteClaimId(effect,[condition]),conditions:[condition],effect,confidence:.8,active:true,provenance:"inferred",evidence:{supportingItemKeys:["movie:1","movie:2","movie:3"],counterexampleItemKeys:[],tasteSpaceClusterIds:[],supportingWeight:3,counterexampleWeight:0,matchedItemCount:3} };
}

describe("taste claim derivation", () => {
  it("derives stable claims with exact evidence and TasteSpace provenance", () => {
    const entries = [
      entry(1,2,["Drama"],["satire"],{complexity:.8}),
      entry(2,1,["Drama"],["satire"],{complexity:.7}),
      entry(3,3,["Drama"],["satire"],{complexity:.9}),
      entry(4,-1,["Comedy"],["slapstick"],{complexity:-.8})
    ];
    const first = deriveTasteClaims(entries);
    expect(deriveTasteClaims(entries)).toEqual(first);
    const drama = first.find((claim) => claim.conditions.some((condition) => condition.kind === "genre" && condition.value === "Drama"));
    expect(drama).toMatchObject({ effect:"positive",provenance:"inferred",active:true });
    expect(drama?.evidence.supportingItemKeys).toEqual(["movie:1","movie:2","movie:3"]);
    expect(drama?.evidence.counterexampleItemKeys).toEqual([]);
    expect(drama?.evidence.tasteSpaceClusterIds.length).toBeGreaterThan(0);
  });

  it("supports tags, feature axes, collections, directors, and creators", () => {
    const structural = { id:9,name:"Example Collection",posterPath:null,backdropPath:null };
    const entries = [1,2,3].map((id) => {
      const value = entry(id,2,["Mystery"],["whodunit"],{complexity:.8});
      value.item.collection = structural;
      value.item.directorIds = [42];
      value.item.creatorIds = [77];
      return value;
    });
    const kinds = new Set(deriveTasteClaims(entries).flatMap((claim) => claim.conditions.map((condition) => condition.kind)));
    const expectedKinds: TasteClaimCondition["kind"][] = ["genre","tag","feature_axis","collection","director","creator"];
    for (const kind of expectedKinds) expect(kinds.has(kind)).toBe(true);
  });

  it("only creates a two-condition conjunction when it materially improves both parents", () => {
    const entries = [
      entry(1,2,["Science Fiction"],["cerebral"]),entry(2,2,["Science Fiction"],["cerebral"]),entry(3,2,["Science Fiction"],["cerebral"]),
      entry(4,-2,["Science Fiction"],["explosions"]),entry(5,-2,["Science Fiction"],["explosions"]),entry(6,-2,["Science Fiction"],["explosions"]),
      entry(7,-2,["Drama"],["cerebral"]),entry(8,-2,["Drama"],["cerebral"]),entry(9,-2,["Drama"],["cerebral"])
    ];
    const claims = deriveTasteClaims(entries);
    const conjunction = claims.find((claim) => claim.conditions.length === 2 && claim.conditions.some((condition) => condition.value === "Science Fiction") && claim.conditions.some((condition) => condition.value === "cerebral"));
    expect(conjunction).toMatchObject({ effect:"positive" });

    const insufficient = deriveTasteClaims(entries.slice(1));
    expect(insufficient.some((claim) => claim.id === conjunction?.id)).toBe(false);
  });

  it("keeps explicit rejection authoritative across deterministic regeneration", () => {
    const entries = [entry(1,2,["Drama"],[]),entry(2,2,["Drama"],[]),entry(3,2,["Drama"],[])];
    const inferred = deriveTasteClaims(entries).find((claim) => claim.conditions[0].value === "Drama")!;
    const rejected = withTasteClaimFeedback([inferred], inferred, "explicitly_rejected", 123);
    const reconciled = reconcileTasteClaims([...entries,entry(4,3,["Drama"],[])], rejected);
    expect(reconciled.find((claim) => claim.id === inferred.id)).toMatchObject({provenance:"explicitly_rejected",active:false,feedbackAt:123});

    expect(withTasteClaimFeedback([inferred], inferred, "user_confirmed", 124)[0]).toMatchObject({provenance:"user_confirmed",active:true});
    expect(withTasteClaimFeedback([inferred], inferred, "corrected", 125)[0]).toMatchObject({provenance:"corrected",active:false});
  });

  it("caps aggregate claim scoring influence and ignores inactive claims", () => {
    const condition: TasteClaimCondition = {kind:"genre",value:"Drama",label:"Drama"};
    const item = entry(10,1,["Drama"],[]).item;
    const many = Array.from({length:10},(_,index) => ({...simpleClaim(condition),id:`claim:${index}`}));
    expect(tasteClaimScoreAdjustment(item,many)).toBe(MAX_CLAIM_SCORE_ADJUSTMENT);
    expect(tasteClaimScoreAdjustment(item,many.map((claim) => ({...claim,active:false})))).toBe(0);
    expect(matchesTasteClaim(item,many[0]!)).toBe(true);
  });

  it("projects the same TasteSpace identically and marks weak claim regions", () => {
    const entries = [entry(1,2,["Drama"],[],{tone:-.8}),entry(2,2,["Drama"],[],{tone:-.7}),entry(3,2,["Drama"],[],{tone:-.9}),entry(4,-1,["Drama"],[],{tone:.5})];
    const space = buildTasteSpace(entries);
    const claims = deriveTasteClaims(entries);
    const first = projectTasteSpace2D(space,claims);
    expect(projectTasteSpace2D(space,claims)).toEqual(first);
    expect(first.some((point) => point.kind === "claim")).toBe(true);
    expect(first.some((point) => point.kind === "weak_region" && point.regionId?.startsWith("claim:"))).toBe(true);
  });
});
