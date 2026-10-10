import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCompatibility} from '../src/compatibility.mjs';
import {createAppearance} from '../src/theme.mjs';

test('compatibility registry groups paired surfaces, text and interaction colors',()=>{
  const registry=createCompatibility(),model=createAppearance();
  for(const textMode of ['light','dark','auto']){
    model.set({textMode});
    for(const darkSystem of [true,false]){
      const p=model.palette(darkSystem),r=registry.resolve(p,model.get(),(color,alpha)=>`${color}/${alpha}`);
      for(const name of ['background-panel','background-page-search','background-primary-soft','background-primary-soft-alpha','background-primary-soft-hover','background-primary-soft-active'])assert.ok(r.families.surface[name]);
      assert.equal(r.families.neutral['text-primary'],p.text);
      assert.equal(r.families.neutral['text-disabled'],p.muted);
      assert.equal(r.families.action['background-primary-solid'],p.accent);
      assert.equal(r.families.action['text-primary-solid'],p.background);
      assert.equal(Object.values(r.families).reduce((n,g)=>n+Object.keys(g).length,0),Object.keys(r.tokens).length);
      assert.ok(!Object.keys(r.tokens).some(k=>/danger|success|warning|error/.test(k)),'semantic status colors remain native');
    }
  }
});

 test('surface alpha distinguishes transient overlays from opaque native surfaces',()=>{
  const {surfaceAlpha}=createCompatibility();
  for(const color of ['rgba(26, 28, 31, 0.055)','oklab(0.22559 -0.00131416 -0.00642684 / 0.05)','rgb(10 20 30 / 5%)'])assert.ok(surfaceAlpha(color)<.9);
  for(const color of ['rgb(255, 255, 255)','oklab(1 0 0)','color(display-p3 1 1 1 / 100%)'])assert.equal(surfaceAlpha(color),1);
  assert.equal(surfaceAlpha('transparent'),0);
});
