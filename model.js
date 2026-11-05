import * as THREE from './vendor/three.module.js';

// OpenSCADと同じmm座標・Z上向き。円周は$fn=96と同じ頂点数・位相。
export function createModel(type, v, material) {
  const group = new THREE.Group();
  function add(geometry, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); group.add(mesh);
  }
  function circlePath(radius, reverse = false) {
    const path = new THREE.Path();
    for (let i = 0; i <= 96; i++) {
      const angle = (reverse ? -1 : 1) * i * Math.PI * 2 / 96;
      const x = radius * Math.cos(angle), y = radius * Math.sin(angle);
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    path.closePath(); return path;
  }
  const extrude = (shape, height) => new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 });
  if (type === 'cylinder' || type === 'disk') {
    const shape = new THREE.Shape(circlePath(v.diameter / 2).getPoints());
    if (type === 'disk' && v.hole > 0) shape.holes.push(circlePath(v.hole / 2, true));
    add(extrude(shape, v.height));
  } else if (type === 'block') {
    add(new THREE.BoxGeometry(v.width, v.depth, v.height), v.width / 2, v.depth / 2, v.height / 2);
  } else if (type === 'box') {
    add(new THREE.BoxGeometry(v.width, v.depth, v.bottom), v.width / 2, v.depth / 2, v.bottom / 2);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(v.width, 0); shape.lineTo(v.width, v.depth); shape.lineTo(0, v.depth); shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(v.wall, v.wall); hole.lineTo(v.wall, v.depth - v.wall); hole.lineTo(v.width - v.wall, v.depth - v.wall); hole.lineTo(v.width - v.wall, v.wall); hole.closePath();
    shape.holes.push(hole);
    add(extrude(shape, v.height - v.bottom), 0, 0, v.bottom);
  }
  return group;
}
