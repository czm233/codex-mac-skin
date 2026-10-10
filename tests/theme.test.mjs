import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAppearance} from '../src/theme.mjs';

test('appearance schema validates atomically and resolves automatic palettes',()=>{
  const model=createAppearance();
  model.set({textMode:'auto',info:0,focusX:87,colors:{accent:'#12ab34ff'}});
  assert.equal(model.palette(true).text,'#eef5fc');
  assert.equal(model.palette(false).text,'#17232e');
  assert.equal(model.palette(false).accent,'#12ab34ff');
  const before=model.get();
  for(const patch of [{info:1.1},{focusX:NaN},{safeArea:'top'},{taskMode:'script'},{colors:{text:'red;display:none'}},{colors:{unknown:'#ffffff'}},JSON.parse('{"__proto__":{}}'),{info:.5,unknown:1}])assert.throws(()=>model.set(patch));
  assert.deepEqual(model.get(),before,'invalid import does not partially apply');
  const copy=model.get();copy.colors.accent='#ffffff';assert.equal(model.get().colors.accent,'#12ab34ff');
  for(const [key,spec] of Object.entries(model.schema))if(!spec.choices){model.set({[key]:spec.min});model.set({[key]:spec.max});}
  model.reset();assert.equal(model.get().focusX,50);assert.deepEqual(model.get().colors,{});
});
