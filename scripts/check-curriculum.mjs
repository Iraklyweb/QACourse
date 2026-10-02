import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(process.argv[2] || 'docs');
const fail = (message) => { throw new Error(message); };
const map = JSON.parse(fs.readFileSync(path.join(outDir, 'assets/route-map.json'), 'utf8'));
const search = JSON.parse(fs.readFileSync(path.join(outDir, 'assets/search-index.json'), 'utf8'));
const qaSearch = search.filter((item) => item.courseSlug !== 'it-start');
const introSearch = search.filter((item) => item.courseSlug === 'it-start');
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
expected.delete('courses/mqa-base/step-042.html');
if (map.length !== expected.size) fail(`Карта: ${map.length} вместо ${expected.size} шагов`);
if (qaSearch.length !== expected.size || new Set(qaSearch.map((item) => item.url)).size !== expected.size) fail('Поиск должен содержать каждый основной урок ровно один раз');
if (introSearch.length !== 8 || new Set(introSearch.map((item) => item.url)).size !== 8) fail('Поиск должен содержать восемь вводных лекций');
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
  if (!qaSearch.some((record) => record.url === item.url)) fail(`Нет в поиске: ${item.url}`);
  const html = fs.readFileSync(path.join(outDir, item.url), 'utf8');
  if (!html.includes(item.route.stageTitle) || !html.includes('Единый маршрут')) fail(`Нет маршрута в уроке: ${item.url}`);
  const previous = map[index - 1];
  const next = map[index + 1];
  if (previous && !html.includes(`href="../../${previous.url}"`)) fail(`Неверный предыдущий шаг: ${item.url}`);
  if (next && !html.includes(`href="../../${next.url}"`)) fail(`Неверный следующий шаг: ${item.url}`);
  if (item.alternativeTo && !html.includes('Основное объяснение')) fail(`Нет основного разбора для ${item.url}`);
}
if (new Set(map.map((item) => item.route.stage)).size !== 9) fail('Ожидалось девять этапов');
const requirementsStage = map.filter((item) => item.route.stage === 'requirements');
if (requirementsStage.length !== 14 || requirementsStage.some((item) => item.taskType !== 'lecture')) fail('Во втором этапе практика опережает теорию документации');
const documentPractice = map.filter((item) => item.route.stage === 'documents' && ['Основная практика документов', 'Дополнительные задания — по желанию'].includes(item.route.topic));
const expectedDocumentPractice = new Set(['Q74', 'Q75', 'Q76', 'Q77', 'Q78', 'Q94', 'Q95', 'Q96', 'Q97', 'M55']);
const documentPracticeKeys = new Set(documentPractice.map((item) => `${item.source.course === 'mqa-base' ? 'Q' : 'M'}${item.source.step}`));
if (documentPracticeKeys.size !== expectedDocumentPractice.size || [...expectedDocumentPractice].some((key) => !documentPracticeKeys.has(key))) fail('Практика документов расположена не после теории');
const firstPracticeIndex = map.findIndex((item) => item.route.topic === 'Основная практика документов');
const lastExampleIndex = map.findLastIndex((item) => item.route.topic === 'Разобранные примеры');
if (firstPracticeIndex <= lastExampleIndex) fail('Практика документов должна идти после разобранных примеров');
if (!home.includes('id="interview"') || !home.includes('Лекции</small>') || !home.includes('Практика</small>')) fail('Нет блока собеседования или новых типов тем');
if (!home.includes('id="end-to-end-topic-2"') || !home.includes('Выбрать и уточнить требование <small class="role-chip mixed">Лекции + практика</small>')) fail('Тема с лекцией и заданием должна быть смешанной');
if (/\b(?:21|54) шагов\b/.test(home) || /<h2>\d+\.\s/.test(home)) fail('Ошибочное склонение или двойная нумерация этапов');
if (!home.includes('Основной курс QA · 282 шага') || !home.includes('<strong>23 шага</strong>') || !home.includes('<strong>61 шаг</strong>') || !home.includes('<strong>21 шаг</strong>')) fail('Неверное склонение количества шагов');
if (!qaSearch.every((record) => record.stageId && record.topicId && record.stageNumber)) fail('Поиску не хватает ссылок на этапы и темы');
for (const [step, minimumBlocks] of [[84, 9], [86, 12], [87, 13]]) {
  const lesson = fs.readFileSync(path.join(outDir, `courses/mqa-base/step-${String(step).padStart(3, '0')}.html`), 'utf8');
  if ((lesson.match(/class="lesson-method"/g) || []).length < minimumBlocks) fail(`Не восстановлены смысловые блоки лекции Q${step}`);
  if ((lesson.match(/<h1>/g) || []).length !== 1) fail(`Повторный заголовок в лекции Q${step}`);
}
const architecture = fs.readFileSync(path.join(outDir, 'courses/manual-testing/step-067.html'), 'utf8');
if ((architecture.match(/<h1>/g) || []).length !== 1 || /<p>\s*&nbsp;\s*<\/p>/.test(architecture)) fail('Повторный заголовок или пустые отступы в лекции M67');
if (!fs.readFileSync(path.join(outDir, 'courses/mqa-base/step-084.html'), 'utf8').includes('numbered-attributes')) fail('Не пронумерованы атрибуты требований');
const requirementsLesson = fs.readFileSync(path.join(outDir, 'courses/manual-testing/step-123.html'), 'utf8');
if (requirementsLesson.includes('выполняя <strong>домашние задания</strong>') || !requirementsLesson.includes('Вы уже познакомились с темой требований')) fail('Не исправлено вступление шага 24');
const expectedResultLesson = fs.readFileSync(path.join(outDir, 'courses/mqa-base/step-036.html'), 'utf8');
if (!expectedResultLesson.includes('Купить один детский билет на текущую дату.') || expectedResultLesson.includes('Купить билет один детский билет')) fail('Не исправлена грамматика исходного шага Q36');
const priorityLesson = fs.readFileSync(path.join(outDir, 'courses/mqa-base/step-041.html'), 'utf8');
if (!priorityLesson.includes('Приоритет в тестовой документации') || !priorityLesson.includes('Приоритет в баг-репортах') || !priorityLesson.includes('после оплаты не приходит подтверждение')) fail('Уроки о приоритете не объединены');
if (map.some((item) => item.url === 'courses/mqa-base/step-042.html') || qaSearch.some((item) => item.url === 'courses/mqa-base/step-042.html')) fail('Дублирующий урок Q42 остался в маршруте или поиске');
if (!fs.existsSync(path.join(outDir, 'courses/mqa-base/step-042.html'))) fail('Исходный урок Q42 должен остаться в архиве');
const about = fs.readFileSync(path.join(outDir, 'about.html'), 'utf8');
if (!about.includes('доступны вводный курс, основной QA-маршрут')) fail('Неверно описан состав dev-курса');
const introIndex = fs.readFileSync(path.join(outDir, 'courses/it-start/index.html'), 'utf8');
if (!home.includes('IT с нуля') || !introIndex.includes('Что делает тестировщик')) fail('Вводный курс не представлен на главной или в содержании');
for (const removedCopy of ['готов первый блок', 'часов готовы', '8 часов', 'без практических заданий', 'Как создаётся программный продукт']) {
  if (home.includes(removedCopy) || introIndex.includes(removedCopy)) fail(`Осталась служебная или удалённая информация: ${removedCopy}`);
}
for (const number of Array.from({ length: 8 }, (_, index) => index + 1)) {
  const introLesson = path.join(outDir, `courses/it-start/lesson-${String(number).padStart(2, '0')}.html`);
  if (!fs.existsSync(introLesson) || !fs.readFileSync(introLesson, 'utf8').includes('Вводная лекция ·')) fail(`Нет вводной лекции ${number}`);
}
if (fs.existsSync(path.join(outDir, 'courses/it-start/lesson-09.html'))) fail('Осталась страница удалённого блока');
const introLessonFour = fs.readFileSync(path.join(outDir, 'courses/it-start/lesson-04.html'), 'utf8');
if (introLessonFour.includes('Кто такие frontend-, backend- и fullstack-разработчики') || introLessonFour.includes('Главная схема блока') || introLessonFour.includes('Что будет дальше')) fail('В четвёртой лекции остались удалённые блоки');
for (const record of introSearch) {
  if (fs.readFileSync(path.join(outDir, record.url), 'utf8').includes('Что будет дальше')) fail(`Остался блок «Что будет дальше»: ${record.url}`);
}
const routeCss = fs.readFileSync(path.join(outDir, 'assets/route.css'), 'utf8');
if (!routeCss.includes('.lesson-content table{font-family:inherit}')) fail('Таблицы используют другой шрифт');
if (home.includes('Восемь последовательных этапов') || home.includes('После основ') || home.includes('Основное</small>')) fail('Остались прежние статусы или вступление');
if (!fs.readFileSync(path.join(outDir, 'courses/mqa-base/step-001.html'), 'utf8').includes('<h2>Зачем тестировать</h2>')) fail('Нет вводного объяснения');
if (seen.size !== expected.size) fail('Не все исходные страницы распределены');
console.log(JSON.stringify({ mapped: seen.size, stages: 9, searchRecords: search.length, archives: 2, navigation: 'ok' }));
