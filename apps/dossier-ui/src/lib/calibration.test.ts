import { describe, expect, it } from "vitest";
import { detectSurprise, dissonanceAssumptionFor, explainRating, predictionFor, rankDissonantCandidates, selectRateQuestion, tasteSnapshot } from "./calibration";
import { tasteClaimId } from "@dossier/domain";
import type { RatingEntry, TasteClaim, TmdbItem } from "./types";

const features = (n:number) => ({pacing:n,tone:n,emotional_intensity:n,complexity:n,scope:n,realism:n,thematic_weight:n,character_focus:n,moral_clarity:n,structure:n});
const vector = (over: Partial<TmdbItem["features"]>): TmdbItem["features"] => ({ ...features(0), ...over });
const item = (id:number, n:number, genre="Science Fiction", popularity=10):TmdbItem => ({id,medium:"movie",title:`Title ${id}`,year:2020,posterPath:null,voteAverage:7,voteCount:1000,popularity,runtime:120,genreIds:[],genres:[genre],keywords:["space travel"],collection:null,directorIds:[],creatorIds:[],overview:"",features:features(n)});
const entry = (id:number,n:number,rating:RatingEntry["rating"]):RatingEntry => ({item:{...item(id,n),key:`movie:${id}`},rating,ts:id});
const entryWith = (id:number, value: TmdbItem["features"], rating:RatingEntry["rating"], collection: TmdbItem["collection"] = null):RatingEntry => ({item:{...item(id,0),features:value,collection,key:`movie:${id}`},rating,ts:id});

