import { createDefaultState, setLibraryRating } from '@dossier/domain';

// Use the application transition so repeated ratings replace earlier evidence.
export function replayLibrary(events, byKey) {
  let state = createDefaultState();
  for (const event of events) {
    const item = byKey.get(event.key);
    if (!item) throw new Error(`Missing public item: ${event.key}`);
    const snapshot = { key: event.key, medium: item.medium, id: item.id, title: item.title, year: item.year,
      posterPath: item.posterPath, voteAverage: item.voteAverage, genres: item.genres, keywords: item.keywords,
      collection: item.collection, directorIds: item.directorIds, creatorIds: item.creatorIds, features: item.features };
    state = setLibraryRating(state, event.key, event.rating, snapshot, event.ts);
  }
  return state;
}
