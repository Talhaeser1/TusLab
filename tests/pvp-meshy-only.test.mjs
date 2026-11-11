import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL_VARIANTS, fighterModelVariant, fighterModelUrl, loadFighterModel} from '../pvp/fighters3d.js';

test('all fighters use only Meshy URLs regardless of obsolete flags', () => {
  for (const id of ['vargr', 'sira', 'doran', 'nyx']) {
    assert.equal(fighterModelVariant(id, {location: {search: '?vargr=eski'}, localStorage: {getItem: () => 'eski'}}), 'meshy');
    assert.equal(fighterModelUrl(id), `./assets/models/${id}/${id}.glb`);
    assert.ok(MODEL_VARIANTS[id].meshy.clips.run);
  }
});

test('Meshy load failure and missing clips never request another model', async () => {
  for (const id of ['vargr', 'sira', 'doran', 'nyx']) {
    const calls = [];
    const loader = {loadAsync: async url => { calls.push(url); throw new Error('404'); }};
    await assert.rejects(loadFighterModel({}, id, {loader}), /404/);
    assert.deepEqual(calls, [`./assets/models/${id}/${id}.glb`]);
  }
});