describe("calibration decisions", () => {
  it("cold start selects the most recognisable candidate and records why", () => {
    const picked=selectRateQuestion([item(1,.2,"Drama",5),item(2,.3,"Drama",900)],[]);
    expect(picked?.item.id).toBe(2); expect(picked?.probeKind).toBe("cold_start");
  });
  it("later selection prioritises a candidate that resolves liked/disliked conflict", () => {
    const entries=[entry(1,.8,3),entry(2,.75,2),entry(3,.7,1),entry(4,.65,-3),entry(5,.6,-2)];
    const picked=selectRateQuestion([item(10,.7),item(11,-.8,"Comedy",900)],entries);
    expect(picked?.item.id).toBe(10);
    expect(picked?.probeKind).toBe("conflict_resolution");
    expect(picked?.evidence.clusterIds).toHaveLength(2);
    expect(picked?.evidence.itemKeys).toEqual(expect.arrayContaining(["movie:1", "movie:4"]));
  });
  it("uses TasteSpace weak regions for sparse probes", () => {
    const entries = [
      entryWith(1, vector({ pacing: 1 }), 2),
      entryWith(2, vector({ pacing: .9 }), 1),
      entryWith(3, vector({ tone: 1 }), -2),
      entryWith(4, vector({ tone: .9 }), -1),
      entryWith(5, vector({ pacing: .8 }), 1)
    ];
    const picked = selectRateQuestion([
      { ...item(10, 0, "Mystery"), features: vector({ complexity: 1 }) },
      { ...item(11, 0), features: vector({ pacing: 1 }) }
    ], entries);
    expect(picked?.item.id).toBe(10);
    expect(picked?.probeKind).toBe("sparse_region");
    expect(picked?.evidence.weakRegionIds[0]).toContain("sparse-");
  });
  it("identifies a liked/disliked boundary without relabelling it as cluster conflict", () => {
    const entries = [
      entryWith(1, vector({ pacing: 1 }), 2),
      entryWith(2, vector({ pacing: .9 }), 1),
      entryWith(3, vector({ pacing: .8 }), 1),
      entryWith(4, vector({ tone: 1 }), -2),
      entryWith(5, vector({ tone: .9 }), -1)
    ];
    const picked = selectRateQuestion([
      { ...item(12, 0), features: vector({ pacing: 1, tone: 1 }) }
    ], entries);
    expect(picked?.probeKind).toBe("boundary");
    expect(picked?.reason).toContain("sharpens that boundary");
  });
  it("surfaces an unrated member of a represented collection as set completion", () => {
    const collection = { id: 99, name: "The Example Collection", posterPath: null, backdropPath: null };
    const entries = [
      entryWith(1, vector({ pacing: 1 }), 2, collection),
      entryWith(2, vector({ pacing: .9 }), 1),
      entryWith(3, vector({ pacing: .8 }), 1),
      entryWith(4, vector({ tone: 1 }), -2),
      entryWith(5, vector({ tone: .9 }), -1)
    ];
    const candidate = { ...item(20, 0), collection, features: vector({ pacing: 1 }) };
    const picked = selectRateQuestion([candidate], entries);
    expect(picked?.probeKind).toBe("collection_completion");
    expect(picked?.evidence.collection).toMatchObject({ id: 99, ratedItemKeys: ["movie:1"] });
    expect(picked?.reason).toContain("The Example Collection");
  });
  it("selects deterministically regardless of candidate input order", () => {
    const entries=[entry(1,.8,3),entry(2,.75,2),entry(3,.7,1),entry(4,.65,-3),entry(5,.6,-2)];
    const candidates=[item(31,-.8,"Comedy",10),item(30,-.8,"Comedy",10)];
    const first=selectRateQuestion(candidates,entries);
    const reversed=selectRateQuestion([...candidates].reverse(),entries);
    expect(first?.item.id).toBe(30);
    expect(reversed).toEqual(first);
  });
  it("rating semantics and strength remain distinct", () => {
    const p={score:40,evidence:"some" as const,expected:"uncertain" as const};
    expect(explainRating(item(1,.2),3,p)).toContain("strong positive");
    expect(explainRating(item(1,.2),.5,p)).toContain("weak positive");
    expect(explainRating(item(1,.2),-.5,p)).toContain("lack of interest");
  });
  it("only meaningful, evidenced errors trigger surprise", () => {
    const entries=Array.from({length:6},(_,i)=>entry(i,.8,2));
    const before=predictionFor(item(20,.8),entries);
    const surprise = detectSurprise(item(20,.8),-2,before,entries);
    expect(surprise?.direction).toBe("negative");
    expect(surprise?.options[0].claim).toMatchObject({effect:"negative",active:false,provenance:"inferred"});
    expect(surprise?.options[0].claim.evidence.supportingItemKeys).toContain("movie:20");
    const rejected = surprise!.options.map((option) => ({...option.claim,provenance:"explicitly_rejected" as const,active:false}));
    expect(detectSurprise(item(20,.8),-2,before,entries,rejected)).toBeNull();
    expect(detectSurprise(item(20,.8),-1,{...before,score:45},entries)).toBeNull();
  });
  it("prioritises a candidate that could falsify an active claim", () => {
    const entries=[entryWith(1,vector({pacing:1}),2),entryWith(2,vector({pacing:.9}),2),entryWith(3,vector({pacing:.8}),2),entryWith(4,vector({tone:1}),-2),entryWith(5,vector({tone:.9}),-2)];
    const condition={kind:"genre" as const,value:"Science Fiction",label:"Science Fiction"};
    const claim:TasteClaim={id:tasteClaimId("positive",[condition]),conditions:[condition],effect:"positive",confidence:.8,provenance:"user_confirmed",active:true,evidence:{supportingItemKeys:["movie:1","movie:2","movie:3"],counterexampleItemKeys:[],tasteSpaceClusterIds:[],supportingWeight:6,counterexampleWeight:0,matchedItemCount:3}};
    const falsifier={...item(40,0,"Science Fiction"),features:vector({tone:1})};
    const ordinary={...item(41,0,"Drama",900),features:vector({pacing:1})};
    const picked=selectRateQuestion([ordinary,falsifier],entries,undefined,[claim]);
    expect(picked?.item.id).toBe(40);
    expect(picked?.probeKind).toBe("claim_falsification");
    expect(picked?.evidence.claimIds).toEqual([claim.id]);
  });
  it("dissonance ranks only evidenced low predictions and breaks ties by recognisability", () => {
    const entries=Array.from({length:6},(_,i)=>entry(i,.8,2));
    const outside=item(20,-.8,"Comedy",900);
    const furtherOutside=item(21,-1,"Horror",10);
    const familiar=item(22,.8,"Science Fiction",900);
    const ranked=rankDissonantCandidates([outside,familiar,furtherOutside],entries);
    expect(ranked.map(x=>x.item.id)).toEqual([20,21]);
    expect(ranked.every(x=>x.prediction.score<=25)).toBe(true);
  });
  it("dissonance stays empty until the model has enough meaningful evidence", () => {
    expect(rankDissonantCandidates([item(20,-1)],[entry(1,1,2)])).toEqual([]);
  });
  it("states the concrete assumption behind a low-match challenge", () => {
    const entries=Array.from({length:6},(_,i)=>entry(i,1,2));
    const candidate=item(20,-1,"Drama");
    const assumption=dissonanceAssumptionFor(candidate,entries,{score:0,evidence:"some",expected:"dislike"});
    expect(assumption.summary).toContain("slower pacing");
    expect(assumption.summary).toContain("faster pacing");
    expect(assumption.summary).toContain("Title 0");
    expect(assumption.summary).toContain("0% taste match");
  });
  it("grounds a challenge in a similar negative rating when one exists", () => {
    const entries=[...Array.from({length:5},(_,i)=>entry(i,1,2)),entry(90,-.9,-2)];
    const assumption=dissonanceAssumptionFor(item(20,-1),entries,{score:5,evidence:"some",expected:"dislike"});
    expect(assumption.summary).toContain("resembles Title 90");
    expect(assumption.summary).toContain("rated negatively");
  });
  it("snapshot requires repeated consistent evidence for a strong area", () => {
    expect(tasteSnapshot([entry(1,.2,3)] )[0].status).toBe("learning");
    expect(tasteSnapshot([entry(1,.2,3),entry(2,.2,2),entry(3,.2,1),entry(4,.2,2)])[0].status).toBe("strong");
  });
});
