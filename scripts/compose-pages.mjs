import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const [mainArg, developArg, outputArg] = process.argv.slice(2);
if (!mainArg || !developArg || !outputArg) {
  throw new Error('Использование: node scripts/compose-pages.mjs <main-docs> <develop-docs> <output>');
}

const mainDir = path.resolve(mainArg);
const developDir = path.resolve(developArg);
const outputDir = path.resolve(outputArg);
const devOutputDir = path.join(outputDir, 'dev');

for (const [label, dir] of [['main', mainDir], ['develop', developDir]]) {
  if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error(`${label}: нет index.html в ${dir}`);
}
if (fs.existsSync(path.join(mainDir, 'dev'))) {
  throw new Error('main/docs не должен содержать каталог dev');
}
if ([mainDir, developDir].some((dir) => outputDir === dir || outputDir.startsWith(`${dir}${path.sep}`))) {
  throw new Error('Каталог результата не может находиться внутри исходного дерева');
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.cpSync(mainDir, outputDir, { recursive: true });
fs.mkdirSync(devOutputDir, { recursive: true });
fs.cpSync(developDir, devOutputDir, { recursive: true });

function snapshot(dir, excludedTopLevel = '') {
  const files = new Map();
  function walk(current, relative = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!relative && excludedTopLevel && entry.name === excludedTopLevel) continue;
      const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full, nextRelative);
      else if (entry.isFile()) files.set(nextRelative, crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'));
      else throw new Error(`Неподдерживаемый элемент: ${full}`);
    }
  }
  walk(dir);
  return files;
}

function assertSameTree(label, expected, actual) {
  if (expected.size !== actual.size) throw new Error(`${label}: число файлов отличается (${expected.size} != ${actual.size})`);
  for (const [file, hash] of expected) {
    if (actual.get(file) !== hash) throw new Error(`${label}: отличается ${file}`);
  }
}

function treeDigest(files) {
  const hash = crypto.createHash('sha256');
  for (const [file, digest] of [...files].sort(([a], [b]) => a.localeCompare(b))) hash.update(`${file}\0${digest}\n`);
  return hash.digest('hex');
}

const mainSnapshot = snapshot(mainDir);
const developSnapshot = snapshot(developDir);
assertSameTree('production', mainSnapshot, snapshot(outputDir, 'dev'));
assertSameTree('development', developSnapshot, snapshot(devOutputDir));

const checker = path.join(scriptDir, 'check-site.mjs');
for (const [tree, environment] of [[mainDir, 'production'], [devOutputDir, 'development']]) {
  const result = spawnSync(process.execPath, [checker, tree, environment], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(JSON.stringify({
  production: { source: 'main', files: mainSnapshot.size, sha256: treeDigest(mainSnapshot) },
  development: { source: 'develop', files: developSnapshot.size, sha256: treeDigest(developSnapshot), publicPath: '/dev/' },
  output: outputDir,
}));
