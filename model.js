import * as THREE from './vendor/three.module.js';
import './mesh.js';

export function createModel(type, v, material, segments = 96) {
  const data = globalThis.ScadMesh.createMesh(type, v, segments);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.vertices.flat(), 3));
  geometry.setIndex(data.faces.flat());
  // 面ごとの法線。STLと同じ三角形を表示する。
  const flat = geometry.toNonIndexed(); geometry.dispose(); flat.computeVertexNormals();
  const group = new THREE.Group(); group.add(new THREE.Mesh(flat, material)); return group;
}
