import { expect, test } from "vitest";
import { parse } from "./arguments.js";

test("rank accepts every positional item ID", () => {
  const result = parse(["refine", "rank", "movie:603", "movie:329865", "movie:438631"]);
  expect(result.action).toBe("refine.rank");
  expect(result.args.keys).toEqual(["movie:603", "movie:329865", "movie:438631"]);
});

test("suggest explain resolves to the inspect action", () => {
  const result = parse(["suggest", "explain", "movie:335984"]);
  expect(result.action).toBe("suggest.explain");
  expect(result.args.key).toBe("movie:335984");
});

test("credential values are rejected as command arguments", () => {
  expect(() => parse(["tmdb", "set", "--token", "secret"])).toThrow("prompt or stdin");
  expect(() => parse(["tmdb", "set-key", "--api-key", "secret"])).toThrow("prompt or stdin");
});
