// adapter.read(): snapshot|null; adapter.compareAndSwap(expectedRevision, next):
// atomically writes or throws. The adapter owns cross-process locking and backups.
// Media bytes must be durably staged before any snapshot can reference them.
export function createLibraryRepository(model, adapter) {
  let queue = Promise.resolve();
  const serial = operation => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  const read = async () => model.validate(await adapter.read() ?? model.empty());
  const commit = async (state, next) => {
    for (const asset of model.references(next)) {
      if (!await adapter.hasAsset(asset)) throw new Error('背景素材缺失，未保存皮肤库');
    }
    await adapter.compareAndSwap(state.revision, next);
    return model.copy(next);
  };
  return {
    read: () => serial(read),
    execute: action => serial(async () => {
      const state = await read();
      return commit(state, model.edit(state, action));
    }),
    // An import never replaces the user's library wholesale. The caller generates
    // a fresh ID and chooses a name; validation precedes all durable changes.
    importSkin: (skin, asset) => serial(async () => {
      const state = await read();
      const next = model.edit(state, {type: 'create', id: skin.id, name: skin.name, content: skin});
      if (skin.asset !== null) {
        if (!asset) throw new Error('皮肤包缺少背景素材');
        await adapter.putAsset(skin.asset, asset);
      }
      return commit(state, next);
    }),
    whenIdle: () => queue
  };
}
