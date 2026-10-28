const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
for (const browser of ['chrome', 'firefox']) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, browser, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  if (browser === 'chrome') {
    assert.equal(manifest.background.service_worker, 'background.js');
    assert.equal(manifest.background.scripts, undefined);
    assert.equal(manifest.browser_specific_settings, undefined);
  } else {
    assert.deepEqual(manifest.background.scripts, ['background.js']);
    assert.equal(manifest.background.service_worker, undefined);
  }
  for (const file of ['background.js', 'options.js']) {
    const content = fs.readFileSync(path.join(root, browser, file), 'utf8');
    assert.ok(content.includes('autoApplyEnabled: false'));
    assert.ok(content.includes('autoSubmitEnabled: false'));
  }
}
console.log('Manifests e padrões seguros: OK');
