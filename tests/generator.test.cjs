const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shapes, generate } = require('../generator');
for (const [type, shape] of Object.entries(shapes)) {
  test(`${type}: 既定値でコードを生成`, () => {
    const values = Object.fromEntries(shape.fields.map(([key, , value]) => [key, value]));
    const result = generate(type, values);
    assert.deepEqual(result.errors, []);
    assert.match(result.code, /\$fn = 96;/);
  });
}
test('不正な寸法を拒否', () => {
  for (const diameter of ['', ' ', -1, 0, 'abc', Infinity]) assert.ok(generate('cylinder', { diameter, height: 10 }).errors.length);
  assert.ok(generate('disk', { diameter: 20, height: 2, hole: 20 }).errors.length);
  assert.ok(generate('box', { width: 10, depth: 20, height: 10, wall: 5, bottom: 1 }).errors.length);
  assert.ok(generate('box', { width: 10, depth: 20, height: 10, wall: 1, bottom: 10 }).errors.length);
});
test('穴なし円盤と小数寸法', () => {
  assert.equal(generate('disk', { diameter: 20.5, height: 2, hole: 0 }).code.includes('difference'), false);
  assert.match(generate('cylinder', { diameter: '12.5', height: '0.2' }).code, /d = 12.5, h = 0.2/);
});
