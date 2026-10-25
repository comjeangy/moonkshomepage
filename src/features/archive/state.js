/** Pure selection model shared by the WebGL and regular image views. */
export function createArchiveState(records) {
  let category = '전체';
  let query = '';
  let items = [...records];
  let index = 0;
  const categories = ['전체', ...new Set(records.map((record) => record.category))];
  const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('ko').trim();
  const snapshot = () => ({ category, query, items: [...items], index, record: items[index] ?? null });

  return {
    categories,
    snapshot,
    filter(nextCategory = category, nextQuery = query) {
      category = categories.includes(nextCategory) ? nextCategory : '전체';
      query = nextQuery;
      const term = normalize(query);
      items = records.filter((record) =>
        (category === '전체' || record.category === category) &&
        normalize(`${record.title} ${record.category}`).includes(term));
      index = 0;
      return snapshot();
    },
    select(nextIndex) {
      index = items.length ? ((nextIndex % items.length) + items.length) % items.length : 0;
      return snapshot();
    },
    step(delta) { return this.select(index + delta); },
  };
}
