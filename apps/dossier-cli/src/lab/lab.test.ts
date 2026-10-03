import { expect, test } from "vitest";
import { execute, type ActionCatalogue } from "../actions.js";
import type { CliStorage, Vault } from "../storage.js";
import { catalogue, personas, truth } from "./fixtures.js";

test("offline lab uses the same CLI actions without TMDB credentials", async () => {
  const items = catalogue();
  let vault: Vault = { activeId: null, profiles: [] };
  const storage = { root: "/offline-test", load: () => vault, save: (next: Vault) => { vault = next; }, audit: () => {} } as unknown as CliStorage;
  const fixture: ActionCatalogue = {
    detail: async (medium, id) => {
      const item = items.find((candidate) => candidate.medium === medium && candidate.id === id);
      if (!item) throw new Error("Unknown title");
      return item;
    },
    candidates: async () => items
  };
  const person = personas(0)[0]!;
  expect(personas(10)).toHaveLength(264);
  expect(items.every((item) => Number.isInteger(truth(person, item)))).toBe(true);
  const created = await execute(storage, "profile.create", { name: person.id }, fixture) as { revision: number };
  const rated = await execute(storage, "rate.set", { key: `movie:${items[0]!.id}`, value: truth(person, items[0]!), expectedRevision: created.revision }, fixture) as { revision: number };
  expect(rated.revision).toBe(created.revision + 1);
  const queue = await execute(storage, "rate.queue", { mode: "active", limit: 20 }, fixture) as { items: Array<{ id: string }>; next: string };
  expect(queue.items).toHaveLength(20);
  expect(queue.items.some((item) => item.id === `movie:${items[0]!.id}`)).toBe(false);
  const secondPage = await execute(storage, "rate.queue", { mode: "active", limit: 20, cursor: queue.next }, fixture) as { items: Array<{ id: string }> };
  expect(secondPage.items).toHaveLength(20);
  expect(secondPage.items.some((item) => queue.items.some((first) => first.id === item.id))).toBe(false);
  expect((await execute(storage, "taste.coverage", {}, fixture) as { ratings: number }).ratings).toBe(1);
});
