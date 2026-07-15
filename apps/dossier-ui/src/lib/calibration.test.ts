import { describe, expect, it } from "vitest";
import { detectSurprise, explainRating, predictionFor, selectRateQuestion, tasteSnapshot } from "./calibration";
import type { RatingEntry, TmdbItem } from "./types";

const features = (n:number) => ({pacing:n,tone:n,emotional_intensity:n,complexity:n,scope:n,realism:n,thematic_weight:n,character_focus:n,moral_clarity:n,structure:n});
const item = (id:number, n:number, genre="Science Fiction", popularity=10):TmdbItem => ({id,medium:"movie",title:`Title ${id}`,year:2020,posterPath:null,voteAverage:7,voteCount:1000,popularity,runtime:120,genreIds:[],genres:[genre],keywords:["space travel"],overview:"",features:features(n)});
const entry = (id:number,n:number,rating:RatingEntry["rating"]):RatingEntry => ({item:{...item(id,n),key:`movie:${id}`},rating,ts:id});

describe("calibration decisions", () => {
  it("cold start selects the most recognisable candidate and records why", () => {
    const picked=selectRateQuestion([item(1,.2,"Drama",5),item(2,.3,"Drama",900)],[]);
    expect(picked?.item.id).toBe(2); expect(picked?.reason.kind).toBe("cold_start");
  });
  it("later selection prioritises a candidate that resolves liked/disliked conflict", () => {
    const entries=[entry(1,.8,3),entry(2,.75,2),entry(3,.7,1),entry(4,.65,-3),entry(5,.6,-2)];
    const picked=selectRateQuestion([item(10,.7),item(11,-.8,"Comedy",900)],entries);
    expect(picked?.item.id).toBe(10); expect(picked?.reason.kind).toBe("conflict");
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
    expect(detectSurprise(item(20,.8),-2,before,entries)?.direction).toBe("negative");
    expect(detectSurprise(item(20,.8),-1,{...before,score:45},entries)).toBeNull();
  });
  it("snapshot requires repeated consistent evidence for a strong area", () => {
    expect(tasteSnapshot([entry(1,.2,3)] )[0].status).toBe("learning");
    expect(tasteSnapshot([entry(1,.2,3),entry(2,.2,2),entry(3,.2,1),entry(4,.2,2)])[0].status).toBe("strong");
  });
});
