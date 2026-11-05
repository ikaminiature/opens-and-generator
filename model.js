import * as THREE from './vendor/three.module.js';
import './mesh.js';
import './fitting.js';

export function createModel(type, v, material, segments = 96, assembled = false, secondMaterial = material) {
  if (type === 'fitting') {
    const pair = new THREE.Group(), placement = globalThis.Fitting.placement(v, assembled);
    const a = createModel('fittingA', v, material, segments);
    const b = createModel('fittingB', v, secondMaterial, segments);
    a.name = 'partA'; b.name = 'partB';
    if (placement.flip) a.rotation.x = Math.PI;
    a.position.set(...placement.a); b.position.set(...placement.b);
    pair.add(a, b); return pair;
  }
  const data = globalThis.ScadMesh.createMesh(type, v, segments);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.vertices.flat(), 3));
  geometry.setIndex(data.faces.flat());
  // 面ごとの法線。STLと同じ三角形を表示する。
  const flat = geometry.toNonIndexed(); geometry.dispose(); flat.computeVertexNormals();
  const group = new THREE.Group(); group.add(new THREE.Mesh(flat, material)); return group;
}
