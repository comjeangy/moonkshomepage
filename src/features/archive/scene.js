import * as THREE from '../../../assets/vendor/three.module.js';

const wrap = (value, length) => ((value % length) + length) % length;

/** Nine document cards on a curved orbit, adapted from the second profile's interaction. */
export function createArchiveScene(canvas, { onSelect, onUnavailable }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const world = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 100);
  camera.position.set(0, .55, 7.5);
  camera.lookAt(0, 0, 0);
  const loader = new THREE.TextureLoader();
  const textures = new Map();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const bodyGeometry = new THREE.BoxGeometry(1.64, 2.28, .055);
  const paperGeometry = new THREE.PlaneGeometry(1.61, 2.25);
  const faceGeometry = new THREE.PlaneGeometry(1, 1);
  const slots = [];
  const events = new AbortController();
  let records = [];
  let position = 0;
  let target = 0;
  let selected = -1;
  let frame = 0;
  let visible = true;
  let disposed = false;
  let drag = null;

  for (let index = 0; index < 9; index++) {
    const group = new THREE.Group();
    const backing = new THREE.Mesh(bodyGeometry, new THREE.MeshBasicMaterial({ color: '#d7d4e4' }));
    const paper = new THREE.Mesh(paperGeometry, new THREE.MeshBasicMaterial({ color: '#fff' }));
    const face = new THREE.Mesh(faceGeometry, new THREE.MeshBasicMaterial({ color: '#fff' }));
    paper.position.z = .029;
    face.position.z = .031;
    group.add(backing, paper, face);
    world.add(group);
    slots.push({ group, paper, face });
  }

  function requestDraw() {
    if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(draw);
  }

  function textureFor(record) {
    if (!textures.has(record.id)) {
      const texture = loader.load(record.thumb, requestDraw, undefined, requestDraw);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      textures.set(record.id, texture);
    }
    return textures.get(record.id);
  }

  function draw() {
    frame = 0;
    position = motion.matches ? target : position + (target - position) * .13;
    if (Math.abs(target - position) < .001) position = target;
    const center = Math.round(position);
    slots.forEach((slot, slotIndex) => {
      const offset = slotIndex - 4;
      const duplicate = records.length < 9 &&
        (offset < -Math.floor((records.length - 1) / 2) || offset > Math.ceil((records.length - 1) / 2));
      slot.group.visible = !!records.length && !duplicate;
      if (!slot.group.visible) return;
      const logical = center + offset;
      const record = records[wrap(logical, records.length)];
      const texture = textureFor(record);
      const distance = logical - position;
      const angle = distance * .43;
      slot.group.userData.logical = logical;
      slot.group.position.set(Math.sin(angle) * 4, .12 * Math.cos(angle), Math.cos(angle) * 2.8 - 2.8);
      slot.group.rotation.set(-.025, -angle * .85, -Math.sin(angle) * .035);
      slot.group.scale.setScalar(1 - .07 * Math.min(Math.abs(distance), 4));
      const loadedTexture = texture.image ? texture : null;
      if (slot.face.material.map !== loadedTexture) {
        slot.face.material.map = loadedTexture;
        slot.face.material.needsUpdate = true;
      }
      const ratio = texture.image ? texture.image.width / texture.image.height : .707;
      const height = Math.min(2.09, 1.45 / ratio);
      slot.face.scale.set(height * ratio, height, 1);
      const tint = 1 - Math.min(.24, Math.abs(distance) * .065);
      slot.face.material.color.setScalar(tint);
      slot.paper.material.color.setScalar(tint);
    });
    renderer.render(world, camera);
    canvas.dataset.ready = 'true';
    if (position !== target) requestDraw();
  }

  function notifySelection() {
    if (!records.length) return;
    const index = wrap(Math.round(target), records.length);
    if (selected !== index) { selected = index; onSelect(index); }
  }

  function step(delta) {
    if (!records.length) return;
    target = Math.round(target) + delta;
    notifySelection();
    requestDraw();
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width < 450 ? 6.7 : 7.5;
    camera.updateProjectionMatrix();
    requestDraw();
  }

  function listen(targetElement, name, handler, options = {}) {
    targetElement.addEventListener(name, handler, { ...options, signal: events.signal });
  }
  listen(canvas, 'pointerdown', (event) => {
    if (event.button !== 0 || !records.length) return;
    drag = { x: event.clientX, y: event.clientY, target, moved: false, pointerId: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
  });
  listen(canvas, 'pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) > 7) drag.moved = true;
    if (drag.moved && Math.abs(dx) > Math.abs(dy)) {
      target = drag.target - dx / (canvas.clientWidth * .24);
      notifySelection();
      requestDraw();
    }
  });
  function finishDrag(event, cancelled = false) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && !cancelled) {
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(slots.filter((slot) => slot.group.visible).map((slot) => slot.paper));
      if (hits.length) target = hits[0].object.parent.userData.logical;
    }
    target = Math.round(target);
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    notifySelection();
    requestDraw();
  }
  listen(canvas, 'pointerup', (event) => finishDrag(event));
  listen(canvas, 'pointercancel', (event) => finishDrag(event, true));
  listen(canvas, 'keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  listen(canvas, 'webglcontextlost', (event) => { event.preventDefault(); onUnavailable(); });
  listen(document, 'visibilitychange', requestDraw);
  listen(motion, 'change', requestDraw);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) { resize(); requestDraw(); }
  }, { rootMargin: '120px' });
  visibilityObserver.observe(canvas);
  resize();

  return {
    setRecords(next, index = 0) {
      records = next;
      position = target = index;
      selected = -1;
      notifySelection();
      requestDraw();
    },
    step,
    dispose() {
      disposed = true;
      events.abort();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      cancelAnimationFrame(frame);
      for (const texture of textures.values()) texture.dispose();
      bodyGeometry.dispose(); paperGeometry.dispose(); faceGeometry.dispose();
      for (const slot of slots) {
        slot.paper.material.dispose(); slot.face.material.dispose(); slot.group.children[0].material.dispose();
      }
      renderer.dispose();
    },
  };
}
