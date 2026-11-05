(function (root) {
  const shapes = {
    cylinder: { name: '円柱', fields: [['diameter', '直径', 30], ['height', '高さ', 20]] },
    disk: { name: '円盤', fields: [['diameter', '直径', 40], ['height', '高さ', 3], ['hole', '中心穴の直径', 10]] },
    block: { name: '直方体', fields: [['width', '幅', 40], ['depth', '奥行き', 30], ['height', '高さ', 20]] },
    box: { name: '中空の箱', fields: [['width', '外寸の幅', 60], ['depth', '外寸の奥行き', 40], ['height', '外寸の高さ', 30], ['wall', '壁厚', 2], ['bottom', '底面の厚さ', 2]] }
  };
  function generate(type, raw) {
    const shape = shapes[type];
    if (!shape) return { errors: ['形状を選択してください。'], code: '' };
    const values = {}, errors = [];
    for (const [key, label] of shape.fields) {
      const input = raw[key];
      const value = Number(input);
      if (input == null || String(input).trim() === '' || !Number.isFinite(value) || (key === 'hole' ? value < 0 : value <= 0)) {
        errors.push(`${label}は${key === 'hole' ? '0以上' : '0より大きい'}の数値で入力してください。`);
      }
      values[key] = value;
    }
    const { diameter, height, hole, width, depth, wall, bottom } = values;
    if (!errors.length) {
      if (type === 'disk' && hole >= diameter) errors.push('中心穴の直径は外側の直径より小さくしてください。');
      if (type === 'box') {
        if (wall * 2 >= width || wall * 2 >= depth) errors.push('壁厚の2倍は外寸の幅・奥行きより小さくしてください。');
        if (bottom >= height) errors.push('底面の厚さは外寸の高さより小さくしてください。');
      }
    }
    if (errors.length) return { errors, code: '' };
    const header = `// ${shape.name} / 単位: mm\n$fn = 96;\n\n`;
    let body;
    if (type === 'cylinder') body = `cylinder(d = ${diameter}, h = ${height});`;
    if (type === 'block') body = `cube([${width}, ${depth}, ${height}]);`;
    if (type === 'disk') body = hole === 0 ? `cylinder(d = ${diameter}, h = ${height});` : `difference() {\n  cylinder(d = ${diameter}, h = ${height});\n  translate([0, 0, -0.01])\n    cylinder(d = ${hole}, h = ${height} + 0.02);\n}`;
    if (type === 'box') body = `difference() {\n  cube([${width}, ${depth}, ${height}]);\n  translate([${wall}, ${wall}, ${bottom}])\n    cube([${width} - 2 * ${wall}, ${depth} - 2 * ${wall}, ${height} - ${bottom} + 0.01]);\n}`;
    return { errors, code: header + body + '\n' };
  }
  const api = { shapes, generate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScadGenerator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
