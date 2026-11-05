import Module from './vendor/manifold/manifold.js';
import './chamfer.js';
try {
 const engine=await Module({locateFile:()=>new URL('./vendor/manifold/manifold.wasm',import.meta.url).href});engine.setup();
 globalThis.ChamferCore.install(engine);window.organizerUI?.update();
} catch(error){
 globalThis.chamferLoadError='面取りエンジンを読み込めませんでした。ページを再読み込みしてください。';window.organizerUI?.update();
}
