import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCurriculum } from './curriculum.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirName = process.env.COURSE_EXPORT_DIR || fs.readdirSync(root, { withFileTypes: true })
  .find((entry) => entry.isDirectory() && entry.name.endsWith('-academy-export'))?.name;
if (!sourceDirName) throw new Error('Не найден локальный каталог выгрузки курса');
const sourceDir = path.join(root, sourceDirName);
const outDir = path.join(root, 'docs');
const siteEnvironment = process.env.SITE_ENV || 'production';
if (!['production', 'development'].includes(siteEnvironment)) {
  throw new Error(`Неизвестное окружение: ${siteEnvironment}`);
}
const isDevelopment = siteEnvironment === 'development';

const retiredHost = ['ka', 'ta', '.academy'].join('');
const retiredHostPattern = ['ka', 'ta', '\\.academy'].join('');
const retiredUrlPattern = new RegExp(`(?:https?://)?(?:[\\w-]+\\.)*${retiredHostPattern}(?:[/][^\\s"'<>]*)?`, 'gi');
const retiredLatinBrandPattern = new RegExp(['Ka', 'ta', '\\s+Academy'].join(''), 'gi');
const retiredCyrillicBrandPattern = new RegExp(['Ка', 'та', '\\s+Академ(?:ия|ии|ию|ией|ие)'].join(''), 'giu');
const retiredSupportHandlePattern = new RegExp(['@ka', 'ta_help_bot'].join(''), 'gi');
const retiredLatinNamePattern = new RegExp(['(?<![\\p{L}\\p{N}])Ka', 'ta(?![\\p{L}\\p{N}])'].join(''), 'giu');
const retiredCyrillicNamePattern = new RegExp(['(?<![\\p{L}\\p{N}])Ка', 'та(?![\\p{L}\\p{N}])'].join(''), 'giu');

function neutralizeBrand(value = '') {
  return String(value)
    .replace(retiredUrlPattern, '')
    .replace(retiredLatinBrandPattern, 'Персональный курс QA')
    .replace(retiredCyrillicBrandPattern, 'Персональный курс QA')
    .replace(retiredSupportHandlePattern, 'службу поддержки курса')
    .replace(retiredLatinNamePattern, 'курс QA')
    .replace(retiredCyrillicNamePattern, 'курс QA');
}

const courseDefs = [
  {
    slug: 'manual-testing',
    title: 'Ручное тестирование',
    course: 'manual-testing-course.json',
    content: 'manual-testing-content.json',
    summary: 'manual-testing-export-summary.json',
    accent: 'blue',
  },
  {
    slug: 'mqa-base',
    title: 'MQA Base',
    course: 'mqa-base-course.json',
    content: 'mqa-base-content.json',
    summary: 'mqa-base-export-summary.json',
    accent: 'amber',
  },
];

function readJson(file) {
  const value = JSON.parse(fs.readFileSync(path.join(sourceDir, file), 'utf8'));
  return value;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function attrValue(source, name) {
  const match = source.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
}

function safeHref(value) {
  const href = String(value || '').trim();
  if (href.startsWith('#')) return href;
  try {
    const parsed = new URL(href);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === retiredHost || hostname.endsWith(`.${retiredHost}`)) return '';
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
  } catch {}
  return '';
}

function mediaLabel(rawTag) {
  const alt = neutralizeBrand(attrValue(rawTag, 'alt')).trim();
  const src = safeHref(attrValue(rawTag, 'src'));
  let origin = '';
  if (src) {
    try { origin = new URL(src).hostname; } catch {}
  }
  const parts = [alt || 'иллюстрация', origin].filter(Boolean);
  return `<span class="media-note" role="note"><span aria-hidden="true">▧</span> Изображение: ${parts.map(escapeHtml).join(' · ')}</span>`;
}

