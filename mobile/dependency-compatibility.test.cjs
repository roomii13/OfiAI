/** @archivo dependency-compatibility.test.cjs @descripcion Contratos de los parches de seguridad compatibles con Expo 54. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

const expoRequire = createRequire(require.resolve('expo/package.json'));
const metroRequire = createRequire(expoRequire.resolve('@expo/metro/package.json'));
const assets = metroRequire('metro/private/Assets');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7ioAAAAASUVORK5CYII=', 'base64');

test('mantiene Expo 54, React Native 0.81 y el Metro esperado por Expo', () => {
  assert.match(require('expo/package.json').version, /^54\./);
  assert.equal(require('react-native/package.json').version, '0.81.5');
  assert.equal(metroRequire('metro/package.json').version, '0.83.3');
});

test('Metro calcula dimensiones de buffers con image-size 2', () => {
  assert.deepEqual(assets.getAssetSize('png', png, 'fixture.png'), { width: 1, height: 1 });
});

test('Metro transforma assets desde archivos, no solo desde buffers', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ofiai-asset-test-'));
  try {
    const file = path.join(directory, 'fixture.png');
    fs.writeFileSync(file, png);
    const data = await assets.getAssetData(file, 'fixture.png', [], 'android', '/assets');
    assert.equal(data.width, 1);
    assert.equal(data.height, 1);
    assert.equal(data.type, 'png');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('query-string mantiene su API CommonJS con el decodificador corregido', () => {
  const query = require('query-string');
  assert.deepEqual({ ...query.parse('city=Santa%20Rosa&value=1&value=2') }, { city: 'Santa Rosa', value: ['1', '2'] });
  assert.equal(query.stringify({ city: 'Santa Rosa' }), 'city=Santa%20Rosa');
  assert.equal(typeof query.parse('value=%E0%A4%A').value, 'string');
});
