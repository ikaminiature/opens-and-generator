import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createModel } from './model.js';

const host = document.getElementById('preview');
const status = document.getElementById('preview-status');
try {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0xf0f4ec);
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.001, 100);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.minDistance = 0.15; controls.maxDistance = 15;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  controls.maxPolarAngle = Math.PI * 0.98;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x718679, 2));
  const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(3, -4, 6); scene.add(key);
  const fill = new THREE.DirectionalLight(0xd1e8ff, 1.5); fill.position.set(-3, 2, 3); scene.add(fill);
  const material = new THREE.MeshStandardMaterial({ color: 0xd6a254, roughness: 0.65, metalness: 0.06, flatShading: true });
  const secondMaterial = material.clone(); secondMaterial.color.set(0x528db6);
  let model, grid, height = 1, view = 'iso', valid = false;
  const draw = () => renderer.render(scene, camera);
  controls.addEventListener('change', draw);
  function setView(next = view) {
    view = next;
    controls.target.set(0, 0, height / 2);
    const direction = { front: [0, -1, 0], top: [0, -0.00001, 1], side: [1, 0, 0], iso: [1.2, -1.6, 1.2] }[view];
    // モデルの外接球を縦横どちらにも収める。全軸を同率で表示する。
    const fov = Math.min(camera.fov * Math.PI / 180, 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
    const distance = 0.9 / Math.sin(fov / 2);
    camera.position.copy(controls.target).add(new THREE.Vector3(...direction).normalize().multiplyScalar(distance));
    controls.update(); draw();
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  }
  function dispose(object) {
    if (!object) return;
    scene.remove(object);
    object.traverse(o => { o.geometry?.dispose(); });
    if (object === grid) object.material.dispose();
  }
  function update() {
    const state = window.scadPreviewState;
    if (!state) return;
    dispose(model); model = null;
    valid = state.valid;
    if (!valid) {
      status.textContent = '寸法を修正すると3Dプレビューを表示します。'; draw(); return;
    }
    const v = Object.fromEntries(Object.entries(state.raw).map(([k, value]) => [k, (k === 'edit' || k === 'fillet') ? value : Number(value)]));
    model = createModel(state.type, v, material, state.segments, state.assembled, secondMaterial);
    const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
    const scale = 1 / Math.max(size.x, size.y, size.z);
    const center = bounds.getCenter(new THREE.Vector3());
    model.scale.setScalar(scale); model.position.set(-center.x * scale, -center.y * scale, 0);
    height = size.z * scale; scene.add(model);
    dispose(grid);
    const rawStep = Math.max(size.x, size.y, size.z) / 10;
    const base = 10 ** Math.floor(Math.log10(rawStep));
    const step = [1, 2, 5, 10].map(n => n * base).find(n => n >= rawStep);
    grid = new THREE.GridHelper(step * 20 * scale, 20, 0x859e8c, 0xc9d7c8);
    grid.rotation.x = Math.PI / 2; grid.position.z = -0.001; scene.add(grid);
    status.textContent = `グリッド1マス：${Number(step.toPrecision(6))} mm / 幅 ${Number(size.x.toPrecision(7))} × 奥行き ${Number(size.y.toPrecision(7))} × 高さ ${Number(size.z.toPrecision(7))} mm`;
    setView();
    host.dataset.ready = 'true';
  }
  new ResizeObserver(() => {
    const width = host.clientWidth, h = host.clientHeight;
    renderer.setSize(width, h); camera.aspect = width / h; camera.updateProjectionMatrix(); setView();
  }).observe(host);
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  window.addEventListener('scad-preview-update', update);
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); status.textContent = '3D描画が中断されました。ページを再読み込みしてください。コード生成は引き続き使えます。'; });
  update();
} catch (error) {
  status.textContent = '3D表示を開始できませんでした。Safariの更新・再読み込みをお試しください。コード生成と保存は引き続き使えます。';
  host.textContent = '3Dプレビューは利用できません。';
}
