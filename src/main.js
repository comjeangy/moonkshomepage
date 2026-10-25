import { initArchive } from './features/archive/index.js';

// Each feature owns its markup, events and state; the entry point only starts it.
initArchive(document.querySelector('[data-archive]'));
