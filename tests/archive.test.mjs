import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createArchiveState } from '../src/features/archive/state.js';

const catalog = JSON.parse(await readFile(new URL('../data/archive.json', import.meta.url), 'utf8'));

test('selection wraps at both ends of the real catalog', () => {
  const state = createArchiveState(catalog);
  assert.equal(state.step(-1).record.id, catalog.at(-1).id);
  assert.equal(state.step(1).record.id, catalog[0].id);
});

test('category and search intersect, normalize case and reset selection', () => {
  const state = createArchiveState(catalog);
  state.step(10);
  const result = state.filter('자격증', '  ai  ');
  assert.equal(result.index, 0);
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every((record) => record.category === '자격증' && record.title.includes('AI')));
  assert.equal(state.step(-1).record.id, result.items.at(-1).id);
});

test('no-result search is safe to navigate and can be reset', () => {
  const state = createArchiveState(catalog);
  assert.equal(state.filter('전체', '존재하지않는자료').record, null);
  assert.equal(state.step(1).record, null);
  assert.equal(state.filter('전체', '').items.length, catalog.length);
  assert.equal(state.snapshot().record.id, catalog[0].id);
});

test('single-result search stays selected when stepping', () => {
  const state = createArchiveState(catalog);
  state.filter('자격증', 'GTQ');
  assert.equal(state.snapshot().items.length, 1);
  assert.equal(state.step(1).record.id, state.step(-1).record.id);
});

test('returned selection arrays cannot mutate the internal catalog', () => {
  const state = createArchiveState(catalog);
  state.snapshot().items.pop();
  assert.equal(state.snapshot().items.length, catalog.length);
  assert.equal(state.filter('알수없는분류').category, '전체');
});
