import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs');
const failures = [];
const htmlFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}

if (!fs.existsSync(path.join(outDir, 'index.html'))) failures.push('Нет docs/index.html');
else walk(outDir);

const unsafePatterns = [
  [/<script\b[^>]*\bsrc=["']https?:/i, 'внешний скрипт'],
  [/<[a-z][^>]*\bon[a-z]+\s*=/i, 'inline-обработчик события'],
  [/<[a-z][^>]*(?:href|src)=["']\s*javascript\s*:/i, 'javascript URL'],
  [/https?:\/\/(?:platform|admin)\.kata\.academy\/api\//i, 'приватный API Kata Academy'],
  [/\b(?:answerId|answerText|prevResult|accessToken|refreshToken)\b/i, 'закрытое поле выгрузки'],
];

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const [pattern, label] of unsafePatterns) {
    if (pattern.test(html)) failures.push(`${path.relative(root, file)}: ${label}`);
  }
  for (const tag of html.matchAll(/<(?:a|link|script)\b[^>]*>/gi)) {
    const ref = tag[0].match(/\b(?:href|src)=["']([^"']+)["']/i)?.[1];
    if (ref && !/^(?:https?:|data:|#)/i.test(ref)) {
      const clean = ref.split(/[?#]/)[0];
      const target = path.resolve(path.dirname(file), clean);
      if (clean && !fs.existsSync(target)) failures.push(`${path.relative(root, file)}: нет ${ref}`);
    }
  }
  const lesson = html.match(/<div class="lesson-content">([^]*?)<\/div>\s*<nav class="pager"/i)?.[1] || '';
  if (/<(?:iframe|object|embed|input|textarea|select|button)\b/i.test(lesson)) {
    failures.push(`${path.relative(root, file)}: интерактивный/встраиваемый элемент курса`);
  }
}

const lessonFiles = htmlFiles.filter((file) => /step-\d{3}\.html$/.test(file));
const search = JSON.parse(fs.readFileSync(path.join(outDir, 'assets', 'search-index.json'), 'utf8'));
if (lessonFiles.length !== 295) failures.push(`Страниц уроков: ${lessonFiles.length}, ожидалось 295`);
if (search.length !== 295) failures.push(`Записей поиска: ${search.length}, ожидалось 295`);
if (htmlFiles.length !== 301) failures.push(`HTML-файлов: ${htmlFiles.length}, ожидалось 301`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ htmlFiles: htmlFiles.length, lessonPages: lessonFiles.length, searchRecords: search.length, unsafeFindings: 0, brokenLocalReferences: 0 }));
