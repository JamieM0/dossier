import { createDefaultState, setLibraryRating } from '@dossier/domain';

// Use the application transition so repeated ratings replace earlier evidence.
export function replayLibrary(events, byKey) {
  let state = createDefaultState();
  for (const event of events) {
    const item = byKey.get(event.key);
    if (!item) throw new Error(`Missing public item: ${event.key}`);
    state = setLibraryRating(state, event.key, event.rating, { ...item, key: event.key }, event.ts);
  }
  return state;
}
