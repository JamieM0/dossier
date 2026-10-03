// Frozen candidate from the original study. No hidden answers enter this function.
export function reviewsPlusTags(candidates, observed) {
  const tokens = item => new Set([...item.genres.map(tag => `genre:${tag.toLowerCase()}`), ...item.keywords.map(tag => `tag:${tag.toLowerCase()}`)]);
  const rated = observed.map(row => ({ ...row, tokens: tokens(row.item) }));
  const similarity = (a, b) => a.size && b.size ? [...a].filter(tag => b.has(tag)).length / Math.sqrt(a.size * b.size) : 0;
  return Object.fromEntries(candidates.map(item => {
    const tags = tokens(item);
    const liked = rated.filter(row => row.rating > 0).map(row => similarity(tags, row.tokens));
    const disliked = rated.filter(row => row.rating < 0).map(row => similarity(tags, row.tokens));
    const match = (liked.length ? Math.max(...liked) : 0) - .6 * (disliked.length ? Math.max(...disliked) : 0);
    const quality = (item.voteAverage ?? 0) / 10;
    return [`${item.medium}:${item.id}`, .75 * quality + .25 * (match + .6) / 1.6];
  }));
}
