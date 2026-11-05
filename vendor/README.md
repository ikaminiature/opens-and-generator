# Three.js

Three.js 0.160.1 (MIT), downloaded from the official npm package `three@0.160.1`.

- `three.module.js`: upstream `build/three.module.min.js`
- `OrbitControls.js`: upstream `examples/jsm/controls/OrbitControls.js`; only the import specifier was changed from `three` to `./three.module.js` for static hosting without an import map or build tools.
- `THREE-LICENSE.txt`: upstream license.

All runtime dependencies are served from this repository. No CDN request is required.
