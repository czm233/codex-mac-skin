import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAppearance} from '../src/theme.mjs';
import {createSkinLibraryModel} from '../src/library.mjs';
const model = createSkinLibraryModel(createAppearance);
const content = {asset: 'a'.repeat(64), profiles: {dark: {dim: .2}, light: {dim: .1, textMode: 'dark'}}};
const create = (state, id = 'one') => model.edit(state, {type: 'create', id, name: id, content});

test('same media supports independent skins, drafts, and export/import snapshots', () => {
  let state = create(model.empty());
  state = model.edit(state, {type: 'duplicate', sourceId: 'one', id: 'two', name: '第二套'});
  state = model.edit(state, {type: 'draft', id: 'draft', skinId: 'two', baseRevision: 1, content: {...content, profiles: {...content.profiles, dark: {dim: .8}}}});
  state = model.edit(state, {type: 'save', id: 'draft'});
  assert.equal(state.skins[0].profiles.dark.dim, .2);
  assert.equal(state.skins[1].profiles.dark.dim, .8);
  assert.deepEqual(model.validate(JSON.parse(JSON.stringify(state))), state);
  assert.deepEqual(model.references(state), [content.asset]);
});

test('stale draft cannot overwrite updated skin, can be saved as independent copy', () => {
  let state = create(model.empty());
  state = model.edit(state, {type: 'draft', id: 'offline', skinId: 'one', baseRevision: 1, content});
  state = model.edit(state, {type: 'rename', id: 'one', name: '另一端修改'});
  const original = structuredClone(state);
  assert.throws(() => model.edit(state, {type: 'save', id: 'offline'}), /另一处修改/);
  assert.deepEqual(state, original);
  state = model.edit(state, {type: 'save', id: 'offline', copyId: 'conflict', name: '保留副本'});
  assert.equal(state.skins.length, 2);
  assert.equal(state.skins[0].name, '另一端修改');
  assert.equal(state.drafts.length, 0);
});

test('deletion protects active skin and unsaved drafts and retains shared media references', () => {
  let state = create(create(model.empty()), 'two');
  state = model.edit(state, {type: 'activate', id: 'one'});
  assert.throws(() => model.edit(state, {type: 'delete', id: 'one'}), /当前皮肤/);
  state = model.edit(state, {type: 'draft', id: 'draft', skinId: 'two', baseRevision: 1, content: {...content, asset: 'b'.repeat(64)}});
  assert.equal(model.references(state).length, 2);
  assert.throws(() => model.edit(state, {type: 'delete', id: 'two'}), /草稿/);
  state = model.edit(state, {type: 'delete', id: 'two', discardDrafts: true});
  assert.deepEqual(model.references(state), [content.asset]);
});

test('invalid data cannot mutate saved state; no-media skins and legacy configs supported', () => {
  const state = create(model.empty()), original = structuredClone(state);
  for (const bad of [null, {}, {...content, asset: '../secret'}, {...content, profiles: {dark: {dim: 5}, light: {}}}]) {
    assert.throws(() => model.edit(state, {type: 'create', id: 'bad', name: '错误', content: bad}));
    assert.deepEqual(state, original);
  }
  assert.equal(model.edit(state, {type: 'create', id: 'plain', name: '纯色', content: {...content, asset: null}}).skins[1].asset, null);
  const old = model.importLegacy({format: 'codex-video-skin', version: 1, settings: {dim: .4}});
  assert.equal(old.dark.dim, .4); assert.equal(old.light.textMode, 'dark');
  assert.deepEqual(model.importLegacy({format: 'codex-video-skin', version: 2, profiles: old}), old);
  assert.throws(() => model.validate({...state, version: 900}));
});

import {createLibraryRepository} from '../src/library-repository.mjs';
function fixture() {
  let disk = null, fail = false;
  const assets = new Set([content.asset]);
  const adapter = {
    read: async () => structuredClone(disk),
    hasAsset: async id => assets.has(id),
    putAsset: async (id, value) => {if (value !== 'verified') throw new Error('素材完整性校验失败'); assets.add(id);},
    compareAndSwap: async (revision, next) => {
      if ((disk?.revision ?? 0) !== revision) throw new Error('皮肤库已变化');
      if (fail) throw new Error('磁盘写入失败');
      disk = structuredClone(next);
    }
  };
  return {adapter, repository: createLibraryRepository(model, adapter), fail: value => {fail = value;}};
}

test('repository serializes writes and recovers after failed durable save', async () => {
  const f = fixture();
  await Promise.all(['one', 'two'].map(id => f.repository.execute({type: 'create', id, name: id, content})));
  const before = await f.repository.read();
  assert.equal(before.skins.length, 2);
  f.fail(true);
  await assert.rejects(f.repository.execute({type: 'rename', id: 'one', name: '未保存'}), /磁盘/);
  assert.deepEqual(await f.repository.read(), before);
  f.fail(false);
  await f.repository.execute({type: 'rename', id: 'one', name: '已保存'});
  assert.equal((await f.repository.read()).skins[0].name, '已保存');
  const reopened = createLibraryRepository(model, f.adapter);
  assert.deepEqual(await reopened.read(), await f.repository.read());
});

test('import validates media before exposing skin and preserves existing library on failure', async () => {
  const {repository} = fixture();
  await repository.execute({type: 'create', id: 'one', name: '原皮肤', content});
  const before = await repository.read(), imported = {id: 'two', name: '导入', ...content, asset: 'b'.repeat(64)};
  await assert.rejects(repository.importSkin(imported, null), /缺少/);
  await assert.rejects(repository.importSkin(imported, 'corrupt'), /完整性/);
  assert.deepEqual(await repository.read(), before);
  await repository.importSkin(imported, 'verified');
  assert.equal((await repository.read()).skins.length, 2);
});
