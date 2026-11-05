const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 820, height: 1180 }, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:8000');
  await page.waitForSelector('#preview[data-ready="true"]');
  const results = await page.evaluate(async () => {
    const THREE = await import('./vendor/three.module.js');
    const { createModel } = await import('./model.js');
    const cases = [
      ['cylinder', { diameter: 30, height: 20 }, [30, 30, 20], 96 / 2 * Math.sin(2 * Math.PI / 96) * 15 ** 2 * 20],
      ['disk', { diameter: 40, hole: 10, height: 3 }, [40, 40, 3], 96 / 2 * Math.sin(2 * Math.PI / 96) * (20 ** 2 - 5 ** 2) * 3],
      ['disk', { diameter: 20, hole: 0, height: 2 }, [20, 20, 2], 96 / 2 * Math.sin(2 * Math.PI / 96) * 10 ** 2 * 2],
      ['block', { width: 12.5, depth: 20, height: 3 }, [12.5, 20, 3], 12.5 * 20 * 3],
      ['box', { width: 60, depth: 40, height: 30, wall: 2, bottom: 3 }, [60, 40, 30], 60 * 40 * 30 - 56 * 36 * 27]
    ];
    return cases.map(([type, v, expected, expectedVolume]) => {
      const model = createModel(type, v, new THREE.MeshBasicMaterial());
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).toArray();
      let volume = 0;
      model.children.forEach(mesh => {
        const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
        const p = geo.attributes.position;
        for(let i = 0; i < p.count; i += 3) {
          const a = new THREE.Vector3().fromBufferAttribute(p, i).add(mesh.position);
          const b = new THREE.Vector3().fromBufferAttribute(p, i+1).add(mesh.position);
          const c = new THREE.Vector3().fromBufferAttribute(p, i+2).add(mesh.position);
          volume += a.dot(b.cross(c)) / 6;
        }
      });
      const center = type === 'box' ? [v.width / 2, v.depth / 2] : [0, 0];
      model.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(new THREE.Vector3(...center, v.height + 10), new THREE.Vector3(0, 0, -1));
      const hits = ray.intersectObject(model, true);
      return { type, size, expected, volume, expectedVolume, centerTop: hits[0]?.point.z };
    });
  });
  for (const r of results) {
    r.size.forEach((n, i) => assert.ok(Math.abs(n - r.expected[i]) < 0.0001));
    assert.ok(Math.abs(r.volume / r.expectedVolume - 1) < 0.00001, JSON.stringify(r));
    if (r.type === 'box') assert.ok(Math.abs(r.centerTop - 3) < 0.0001);
    if (r.type === 'disk' && r.expected[0] === 40) assert.equal(r.centerTop, undefined);
  }
  await page.locator('#height').fill('50');
  await page.waitForFunction(() => document.querySelector('#preview-status').textContent.includes('高さ 50 mm'));
  for (const view of ['正面', '上面', '側面', '全体']) {
    const b = page.getByRole('button', { name: view, exact: true }); await b.click();
    assert.equal(await b.getAttribute('aria-pressed'), 'true');
  }
  await page.locator('#preview').scrollIntoViewIfNeeded();
  const canvas = page.locator('#preview canvas');
  const before = await canvas.screenshot();
  const rect = await canvas.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 70, y: y + 20, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const rotated = await canvas.screenshot(); assert.equal(before.equals(rotated), false);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 70, y, id: 1 }, { x: x + 70, y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(rotated.equals(await canvas.screenshot()), false);
  await page.locator('#height').fill('');
  assert.match(await page.locator('#preview-status').textContent(), /寸法を修正/);
  assert.deepEqual(errors, []);
  await browser.close(); console.log('PASS: 全形状の外寸・体積・穴と底厚、寸法連動、4視点、1本指回転、2本指ズーム、入力エラー');
})().catch(e => { console.error(e); process.exitCode = 1; });