function sanitizeHtml(input = '') {
  let html = neutralizeBrand(input)
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|button|input|textarea|select|option|meta|title|link)\b[^>]*>[^]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|button|input|textarea|select|option|meta|title|link)\b[^>]*\/?>/gi, '');

  const allowed = new Set([
    'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre', 'br', 'hr', 'blockquote', 'a',
  ]);

  html = html.replace(/<\/?\s*([a-zA-Z0-9:-]+)\b[^>]*>/g, (tag, rawName) => {
    const name = rawName.toLowerCase();
    if (name === 'img' && !tag.startsWith('</')) return mediaLabel(tag);
    if (!allowed.has(name)) return '';
    if (tag.startsWith('</')) return `</${name}>`;
    if (name === 'br' || name === 'hr') return `<${name}>`;
    if (name === 'a') {
      const href = safeHref(attrValue(tag, 'href'));
      return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">` : '<a>';
    }
    if (name === 'td' || name === 'th') {
      const colspan = Number.parseInt(attrValue(tag, 'colspan'), 10);
      const rowspan = Number.parseInt(attrValue(tag, 'rowspan'), 10);
      const attrs = [
        Number.isInteger(colspan) && colspan > 1 && colspan < 25 ? ` colspan="${colspan}"` : '',
        Number.isInteger(rowspan) && rowspan > 1 && rowspan < 100 ? ` rowspan="${rowspan}"` : '',
      ].join('');
      return `<${name}${attrs}>`;
    }
    return `<${name}>`;
  });

  return html
    .replace(/<(p|div|span)>\s*<\/\1>/gi, '')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function plainText(html = '') {
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&laquo;|&raquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function write(relative, content) {
  const target = path.join(outDir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function faviconData() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#101827"/><path d="M8 8h14a3 3 0 0 1 3 3v13H11a3 3 0 0 1-3-3V8Z" fill="#4fd1c5"/><path d="M12 12h9M12 16h9M12 20h6" stroke="#101827" stroke-width="2" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function shell({ title, description, depth = 0, body, current = '' }) {
  const base = '../'.repeat(depth);
  const navCourse = !isDevelopment && current ? `<a href="${base}courses/${current}/">Курс</a>` : '';
  const environmentNav = isDevelopment
    ? `\n    <span class="env-badge" aria-label="Среда разработки">DEV</span><a class="production-link" data-production-link href="${base}../">Продакшен</a>`
    : '';
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="color-scheme" content="dark light">
  <title>${escapeHtml(title)} · Персональный курс QA</title>
  <link rel="icon" type="image/svg+xml" href="${faviconData()}">
  <link rel="stylesheet" href="${base}assets/site.css">
  ${isDevelopment ? `<link rel="stylesheet" href="${base}assets/route.css">` : ''}
  <script src="${base}assets/site.js" defer></script>
</head>
<body data-base="${base}" data-environment="${siteEnvironment}">
  <a class="skip-link" href="#main">К содержанию</a>
  <header class="topbar">
    <a class="brand" href="${base}index.html" aria-label="Персональный курс QA, главная"><span class="brand-mark">QA</span><span>Персональный курс QA</span></a>${environmentNav}
    <nav aria-label="Основная навигация">
      ${isDevelopment ? `<a href="${base}index.html">Единый маршрут</a><a href="${base}index.html#archive">Архив курсов</a>` : `<a href="${base}courses/manual-testing/">Ручное тестирование</a><a href="${base}courses/mqa-base/">MQA Base</a>`}${navCourse ? `\n      ${navCourse}` : ''}
    </nav>
    <form class="search-mini" action="${base}search.html" role="search">
      <label class="sr-only" for="site-search-${depth}">Поиск по курсам</label>
      <input id="site-search-${depth}" name="q" type="search" placeholder="Найти тему…" autocomplete="off">
      <button type="submit" aria-label="Искать">⌕</button>
    </form>
  </header>
  <main id="main">${body}</main>
  <footer><span>Персональный курс QA · без отслеживания и отправки ответов</span><a href="${base}about.html">О сайте</a></footer>
</body>
</html>`;
}

function courseCard(course, depth = 0) {
  const base = '../'.repeat(depth);
  return `<a class="course-card ${course.accent}" href="${base}courses/${course.slug}/">
    <span class="eyebrow">${isDevelopment ? 'Архив' : 'Курс'}</span>
    <h2>${escapeHtml(course.title)}</h2>
    <p>${escapeHtml(course.description)}</p>
    <dl><div><dt>Модули</dt><dd>${course.modules.length}</dd></div><div><dt>Темы</dt><dd>${course.chapterCount}</dd></div><div><dt>Страницы</dt><dd>${course.pages.length}</dd></div></dl>
    <span class="card-link">Открыть структуру <span aria-hidden="true">→</span></span>
  </a>`;
}

function pageKind(type) {
  return ({ lecture: 'Лекция', mentorCheckTask: 'Практическое задание' })[type] || 'Материал';
}

const whyTestIntro = '<section class="editorial-intro"><h2>Зачем тестировать</h2><p>Тестирование помогает обнаружить расхождение между тем, как продукт должен работать, и тем, что получает пользователь. Оно не доказывает отсутствие ошибок, но снижает риск неприятных сюрпризов до выпуска.</p><p>Тестировщик проверяет требования, исследует поведение продукта, сообщает о проблемах понятным команде способом и помогает принять обоснованное решение о выпуске. В следующих этапах вы научитесь делать это на конкретных примерах.</p></section>';

const courses = courseDefs.map((def) => {
  const structure = readJson(def.course);
  const pages = readJson(def.content);
  const summary = readJson(def.summary);
  if (!Array.isArray(pages)) throw new Error(`${def.content}: ожидался массив`);
  if (summary.pagesExported !== pages.length || summary.errors !== 0) {
    throw new Error(`${def.slug}: контрольные количества выгрузки не совпадают`);
  }

  const ordered = pages.map((page, index) => ({
    ...page,
    moduleName: neutralizeBrand(page.moduleName),
    chapterName: neutralizeBrand(page.chapterName),
    index,
    number: index + 1,
    file: `step-${String(index + 1).padStart(3, '0')}.html`,
    safeTitle: neutralizeBrand(page.content?.title || page.heading?.taskTitle || `Шаг ${index + 1}`),
    safeHtml: (def.slug === 'mqa-base' && index === 0 ? whyTestIntro : '') + sanitizeHtml(page.content?.description || ''),
  })).filter((page) => page.taskType !== 'multi_input' && page.taskType !== 'review_step');

  const modules = [];
  for (const page of ordered) {
    let module = modules.find((item) => item.position === page.modulePosition);
    if (!module) {
      module = { position: page.modulePosition, name: page.moduleName, chapters: [] };
      modules.push(module);
    }
    let chapter = module.chapters.find((item) => item.id === page.chapterId);
    if (!chapter) {
      chapter = { id: page.chapterId, position: page.chapterPosition, name: page.chapterName, pages: [] };
      module.chapters.push(chapter);
    }
    chapter.pages.push(page);
  }
  modules.sort((a, b) => a.position - b.position);
  for (const module of modules) module.chapters.sort((a, b) => a.position - b.position);

  return {
    ...def,
    description: neutralizeBrand(structure.courseInfo?.description?.split(/\n\s*\n/)[0]?.trim() || 'Учебные материалы курса.'),
    duration: neutralizeBrand(structure.courseInfo?.transitTime || ''),
    workload: neutralizeBrand(structure.courseInfo?.filling || ''),
    modules,
    pages: ordered,
    chapterCount: modules.reduce((sum, module) => sum + module.chapters.length, 0),
    summary,
  };
});

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const totalPages = courses.reduce((sum, course) => sum + course.pages.length, 0);
const totalChapters = courses.reduce((sum, course) => sum + course.chapterCount, 0);
const curriculum = isDevelopment ? buildCurriculum(courses) : null;
const routeByUrl = new Map(curriculum?.records.map((record, index) => [record.url, { record, index }]) || []);
const routeBySourceKey = new Map(curriculum?.records.map((record) => [`${record.source.course === 'mqa-base' ? 'Q' : 'M'}${record.source.step}`, record]) || []);

function routeHome() {
  const kindLabel = { lecture: 'Лекции', mixed: 'Лекции + практика', practice: 'Практика' };
  const outline = curriculum.stages.map((stage) => `<section class="module-block route-stage" id="${stage.id}">
    <header><span>${String(stage.number).padStart(2, '0')}</span><div><p>Этап ${stage.number}</p><h2>${escapeHtml(stage.title)}</h2></div><strong>${stage.topics.reduce((sum, topic) => sum + topic.items.length, 0)} шагов</strong></header>
    <p class="stage-goal">${escapeHtml(stage.goal)} <strong>Результат:</strong> ${escapeHtml(stage.outcome)}</p>${stage.id === 'end-to-end' ? '<aside class="capstone"><h3>Итоговая работа</h3><p>Возьмите один знакомый веб-сценарий. Зафиксируйте требование и вопросы к нему, составьте проверки, выполните их в интерфейсе и при необходимости через API/БД, затем опишите один воспроизводимый дефект. Упражнения ниже взяты из разных исходных контекстов: используйте их как образцы отдельных действий, а итоговую цепочку соберите на одном выбранном сценарии.</p></aside>' : ''}
    <div class="chapter-list">${stage.topics.map((topic) => `<details><summary><span>${escapeHtml(topic.title)} <small class="role-chip ${topic.kind}">${kindLabel[topic.kind]}</small></span><span class="chapter-toggle"><small>${topic.items.length}</small><span class="chapter-chevron" aria-hidden="true">▸</span></span></summary><ol>${topic.items.map((item) => `<li><a href="${item.url}"><span>${String(item.route.lessonOrder).padStart(3, '0')}</span><strong>${escapeHtml(item.title)}</strong><em>${item.alternativeTo ? 'Другой разбор' : escapeHtml(item.source.course === 'mqa-base' ? 'MQA Base' : 'Ручное тестирование')}</em></a></li>`).join('')}</ol></details>`).join('')}</div>
  </section>`).join('');
  return `<section class="home-intro route-intro"><div><span class="eyebrow">Единый маршрут · ${totalPages} шагов</span><h1>От знакомства с QA<br><span>до найденного дефекта</span></h1></div><div class="home-copy"><a class="route-start" href="${curriculum.records[0].url}">Начать обучение →</a><form class="search-hero" action="search.html" role="search"><label class="sr-only" for="home-search">Поиск по маршруту</label><input id="home-search" name="q" type="search" placeholder="Например, граничные значения" required><button>Найти</button></form></div></section>
  <nav class="route-jump" aria-label="Этапы маршрута">${curriculum.stages.map((stage) => `<a href="#${stage.id}">${escapeHtml(stage.title)}</a>`).join('')}</nav>
  <div class="outline route-outline">${outline}</div>
  <section id="archive" class="archive-section"><span class="eyebrow">Исходные материалы</span><h2>Архив исходных курсов</h2><p>Прежние структуры учебных материалов сохранены для ссылок и сверки; формы обратной связи и ревью исключены. Для обучения используйте единый маршрут выше.</p><div class="course-grid">${courses.map((course) => courseCard(course)).join('')}</div></section>`;
}

write('index.html', shell({
  title: 'Персональный курс QA',
  description: `${totalPages} страниц учебных материалов по ручному тестированию и MQA Base.`,
  body: isDevelopment ? routeHome() : `<section class="home-intro">
    <div><span class="eyebrow">Персональный курс QA</span><h1>Учебные материалы<br><span>без лишнего шума</span></h1></div>
    <div class="home-copy"><p>Два курса собраны в читаемый статический справочник. Выберите курс или найдите понятие сразу во всех ${totalPages} страницах.</p>
      <form class="search-hero" action="search.html" role="search"><label class="sr-only" for="home-search">Поиск по материалам</label><input id="home-search" name="q" type="search" placeholder="Например, граничные значения" required><button>Найти</button></form>
    </div>
  </section>
  <section class="course-grid" aria-label="Курсы">${courses.map((course) => courseCard(course)).join('')}</section>
  <section class="library-stats"><div><strong>${courses.length}</strong><span>курса</span></div><div><strong>${totalChapters}</strong><span>тема</span></div><div><strong>${totalPages}</strong><span>страниц</span></div></section>`,
}));

for (const course of courses) {
  const outline = course.modules.map((module) => `<section class="module-block">
    <header><span>${String(module.position).padStart(2, '0')}</span><div><p>Модуль</p><h2>${escapeHtml(module.name)}</h2></div><strong>${module.chapters.reduce((sum, chapter) => sum + chapter.pages.length, 0)} шагов</strong></header>
    <div class="chapter-list">${module.chapters.map((chapter) => `<details><summary><span>${escapeHtml(chapter.name)}</span><span class="chapter-toggle"><small>${chapter.pages.length}</small><span class="chapter-chevron" aria-hidden="true">▸</span></span></summary><ol>${chapter.pages.map((page) => `<li><a href="${page.file}"><span>${String(page.number).padStart(3, '0')}</span><strong>${escapeHtml(page.safeTitle)}</strong><em>${pageKind(page.taskType)}</em></a></li>`).join('')}</ol></details>`).join('')}</div>
  </section>`).join('');

  write(`courses/${course.slug}/index.html`, shell({
    title: course.title,
    description: course.description,
    depth: 2,
    current: course.slug,
    body: `<div class="course-head ${course.accent}"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="../../index.html">Главная</a><span>/</span><span>${escapeHtml(course.title)}</span></nav>
      <span class="eyebrow">${isDevelopment ? 'Архив исходного курса' : 'Курс'} · ${course.modules.length} модуля · ${course.pages.length} страниц</span><h1>${escapeHtml(course.title)}</h1><p>${escapeHtml(course.description)}</p>${isDevelopment ? '<p><a href="../../index.html">Перейти к единому учебному маршруту →</a></p>' : ''}
      <div class="course-meta">${course.duration ? `<span>Срок: ${escapeHtml(course.duration)}</span>` : ''}${course.workload ? `<span>Нагрузка: ${escapeHtml(course.workload)}</span>` : ''}</div>
    </div><div class="outline">${outline}</div>`,
  }));

  course.pages.forEach((page, index) => {
    const previous = course.pages[index - 1];
    const next = course.pages[index + 1];
    const chapterPages = course.modules.flatMap((module) => module.chapters).find((chapter) => chapter.id === page.chapterId)?.pages || [];
    const chapterPos = chapterPages.findIndex((item) => item.number === page.number) + 1;
    const currentUrl = `courses/${course.slug}/${page.file}`;
    const routePosition = routeByUrl.get(currentUrl);
    const routeRecord = routePosition?.record;
    const routePrevious = routePosition ? curriculum.records[routePosition.index - 1] : null;
    const routeNext = routePosition ? curriculum.records[routePosition.index + 1] : null;
    const alternativeBase = routeRecord?.alternativeTo ? routeBySourceKey.get(routeRecord.alternativeTo) : null;
    const routePager = `<nav class="pager" aria-label="Навигация между шагами">${routePrevious ? `<a class="prev" href="../../${routePrevious.url}"><small>Назад · единый маршрут</small><span>← ${escapeHtml(routePrevious.title)}</span></a>` : '<span></span>'}${routeNext ? `<a class="next" href="../../${routeNext.url}"><small>Дальше · единый маршрут</small><span>${escapeHtml(routeNext.title)} →</span></a>` : '<a class="next" href="../../index.html"><small>Маршрут пройден</small><span>К этапам →</span></a>'}</nav>`;
    write(`courses/${course.slug}/${page.file}`, shell({
      title: page.safeTitle,
      description: plainText(page.safeHtml).slice(0, 155),
      depth: 2,
      current: course.slug,
      body: `<div class="reader-layout"><aside class="reader-rail"><a href="${isDevelopment ? '../../index.html' : 'index.html'}">← ${isDevelopment ? 'Единый маршрут' : 'Структура курса'}</a><div class="rail-index"><span>${String(isDevelopment ? routePosition.index + 1 : page.number).padStart(3, '0')}</span><small>из ${isDevelopment ? totalPages : course.pages.length}</small></div><p>${escapeHtml(isDevelopment ? routeRecord.route.stageTitle : page.chapterName)}</p><div class="rail-progress" aria-label="Шаг ${isDevelopment ? routePosition.index + 1 : chapterPos} из ${isDevelopment ? totalPages : chapterPages.length}"><i style="width:${Math.round((isDevelopment ? routePosition.index + 1 : chapterPos) / (isDevelopment ? totalPages : chapterPages.length) * 100)}%"></i></div><small>${isDevelopment ? `${routeRecord.route.topic} · ${pageKind(page.taskType)}` : `${chapterPos} / ${chapterPages.length} в теме`}</small></aside>
        <article class="lesson"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="../../index.html">${isDevelopment ? 'Единый маршрут' : 'Главная'}</a><span>/</span>${isDevelopment ? `<a href="../../index.html#${routeRecord.route.stage}">${escapeHtml(routeRecord.route.stageTitle)}</a><span>/</span><span>${escapeHtml(routeRecord.route.topic)}</span>` : `<a href="index.html">${escapeHtml(course.title)}</a><span>/</span><span>${escapeHtml(page.moduleName)}</span><span>/</span><span>${escapeHtml(page.chapterName)}</span>`}</nav>
          <header class="lesson-head"><span class="type-chip">${pageKind(page.taskType)}</span><h1>${escapeHtml(page.safeTitle)}</h1><p>${escapeHtml(page.moduleName)} · ${escapeHtml(page.chapterName)}</p>${alternativeBase ? `<p class="alternative-note">Другой разбор темы. <a href="../../${alternativeBase.url}">Основное объяснение: ${escapeHtml(alternativeBase.title)} →</a></p>` : ''}</header>
          <div class="lesson-content">${page.safeHtml || '<p>Текст для этого шага отсутствует в выгрузке.</p>'}</div>
          ${isDevelopment ? routePager : `<nav class="pager" aria-label="Навигация между шагами">${previous ? `<a class="prev" href="${previous.file}"><small>Назад</small><span>← ${escapeHtml(previous.safeTitle)}</span></a>` : '<span></span>'}${next ? `<a class="next" href="${next.file}"><small>Дальше</small><span>${escapeHtml(next.safeTitle)} →</span></a>` : `<a class="next" href="index.html"><small>Готово</small><span>К структуре курса →</span></a>`}</nav>`}
          ${isDevelopment ? `<p class="source-note">Источник: <a href="index.html">${escapeHtml(course.title)}</a> · ${escapeHtml(page.moduleName)} / ${escapeHtml(page.chapterName)} · исходный шаг ${page.number}.</p>` : ''}
        </article></div>`,
    }));
  });
}

const searchIndex = courses.flatMap((course) => course.pages.map((page) => {
  const url = `courses/${course.slug}/${page.file}`;
  const place = routeByUrl.get(url)?.record;
  return {
    course: isDevelopment ? 'Единый маршрут' : course.title,
    courseSlug: course.slug,
    module: isDevelopment ? place.route.stageTitle : page.moduleName,
    chapter: isDevelopment ? place.route.topic : page.chapterName,
    title: page.safeTitle,
    type: pageKind(page.taskType),
    url,
    text: plainText(page.safeHtml).slice(0, 12000),
  };
}));
if (isDevelopment) searchIndex.sort((a, b) => routeByUrl.get(a.url).index - routeByUrl.get(b.url).index);
write('assets/search-index.json', JSON.stringify(searchIndex));
if (isDevelopment) write('assets/route-map.json', JSON.stringify(curriculum.records, null, 2) + '\n');

write('search.html', shell({
  title: 'Поиск',
  description: isDevelopment ? 'Полнотекстовый поиск по единому маршруту тестирования.' : 'Полнотекстовый поиск по двум курсам тестирования.',
  body: `<section class="search-page"><span class="eyebrow">Поиск по ${totalPages} страницам</span><h1>Что вы хотите найти?</h1><form id="search-form" class="search-large" role="search"><label class="sr-only" for="search-input">Поиск</label><input id="search-input" name="q" type="search" placeholder="Введите термин или фразу" autofocus><button>Найти</button></form><p id="search-status" class="search-status" aria-live="polite">Введите не меньше двух символов.</p><div id="search-results" class="search-results"></div></section>`,
}));

write('about.html', shell({
  title: 'О курсе',
  description: 'Как устроен персональный курс QA.',
  body: `<article class="about"><span class="eyebrow">Персональный курс QA</span><h1>Спокойное чтение,<br>без действий на платформе</h1><p>Сайт собран из локальных учебных материалов. В нём ${totalPages} страниц: лекции и практические задания.${isDevelopment ? ' Девять этапов образуют единый маршрут; прежняя структура учебных материалов доступна в архиве.' : ''}</p><h2>Что сохранено</h2><ul><li>заголовки, текст, списки, таблицы и безопасные внешние ссылки;</li><li>${isDevelopment ? 'маршрут «этап → тема → шаг» и архивная структура учебных материалов' : 'структура «модуль → тема → шаг»'};</li><li>текстовые описания изображений без загрузки самих файлов.</li></ul><h2>Чего здесь нет</h2><p>Логинов, паролей, cookies, токенов, профилей учеников, комментариев, прогресса, ответов и решений. Формы обратной связи и шаги ревью исключены; ответы не отправляются.</p></article>`,
}));

write('404.html', fs.readFileSync(path.join(outDir, 'index.html'), 'utf8'));
write('.nojekyll', '');
write('assets/site.css', fs.readFileSync(path.join(root, 'site-src', 'site.css'), 'utf8'));
if (isDevelopment) write('assets/route.css', fs.readFileSync(path.join(root, 'site-src', 'route.css'), 'utf8'));
write('assets/site.js', fs.readFileSync(path.join(root, 'site-src', 'site.js'), 'utf8'));

console.log(JSON.stringify({ environment: siteEnvironment, courses: courses.length, chapters: totalChapters, pages: totalPages, searchRecords: searchIndex.length, output: outDir }));
