import { createArchiveState } from './state.js';
import { setupDialog } from '../../lib/dialog.js';

/** Coordinates the archive. The renderer never reads or changes DOM outside its canvas. */
export async function initArchive(root) {
  const find = (selector) => root.querySelector(selector);
  const status = find('[data-status]');
  const canvas = find('[data-canvas]');
  const layout = find('[data-layout]');
  const search = find('[data-search]');
  const dialog = find('[data-dialog]');
  const viewer = setupDialog(dialog);
  let state;
  let scene = null;
  let dialogRecord = null;

  function renderSelection() {
    const { record, index, items } = state.snapshot();
    find('[data-count]').textContent = items.length ? `${index + 1} / ${items.length}` : '0 / 0';
    find('[data-prev]').disabled = items.length < 2;
    find('[data-next]').disabled = items.length < 2;
    if (!record) return;
    const image = find('[data-preview-image]');
    image.src = record.image;
    image.alt = `${record.title} · 개인정보 가림 처리본`;
    find('[data-title]').textContent = record.title;
    find('[data-category]').textContent = record.category;
    find('[data-number]').textContent = String(index + 1).padStart(2, '0');
    find('[data-enlarge]').setAttribute('aria-label', `${record.title} 크게 보기`);
    const fallbackImage = find('[data-fallback-image]');
    fallbackImage.src = record.thumb;
    fallbackImage.alt = record.title;
  }

  function filter(category, query = search.value) {
    const selection = state.filter(category, query);
    for (const button of find('[data-filters]').children) {
      button.setAttribute('aria-pressed', String(button.dataset.filterCategory === selection.category));
    }
    layout.hidden = !selection.items.length;
    find('[data-empty]').hidden = !!selection.items.length;
    status.textContent = selection.query || selection.category !== '전체'
      ? `${selection.category} · ${selection.items.length}개의 기록` : '';
    scene?.setRecords(selection.items, selection.index);
    renderSelection();
  }

  function step(delta) {
    if (scene) scene.step(delta);
    else { state.step(delta); renderSelection(); }
  }

  function showFallback() {
    scene?.dispose();
    scene = null;
    canvas.hidden = true;
    find('.orbit-floor').hidden = true;
    find('[data-fallback]').hidden = false;
    find('[data-orbit-label]').textContent = 'EXPLORE THE ARCHIVE';
    find('.orbit-hint').textContent = '좌우 버튼으로 자료를 선택하세요';
  }

  try {
    const response = await fetch(new URL('../../../data/archive.json', import.meta.url));
    if (!response.ok) throw new Error(`Archive HTTP ${response.status}`);
    const records = await response.json();
    if (!Array.isArray(records) || !records.length) throw new Error('Empty archive');
    // Resolve relative to this module, so /moonkshomepage/ and local previews both work.
    const base = new URL('../../../', import.meta.url);
    for (const record of records) {
      record.image = new URL(record.image, base).href;
      record.thumb = new URL(record.thumb, base).href;
    }
    state = createArchiveState(records);
    for (const category of state.categories) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = category;
      button.dataset.filterCategory = category;
      button.addEventListener('click', () => filter(category));
      find('[data-filters]').append(button);
    }
    filter('전체');
  } catch (error) {
    status.textContent = '자료를 불러오지 못했습니다. 페이지를 새로고침해 주세요.';
    console.error('Archive could not load:', error);
    return;
  }

  find('[data-prev]').addEventListener('click', () => step(-1));
  find('[data-next]').addEventListener('click', () => step(1));
  search.addEventListener('input', () => filter(state.snapshot().category));
  find('[data-reset]').addEventListener('click', () => {
    search.value = '';
    filter('전체', '');
    search.focus();
  });
  find('[data-enlarge]').addEventListener('click', () => {
    const { record } = state.snapshot();
    if (!record) return;
    dialogRecord = record;
    find('[data-dialog-title]').textContent = record.title;
    const image = find('[data-dialog-image]');
    image.src = record.image;
    image.alt = `${record.title} · 개인정보 가림 처리본`;
    const link = find('[data-download]');
    link.href = record.image;
    link.download = `${record.title}-가림처리.webp`;
    setZoom(false);
    viewer.open();
    find('.document-stage').scrollTo(0, 0);
  });
  function setZoom(zoomed) {
    find('.document-stage').classList.toggle('is-zoomed', zoomed);
    find('[data-zoom]').setAttribute('aria-pressed', String(zoomed));
    find('[data-zoom]').textContent = zoomed ? '화면에 맞추기 －' : '원본 크기로 보기 ＋';
  }
  find('[data-zoom]').addEventListener('click', () => {
    if (dialogRecord) setZoom(find('[data-zoom]').getAttribute('aria-pressed') !== 'true');
  });

  // Load Three.js only when the archive approaches the viewport.
  const observer = new IntersectionObserver(async ([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    try {
      const { createArchiveScene } = await import('./scene.js');
      scene = createArchiveScene(canvas, {
        onSelect(index) { state.select(index); renderSelection(); },
        onUnavailable: showFallback,
      });
      const current = state.snapshot();
      scene.setRecords(current.items, current.index);
    } catch (error) {
      console.warn('Using regular archive view:', error);
      showFallback();
    }
  }, { rootMargin: '600px' });
  observer.observe(root);
}
