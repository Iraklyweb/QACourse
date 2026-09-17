import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(process.argv[2] || 'docs');
const fail = (message) => { throw new Error(message); };
const map = JSON.parse(fs.readFileSync(path.join(outDir, 'assets/route-map.json'), 'utf8'));
const search = JSON.parse(fs.readFileSync(path.join(outDir, 'assets/search-index.json'), 'utf8'));
const home = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
const roles = new Set(['core', 'practice', 'advanced', 'reference', 'alternative']);
const expected = new Set([
  ...Array.from({ length: 168 }, (_, i) => `courses/manual-testing/step-${String(i + 1).padStart(3, '0')}.html`),
  ...Array.from({ length: 127 }, (_, i) => `courses/mqa-base/step-${String(i + 1).padStart(3, '0')}.html`),
]);
for (const [course, steps] of [
  ['manual-testing', [57, 58, 120, 121, 131, 167, 168]],
  ['mqa-base', [79, 99, 100, 126, 127]],
]) for (const step of steps) expected.delete(`courses/${course}/step-${String(step).padStart(3, '0')}.html`);
if (map.length !== expected.size) fail(`Карта: ${map.length} вместо ${expected.size} шагов`);
if (search.length !== expected.size || new Set(search.map((item) => item.url)).size !== expected.size) fail('Поиск должен содержать каждый урок ровно один раз');
if (!home.includes('Архив исходных курсов')) fail('Нет раздела архивов');
for (const archive of ['manual-testing', 'mqa-base']) {
  if (!fs.existsSync(path.join(outDir, 'courses', archive, 'index.html'))) fail(`Нет архива ${archive}`);
}
const seen = new Set();
for (const [index, item] of map.entries()) {
  if (!expected.has(item.url) || seen.has(item.url)) fail(`Неверный или повторённый источник: ${item.url}`);
  seen.add(item.url);
  if (!roles.has(item.route.role)) fail(`Нет роли у ${item.url}`);
  if (!item.route.stage || !item.route.topic || item.route.lessonOrder !== index + 1) fail(`Некорректное место ${item.url}`);
  if (!home.includes(`href="${item.url}"`)) fail(`Главная не ведёт на ${item.url}`);
  if (!search.some((record) => record.url === item.url)) fail(`Нет в поиске: ${item.url}`);
  const html = fs.readFileSync(path.join(outDir, item.url), 'utf8');
  if (!html.includes(item.route.stageTitle) || !html.includes('Единый маршрут')) fail(`Нет маршрута в уроке: ${item.url}`);
  const previous = map[index - 1];
  const next = map[index + 1];
  if (previous && !html.includes(`href="../../${previous.url}"`)) fail(`Неверный предыдущий шаг: ${item.url}`);
  if (next && !html.includes(`href="../../${next.url}"`)) fail(`Неверный следующий шаг: ${item.url}`);
  if (item.alternativeTo && !html.includes('Основное объяснение')) fail(`Нет основного разбора для ${item.url}`);
}
if (new Set(map.map((item) => item.route.stage)).size !== 9) fail('Ожидалось девять этапов');
if (!home.includes('id="interview"') || !home.includes('Лекции</small>') || !home.includes('Практика</small>')) fail('Нет блока собеседования или новых типов тем');
if (home.includes('Восемь последовательных этапов') || home.includes('После основ') || home.includes('Основное</small>')) fail('Остались прежние статусы или вступление');
if (!fs.readFileSync(path.join(outDir, 'courses/mqa-base/step-001.html'), 'utf8').includes('<h2>Зачем тестировать</h2>')) fail('Нет вводного объяснения');
if (seen.size !== expected.size) fail('Не все исходные страницы распределены');
console.log(JSON.stringify({ mapped: seen.size, stages: 9, searchRecords: search.length, archives: 2, navigation: 'ok' }));
