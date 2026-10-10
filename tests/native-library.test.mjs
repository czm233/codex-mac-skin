import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createSkinLibraryModel} from '../src/library.mjs';
import {createAppearance} from '../src/theme.mjs';

test('automatic library receiver retries and excludes concurrent foreground writes', {skip:process.platform !== 'darwin',timeout:60000}, async()=>{
  const temporary=await fs.mkdtemp(path.resolve('work/autosync-native-'));
  try {
    const binary=path.join(temporary,'checks');
    execFileSync('/usr/bin/xcrun',['swiftc','-parse-as-library','-swift-version','5','app/LibraryAutoSync.swift','tests/native/AutoSyncChecks.swift','-o',binary],{timeout:50000,stdio:'pipe'});
    assert.match(execFileSync(binary,[],{timeout:10000,encoding:'utf8'}),/foreground exclusion passed/);
  } finally {await fs.rm(temporary,{recursive:true,force:true});}
});

test('native library preserves on-disk data across reopen, import, conflicts and failures', {skip: process.platform !== 'darwin', timeout: 60000}, async () => {
  const root = path.resolve('work');
  await fs.mkdir(root, {recursive: true});
  const temporary = await fs.mkdtemp(path.join(root, 'library-native-'));
  try {
    const model = path.join(temporary, 'library.js'), binary = path.join(temporary, 'checks');
    await fs.writeFile(model, `var skinLibraryModel=(${createSkinLibraryModel})(${createAppearance});`);
    execFileSync('/usr/bin/xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', 'app/Bridge.swift', 'app/Library.swift', 'tests/native/LibraryChecks.swift', '-o', binary], {timeout: 50000, stdio: 'pipe'});
    const output = execFileSync(binary, [path.join(temporary, 'data'), model], {timeout: 10000, encoding: 'utf8'});
    assert.match(output, /failure recovery passed/);
  } finally { await fs.rm(temporary, {recursive: true, force: true}); }
});
