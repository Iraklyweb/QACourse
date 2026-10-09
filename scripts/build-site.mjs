import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCurriculum } from './curriculum.mjs';
import { introCourse } from './intro-course.mjs';

const activeIntroBlocks = introCourse.blocks.filter((block) => block.status !== 'removed');

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
// The unified curriculum is the default in both published environments.
const isUnified = true;

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
  const sourceClasses = { 'lecture-container': 'lesson-source', section: 'lesson-section', 'content-block': 'lesson-block', 'method-block': 'lesson-method', 'info-box': 'lesson-info', 'definition-box': 'lesson-info', highlight: 'lesson-emphasis' };

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
    if (name === 'div' || name === 'span') {
      const classes = attrValue(tag, 'class').split(/\s+/).map((item) => sourceClasses[item]).filter(Boolean);
      return `<${name}${classes.length ? ` class="${[...new Set(classes)].join(' ')}"` : ''}>`;
    }
    return `<${name}>`;
  });

  return html
    .replace(/<p>\s*(?:&nbsp;|&#160;|<br>)?\s*<\/p>/gi, '')
    .replace(/<h[1-6]>\s*(?:&nbsp;|&#160;|<br>)?\s*<\/h[1-6]>/gi, '')
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
  const navCourse = !isUnified && current ? `<a href="${base}courses/${current}/">Курс</a>` : '';
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
  ${isUnified ? `<link rel="stylesheet" href="${base}assets/route.css">` : ''}
  <script src="${base}assets/site.js" defer></script>
</head>
<body data-base="${base}" data-environment="${siteEnvironment}">
  <a class="skip-link" href="#main">К содержанию</a>
  <header class="topbar">
    <a class="brand" href="${base}index.html" aria-label="Персональный курс QA, главная"><span class="brand-mark">QA</span><span>Персональный курс QA</span></a>${environmentNav}
    <nav aria-label="Основная навигация">
      <a href="${base}courses/${introCourse.slug}/">IT с нуля</a><a href="${base}index.html#main-route">Основной курс</a><a href="${base}index.html#archive">Архив курсов</a>${navCourse ? `\n      ${navCourse}` : ''}
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

function landingShell({ body }) {
  const environmentNav = isDevelopment
    ? `<span class="env-badge landing-env" aria-label="Среда разработки">DEV</span><a class="landing-production" data-production-link href="../../qa-course/">Продакшен</a>`
    : '';
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Персональный курс ручного тестирования: последовательный путь от устройства IT-продукта до самостоятельной проверки веб-приложений, API и данных.">
  <meta name="color-scheme" content="dark">
  <title>Курс ручного тестирования · Персональный курс QA</title>
  <link rel="icon" type="image/svg+xml" href="${faviconData()}">
  <link rel="stylesheet" href="../assets/landing.css?v=3">
  <script src="../assets/landing.js?v=3" defer></script>
</head>
<body data-environment="${siteEnvironment}">
  <a class="landing-skip" href="#content">К содержанию</a>
  <header class="landing-header">
    <span class="landing-brand" aria-label="Персональный курс QA"><span>QA</span><strong>Персональный курс</strong></span>
    <nav aria-label="Навигация по странице"><a href="#results">Результат</a><a href="#program">Программа</a><a href="#format">Формат</a><a href="#faq">Вопросы</a></nav>
    <div class="landing-header-actions">${environmentNav}<button type="button" class="button button-small" data-interest>Узнать о старте</button></div>
  </header>
  <main id="content">${body}</main>
  <footer class="landing-footer"><span class="landing-brand"><span>QA</span><strong>Персональный курс</strong></span><p>Последовательная программа для старта в ручном тестировании.</p><a href="#content">Наверх ↑</a></footer>
  <dialog class="interest-dialog" aria-labelledby="interest-title"><button class="dialog-close" type="button" data-dialog-close aria-label="Закрыть">×</button><span class="section-label">Скоро</span><h2 id="interest-title">Набор ещё не открыт</h2><p>Курс пока готовится к запуску. Здесь появится форма записи, когда будут определены формат участия, дата старта и стоимость.</p><button class="button" type="button" data-dialog-close>Понятно</button></dialog>
</body>
</html>`;
}

function courseCard(course, depth = 0) {
  const base = '../'.repeat(depth);
  return `<a class="course-card ${course.accent}" href="${base}courses/${course.slug}/">
    <span class="eyebrow">${isUnified ? 'Архив' : 'Курс'}</span>
    <h2>${escapeHtml(course.title)}</h2>
    <p>${escapeHtml(course.description)}</p>
    <dl><div><dt>Модули</dt><dd>${course.modules.length}</dd></div><div><dt>Темы</dt><dd>${course.chapterCount}</dd></div><div><dt>Страницы</dt><dd>${course.pages.length}</dd></div></dl>
    <span class="card-link">Открыть структуру <span aria-hidden="true">→</span></span>
  </a>`;
}

function pageKind(type) {
  return ({ lecture: 'Лекция', mentorCheckTask: 'Практическое задание' })[type] || 'Материал';
}

function cleanLessonHeading(html, title) {
  const normalized = (value) => plainText(value).replace(/&[a-z]+;|&#\d+;/gi, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').toLocaleLowerCase('ru').trim();
  const first = /<h1>([\s\S]*?)<\/h1>/i.exec(html);
  if (!first) return html;
  const heading = normalized(first[1]);
  const pageTitle = normalized(title);
  return heading === pageTitle || heading === pageTitle.replace(/^лекция\s+/, '') ? html.replace(first[0], '') : html;
}

function countNoun(count, one, few, many) {
  const suffix = count % 100 >= 11 && count % 100 <= 14 ? many : count % 10 === 1 ? one : count % 10 >= 2 && count % 10 <= 4 ? few : many;
  return `${count} ${suffix}`;
}

const stepCount = (count) => countNoun(count, 'шаг', 'шага', 'шагов');
const pageCount = (count) => countNoun(count, 'страница', 'страницы', 'страниц');
const moduleCount = (count) => countNoun(count, 'модуль', 'модуля', 'модулей');
const topicCount = (count) => countNoun(count, 'тема', 'темы', 'тем');
const courseCount = (count) => countNoun(count, 'курс', 'курса', 'курсов');

function displayStageTitle(title) { return title.replace(/^\d+\.\s*/, ''); }

function editorializeLessonHtml(courseSlug, pageNumber, html) {
  if (courseSlug === 'manual-testing' && pageNumber === 123) {
    return html.replace(
      /<p>Мы уже <strong>изучали тему требований<\/strong>, и выполняя <strong>домашние задания<\/strong>, вы <strong>сами формировали требования<\/strong>\. На их основе вы создавали <strong>тестовую документацию<\/strong> и определяли, как система должна работать\./,
      '<p>Вы уже познакомились с темой требований и их основными источниками. Теперь разберём, как анализировать требования, находить в них пробелы и использовать их как основу для проверок.',
    );
  }
  if (courseSlug === 'mqa-base' && pageNumber === 36) {
    return html.replace('Купить билет один детский билет на текущую дату.', 'Купить один детский билет на текущую дату.');
  }
  if (courseSlug === 'mqa-base' && pageNumber === 41) {
    return `${html}<section class="lesson-section merged-lesson"><h2>Приоритет в баг-репортах</h2>
      <p>В баг-репорте приоритет показывает, в каком порядке команде стоит исправлять найденные ошибки. Он не описывает масштаб поломки — для этого используется серьёзность, — а помогает решить, чем заниматься раньше.</p>
      <div class="lesson-method"><p><strong>Высокий приоритет</strong> получают ошибки, заметно влияющие на ключевые сценарии или доверие пользователя. Например, после оплаты не приходит подтверждение либо при сохранении теряется часть введённых данных.</p></div>
      <div class="lesson-method"><p><strong>Средний приоритет</strong> подходит для ошибок, которые не блокируют основное действие, но делают его неочевидным или неудобным. Например, фильтр срабатывает со второго раза или данные обновляются только после перезагрузки.</p></div>
      <div class="lesson-method"><p><strong>Низкий приоритет</strong> используют для небольших неточностей, не влияющих на функциональность: неудачной формулировки уведомления или незначительного расхождения с макетом.</p></div>
      <div class="lesson-info"><p>Первичную оценку может поставить тестировщик, а команда или владелец продукта — изменить её с учётом сроков и бизнес-рисков. Главное, чтобы причина выбранного приоритета была понятна всем участникам.</p></div>
    </section>`;
  }
  return html;
}

const whyTestIntro = `<section class="editorial-intro principles-lesson">
  <h2>Зачем тестировать</h2>
  <p>Тестирование помогает обнаружить расхождение между тем, как продукт должен работать, и тем, что получает пользователь. Оно снижает неопределённость и помогает команде принять обоснованное решение о выпуске, но не превращает продукт в систему без единой ошибки.</p>
  <p>Семь принципов ниже объясняют, почему тестировщик выбирает приоритеты, начинает работу до появления готового кода и регулярно пересматривает проверки. Это не строгие инструкции на каждый случай, а ориентиры для принятия решений.</p>

  <figure class="course-visual"><img src="../../assets/testing-principles/seven-testing-principles.png" alt="Тестировщик рассматривает цифровой продукт, окружённый семью визуальными символами принципов тестирования" width="1536" height="1024" loading="lazy"><figcaption>Принципы помогают не пытаться проверить всё подряд, а выбирать проверки осознанно.</figcaption></figure>

  <h2>Семь принципов тестирования</h2>

  <h3>1. Исчерпывающее тестирование невозможно</h3>
  <p>У любой системы слишком много комбинаций данных, состояний, устройств и действий. Даже поле из нескольких символов может иметь огромное количество вариантов. Проверить абсолютно всё нельзя ни вручную, ни автотестами.</p>
  <div class="lesson-info"><p><strong>На практике:</strong> проверки выбирают по рискам и приоритетам. Используют классы эквивалентности, граничные значения, критические пользовательские пути и статистику реального использования.</p></div>

  <h3>2. Тестирование показывает наличие дефектов, а не их отсутствие</h3>
  <p>Если проверка нашла ошибку, её существование подтверждено. Если все проверки прошли, это означает только то, что в проверенных условиях известные проблемы не проявились. Непроверенный сценарий всё ещё может содержать дефект.</p>
  <div class="lesson-info"><p><strong>На практике:</strong> корректная формулировка результата звучит как «критические сценарии проверены, известных блокирующих дефектов нет», а не «багов в продукте нет».</p></div>

  <h3>3. Отсутствие ошибок не гарантирует полезность продукта</h3>
  <p>Команда может идеально реализовать неправильное или ненужное требование. Приложение будет работать без технических сбоев, но пользователь не сможет решить свою задачу. Качество связано не только с кодом, но и с тем, подходит ли результат людям и бизнесу.</p>
  <div class="lesson-info"><p><strong>На практике:</strong> проверяют не только соответствие спецификации, но и смысл требования, понятность сценария и достижение ожидаемого результата.</p></div>

  <h3>4. Раннее тестирование экономит время и деньги</h3>
  <p>Ошибку в требовании или макете дешевле исправить до разработки. Если та же проблема попадёт в готовый код или production, придётся менять реализацию, обновлять тесты, повторять проверки и иногда исправлять данные пользователей.</p>
  <div class="lesson-info"><p><strong>На практике:</strong> тестировщик участвует в обсуждении требований, задаёт вопросы к макетам, проверяет критерии приёмки и заранее отмечает спорные случаи.</p></div>

  <h3>5. Дефекты склонны скапливаться</h3>
  <p>Большая часть ошибок часто находится в небольшом числе модулей. Причиной может быть сложная логика, частые изменения, слабая документация, большое количество интеграций или накопленный технический долг.</p>
  <div class="lesson-info"><p><strong>На практике:</strong> если в одном месте найдено несколько связанных проблем, этот участок проверяют глубже. При этом остальные части продукта не исключают из тестирования полностью.</p></div>

  <h3>6. Тестирование зависит от контекста</h3>
  <p>Для интернет-магазина, медицинской системы, игры и банковского приложения нельзя использовать одну и ту же стратегию. Отличаются риски, цена ошибки, аудитория, устройства, сроки, законодательные требования и допустимый уровень качества.</p>
  <div class="lesson-info"><p><strong>На практике:</strong> перед составлением проверок уточняют тип продукта, его пользователей, ключевые риски, окружение, частоту релизов и доступные ресурсы.</p></div>

  <h3>7. Повторение одинаковых тестов со временем теряет эффективность</h3>
  <p>Один и тот же набор проверок хорошо находит уже известные типы проблем, но постепенно перестаёт открывать новые. Продукт меняется, а непройденные пути и необычные сочетания условий остаются за пределами привычной регрессии. Этот эффект традиционно называют парадоксом пестицида.</p>

  <figure class="course-visual course-meme"><img src="../../assets/testing-principles/pesticide-paradox.png" alt="Тестировщик повторяет одинаковые успешные проверки, пока ошибки остаются на другом непройденном пути" width="1536" height="1024" loading="lazy"><figcaption>Если всегда идти по одной и той же дорожке, новые дефекты могут остаться рядом незамеченными.</figcaption></figure>

  <div class="lesson-info"><p><strong>На практике:</strong> тест-кейсы пересматривают, добавляют новые данные и сценарии, применяют разные техники, исследовательское тестирование и анализ новых рисков. Автотесты также обновляют вместе с продуктом.</p></div>

  <h2>Как использовать принципы вместе</h2>
  <ul>
    <li>Не пытайтесь проверить всё - определяйте риски и приоритеты.</li>
    <li>Начинайте задавать вопросы ещё на этапе идеи, требования и макета.</li>
    <li>Не обещайте отсутствие ошибок - объясняйте, что именно проверено и какие риски остаются.</li>
    <li>Учитывайте назначение продукта и цену возможной ошибки.</li>
    <li>Пересматривайте регрессию после изменений и найденных дефектов.</li>
  </ul>
  <p>Материал подготовлен на основе общепринятых принципов тестирования и переработан по мотивам статьи <a href="https://habr.com/ru/articles/699990/" target="_blank" rel="noopener noreferrer">«Принципы тестирования: нас 7»</a>.</p>
</section>`;

const courses = courseDefs.map((def) => {
  const structure = readJson(def.course);
  const pages = readJson(def.content);
  const summary = readJson(def.summary);
  if (!Array.isArray(pages)) throw new Error(`${def.content}: ожидался массив`);
  if (summary.pagesExported !== pages.length || summary.errors !== 0) {
    throw new Error(`${def.slug}: контрольные количества выгрузки не совпадают`);
  }

  const ordered = pages.map((page, index) => {
    let safeTitle = neutralizeBrand(page.content?.title || page.heading?.taskTitle || `Шаг ${index + 1}`);
    if (def.slug === 'mqa-base' && index + 1 === 1) safeTitle = 'Лекция «Зачем тестировать: семь главных принципов»';
    if (def.slug === 'mqa-base' && index + 1 === 41) safeTitle = 'Лекция «Приоритет в тестовой документации»';
    const safeHtml = cleanLessonHeading(sanitizeHtml(page.content?.description || ''), safeTitle);
    return {
      ...page,
      moduleName: neutralizeBrand(page.moduleName),
      chapterName: neutralizeBrand(page.chapterName),
      index,
      number: index + 1,
      file: `step-${String(index + 1).padStart(3, '0')}.html`,
      safeTitle,
      safeHtml: def.slug === 'mqa-base' && index === 0
        ? whyTestIntro
        : editorializeLessonHtml(def.slug, index + 1, safeHtml),
    };
  }).filter((page) => page.taskType !== 'multi_input' && page.taskType !== 'review_step');

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

const totalSourcePages = courses.reduce((sum, course) => sum + course.pages.length, 0);
const totalChapters = courses.reduce((sum, course) => sum + course.chapterCount, 0);
const curriculum = buildCurriculum(courses);
const totalPages = curriculum.records.length;
const routeByUrl = new Map(curriculum?.records.map((record, index) => [record.url, { record, index }]) || []);
const routeBySourceKey = new Map(curriculum?.records.map((record) => [`${record.source.course === 'mqa-base' ? 'Q' : 'M'}${record.source.step}`, record]) || []);

function routeHome() {
  const kindLabel = { lecture: 'Лекции', mixed: 'Лекции + практика', practice: 'Практика' };
  const outline = curriculum.stages.map((stage) => `<section class="module-block route-stage" id="${stage.id}">
    <header><span>${String(stage.number).padStart(2, '0')}</span><div><p>Этап ${stage.number}</p><h2>${escapeHtml(displayStageTitle(stage.title))}</h2></div><strong>${stepCount(stage.topics.reduce((sum, topic) => sum + topic.items.length, 0))}</strong></header>
    <p class="stage-goal">${escapeHtml(stage.goal)} <strong>Результат:</strong> ${escapeHtml(stage.outcome)}</p>${stage.id === 'end-to-end' ? '<aside class="capstone"><h3>Итоговая работа</h3><p>Возьмите один знакомый веб-сценарий. Зафиксируйте требование и вопросы к нему, составьте проверки, выполните их в интерфейсе и при необходимости через API/БД, затем опишите один воспроизводимый дефект. Упражнения ниже взяты из разных исходных контекстов: используйте их как образцы отдельных действий, а итоговую цепочку соберите на одном выбранном сценарии.</p></aside>' : ''}
    <div class="chapter-list">${stage.topics.map((topic, topicIndex) => `<details id="${stage.id}-topic-${topicIndex + 1}"><summary><span>${escapeHtml(topic.title)} <small class="role-chip ${topic.kind}">${kindLabel[topic.kind]}</small></span><span class="chapter-toggle"><small>${topic.items.length}</small><span class="chapter-chevron" aria-hidden="true">▸</span></span></summary><ol>${topic.items.map((item) => `<li><a href="${item.url}"><span>${String(item.route.lessonOrder).padStart(3, '0')}</span><strong>${escapeHtml(item.title)}</strong><em>${item.alternativeTo ? 'Другой разбор' : escapeHtml(item.source.course === 'mqa-base' ? 'MQA Base' : 'Ручное тестирование')}</em></a></li>`).join('')}</ol></details>`).join('')}</div>
  </section>`).join('');
  return `<section class="intro-course-card"><div><h1>${escapeHtml(introCourse.title)}</h1><p>${escapeHtml(introCourse.description)}</p></div><div class="intro-course-actions"><a class="route-start" href="courses/${introCourse.slug}/">Открыть вводный курс →</a></div></section>
  <section class="home-intro route-intro" id="main-route"><div><span class="eyebrow">Основной курс QA · ${stepCount(totalPages)}</span><h1>От знакомства с QA<br><span>до найденного дефекта</span></h1></div><div class="home-copy"><a class="route-start" href="${curriculum.records[0].url}">Перейти к основному курсу →</a><form class="search-hero" action="search.html" role="search"><label class="sr-only" for="home-search">Поиск по маршруту</label><input id="home-search" name="q" type="search" placeholder="Например, граничные значения" required><button>Найти</button></form></div></section>
  <nav class="route-jump" aria-label="Этапы маршрута">${curriculum.stages.map((stage) => `<a href="#${stage.id}">${escapeHtml(displayStageTitle(stage.title))}</a>`).join('')}</nav>
  <div class="outline route-outline">${outline}</div>
  <section id="archive" class="archive-section"><span class="eyebrow">Исходные материалы</span><h2>Архив исходных курсов</h2><p>Прежние структуры учебных материалов сохранены для ссылок и сверки; формы обратной связи и ревью исключены. Для обучения используйте единый маршрут выше.</p><div class="course-grid">${courses.map((course) => courseCard(course)).join('')}</div></section>`;
}

function salesLanding() {
  const program = curriculum.stages.map((stage) => {
    const count = stage.topics.reduce((sum, topic) => sum + topic.items.length, 0);
    return `<details class="program-stage"${stage.number === 1 ? ' open' : ''}><summary><span class="program-number">${String(stage.number).padStart(2, '0')}</span><span><strong>${escapeHtml(displayStageTitle(stage.title))}</strong><small>${escapeHtml(stage.goal)}</small></span><span class="program-count">${stepCount(count)}</span><span class="program-plus" aria-hidden="true">+</span></summary><div class="program-body"><p><strong>После этапа:</strong> ${escapeHtml(stage.outcome)}</p><ul>${stage.topics.map((topic) => `<li>${escapeHtml(topic.title)}</li>`).join('')}</ul></div></details>`;
  }).join('');

  return `<section class="sales-hero">
    <div class="hero-copy"><span class="section-label">Курс ручного тестирования · с нуля</span><h1>Научитесь видеть продукт <em>глазами тестировщика</em></h1><p class="hero-lead">Последовательный маршрут от устройства IT-продукта и требований до тест-кейсов, API, SQL и самостоятельного разбора дефектов.</p><div class="hero-actions"><button type="button" class="button" data-interest>Узнать о старте курса</button><a class="text-link" href="#program">Посмотреть программу <span>↓</span></a></div><p class="hero-note">Запись откроется позже. Доступ к учебным материалам на этой странице не публикуется.</p></div>
    <div class="hero-visual" aria-label="Пример рабочего пространства тестировщика">
      <div class="visual-glow"></div><div class="browser-card"><div class="browser-bar"><i></i><i></i><i></i><span>checkout.example</span></div><div class="checkout-screen"><div class="screen-copy"><small>Оформление заказа</small><strong>Почти готово</strong><span></span><span></span><span class="short"></span></div><div class="screen-form"><span>Email</span><div>student@example.com</div><span>Промокод</span><div class="error-field">QA-START</div><button type="button" tabindex="-1">Оплатить</button></div></div></div>
      <div class="bug-card"><span>BUG-014</span><strong>Скидка не применяется</strong><small>Severity: Major · Priority: High</small></div><div class="check-card"><span>✓</span><p><strong>Ожидаемый результат</strong><br>Итоговая сумма пересчитана</p></div>
    </div>
  </section>

  <section class="trust-strip" aria-label="Ключевые особенности"><div><strong>9</strong><span>последовательных этапов</span></div><div><strong>${totalPages}</strong><span>${totalPages === 282 ? 'шага' : 'учебных шагов'}</span></div><div><strong>0 → QA</strong><span>можно начать без опыта в IT</span></div><div><strong>Теория + практика</strong><span>знания сразу связываются с задачами</span></div></section>

  <section class="sales-section problem-section" id="results"><div class="section-heading"><span class="section-label">Не просто набор лекций</span><h2>Вы будете понимать, <em>что и зачем</em> проверяете</h2><p>Темы собраны в один маршрут по нарастающей сложности. Каждый этап опирается на предыдущий — без хаотичного переключения между инструментами.</p></div><div class="result-grid">
    <article><span>01</span><h3>Разобраться в продукте</h3><p>Понимать роли в IT-команде, путь запроса и место тестировщика в разработке.</p></article>
    <article><span>02</span><h3>Спроектировать проверки</h3><p>Анализировать требования, выбирать виды тестирования и применять техники тест-дизайна.</p></article>
    <article><span>03</span><h3>Описать результат</h3><p>Создавать чек-листы, тест-кейсы и воспроизводимые баг-репорты для команды.</p></article>
    <article><span>04</span><h3>Заглянуть глубже интерфейса</h3><p>Работать с HTTP, API, DevTools, Postman и SQL на уровне начинающего QA.</p></article>
  </div></section>

  <section class="sales-section program-section" id="program"><div class="section-heading split-heading"><div><span class="section-label">Программа</span><h2>От первого термина<br>до цельной проверки</h2></div><p>Программа объединяет вводную базу для новичка и основной QA-маршрут. Ниже — реальные этапы курса без маркетинговых модулей-заглушек.</p></div><div class="program-list">${program}</div></section>

  <section class="sales-section format-section" id="format"><div class="section-heading"><span class="section-label">Как устроено обучение</span><h2>Короткий цикл, который повторяется на каждом этапе</h2></div><div class="format-flow"><article><span>1</span><div><h3>Понять</h3><p>Спокойно разобрать термин, процесс или инструмент на понятном примере.</p></div></article><b>→</b><article><span>2</span><div><h3>Увидеть связь</h3><p>Понять, где знание используется в продукте и с какими рисками связано.</p></div></article><b>→</b><article><span>3</span><div><h3>Применить</h3><p>Закрепить материал проверкой, документом, запросом или разбором ситуации.</p></div></article></div><div class="workspace-panel"><div><span class="section-label">Внутри курса</span><h3>Один маршрут вместо десятков случайных источников</h3><p>Лекции, примеры и практические задания расположены в нужной очередности. Можно видеть текущий этап, возвращаться к теме и искать материал по названию или фразе.</p></div><div class="workspace-preview"><div class="workspace-top"><span>Ваш маршрут</span><b>37%</b></div><i><u></u></i><ol><li class="done"><span>✓</span> Требования</li><li class="current"><span>04</span> Тестовая документация</li><li><span>05</span> Тест-дизайн</li><li><span>06</span> Веб и API</li></ol></div></div></section>

  <section class="sales-section audience-section"><div class="audience-card fit"><span class="section-label">Курс подойдёт, если вы</span><h2>Хотите войти в QA осознанно</h2><ul><li>начинаете с нуля и хотите сначала понять устройство IT;</li><li>цените последовательную программу без скачков между темами;</li><li>готовы не только читать, но и разбирать примеры и задания;</li><li>хотите получить базу для первого собеседования на ручного тестировщика.</li></ul></div><div class="audience-card honest"><span class="section-label">Честно о формате</span><h2>Курс не обещает магии</h2><ul><li>результат потребует регулярного самостоятельного изучения;</li><li>одного просмотра материалов недостаточно без практики;</li><li>курс даёт систему знаний, но не гарантирует трудоустройство;</li><li>дата старта, стоимость и условия участия будут объявлены позже.</li></ul></div></section>

  <section class="sales-section faq-section" id="faq"><div class="section-heading"><span class="section-label">Частые вопросы</span><h2>Перед стартом</h2></div><div class="faq-list">
    <details><summary>Можно ли начать без опыта в IT?<span>+</span></summary><p>Да. Перед основным маршрутом есть короткий вводный курс: он объясняет, что такое программное обеспечение, из каких частей состоит цифровой продукт и что делает тестировщик.</p></details>
    <details><summary>Какие темы входят в программу?<span>+</span></summary><p>Требования, виды тестирования, тестовая документация, тест-дизайн, клиент-серверное взаимодействие, HTTP и API, DevTools, Postman, базы данных, SQL, сквозная практика и вопросы для собеседования.</p></details>
    <details><summary>Сколько длится обучение?<span>+</span></summary><p>Программа содержит ${stepCount(totalPages)} и рассчитана на последовательное прохождение. Точный календарный график будет опубликован вместе с условиями набора.</p></details>
    <details><summary>Уже можно получить доступ к курсу?<span>+</span></summary><p>Пока нет. Эта страница знакомит с программой; доступы, формат участия и запись появятся после подготовки запуска.</p></details>
    <details><summary>Курс гарантирует трудоустройство?<span>+</span></summary><p>Нет. Он формирует системную базу ручного тестировщика и помогает подготовиться к техническим вопросам, но результат поиска работы зависит от практики, рынка и действий самого ученика.</p></details>
  </div></section>

  <section class="final-cta"><span class="section-label">Готовы начать с основ?</span><h2>Соберите знания о QA<br>в понятную систему</h2><p>Набор ещё не открыт. На следующем этапе здесь появятся дата старта, формат участия и запись.</p><button type="button" class="button button-light" data-interest>Узнать о старте курса</button></section>`;
}

write('index.html', shell({
  title: 'Персональный курс QA',
  description: `${pageCount(totalPages)} учебных материалов по ручному тестированию и MQA Base.`,
  body: routeHome(),
}));

write('qa-course/index.html', landingShell({ body: salesLanding() }));

for (const course of courses) {
  const outline = course.modules.map((module) => `<section class="module-block">
    <header><span>${String(module.position).padStart(2, '0')}</span><div><p>Модуль</p><h2>${escapeHtml(module.name)}</h2></div><strong>${stepCount(module.chapters.reduce((sum, chapter) => sum + chapter.pages.length, 0))}</strong></header>
    <div class="chapter-list">${module.chapters.map((chapter) => `<details><summary><span>${escapeHtml(chapter.name)}</span><span class="chapter-toggle"><small>${chapter.pages.length}</small><span class="chapter-chevron" aria-hidden="true">▸</span></span></summary><ol>${chapter.pages.map((page) => `<li><a href="${page.file}"><span>${String(page.number).padStart(3, '0')}</span><strong>${escapeHtml(page.safeTitle)}</strong><em>${pageKind(page.taskType)}</em></a></li>`).join('')}</ol></details>`).join('')}</div>
  </section>`).join('');

  write(`courses/${course.slug}/index.html`, shell({
    title: course.title,
    description: course.description,
    depth: 2,
    current: course.slug,
    body: `<div class="course-head ${course.accent}"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="../../index.html">Главная</a><span>/</span><span>${escapeHtml(course.title)}</span></nav>
      <span class="eyebrow">Архив исходного курса · ${moduleCount(course.modules.length)} · ${pageCount(course.pages.length)}</span><h1>${escapeHtml(course.title)}</h1><p>${escapeHtml(course.description)}</p><p><a href="../../index.html">Перейти к единому учебному маршруту →</a></p>
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
    const followsRoute = Boolean(routePosition);
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
      body: `<div class="reader-layout"><aside class="reader-rail"><a href="${followsRoute ? '../../index.html' : 'index.html'}">← ${followsRoute ? 'Единый маршрут' : 'Структура курса'}</a><div class="rail-index"><span>${String(followsRoute ? routePosition.index + 1 : page.number).padStart(3, '0')}</span><small>из ${followsRoute ? totalPages : course.pages.length}</small></div><p>${escapeHtml(followsRoute ? routeRecord.route.stageTitle : page.chapterName)}</p><div class="rail-progress" aria-label="Шаг ${followsRoute ? routePosition.index + 1 : chapterPos} из ${followsRoute ? totalPages : chapterPages.length}"><i style="width:${Math.round((followsRoute ? routePosition.index + 1 : chapterPos) / (followsRoute ? totalPages : chapterPages.length) * 100)}%"></i></div><small>${followsRoute ? `${routeRecord.route.topic} · ${pageKind(page.taskType)}` : `${chapterPos} / ${chapterPages.length} в теме`}</small></aside>
        <article class="lesson"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="../../index.html">${followsRoute ? 'Единый маршрут' : 'Главная'}</a><span>/</span>${followsRoute ? `<a href="../../index.html#${routeRecord.route.stage}">${escapeHtml(routeRecord.route.stageTitle)}</a><span>/</span><span>${escapeHtml(routeRecord.route.topic)}</span>` : `<a href="index.html">${escapeHtml(course.title)}</a><span>/</span><span>${escapeHtml(page.moduleName)}</span><span>/</span><span>${escapeHtml(page.chapterName)}</span>`}</nav>
          <header class="lesson-head"><span class="type-chip">${pageKind(page.taskType)}</span><h1>${escapeHtml(page.safeTitle)}</h1><p>${escapeHtml(page.moduleName)} · ${escapeHtml(page.chapterName)}</p>${alternativeBase ? `<p class="alternative-note">Другой разбор темы. <a href="../../${alternativeBase.url}">Основное объяснение: ${escapeHtml(alternativeBase.title)} →</a></p>` : ''}</header>
          <div class="lesson-content ${course.slug === 'mqa-base' && page.number === 84 ? 'numbered-attributes' : ''}">${page.safeHtml || '<p>Текст для этого шага отсутствует в выгрузке.</p>'}</div>
          ${followsRoute ? routePager : `<nav class="pager" aria-label="Навигация между шагами">${previous ? `<a class="prev" href="${previous.file}"><small>Назад</small><span>← ${escapeHtml(previous.safeTitle)}</span></a>` : '<span></span>'}${next ? `<a class="next" href="${next.file}"><small>Дальше</small><span>${escapeHtml(next.safeTitle)} →</span></a>` : `<a class="next" href="index.html"><small>Готово</small><span>К структуре курса →</span></a>`}</nav>`}
          <p class="source-note">Источник: <a href="index.html">${escapeHtml(course.title)}</a> · ${escapeHtml(page.moduleName)} / ${escapeHtml(page.chapterName)} · исходный шаг ${page.number}.</p>
        </article></div>`,
    }));
  });
}

{
  const readyLessons = activeIntroBlocks.flatMap((block, blockIndex) => block.lessons.map((lesson) => ({ ...lesson, block, blockIndex })));
  const introOutline = activeIntroBlocks.map((block, blockIndex) => {
    const lessons = block.lessons.length ? `<ol>${block.lessons.map((lesson, lessonIndex) => `<li><a href="lesson-${String(readyLessons.findIndex((item) => item.slug === lesson.slug) + 1).padStart(2, '0')}.html"><span>${String(lessonIndex + 1).padStart(2, '0')}</span><strong>${escapeHtml(lesson.title)}</strong><em>${lesson.minutes} минут</em></a></li>`).join('')}</ol>` : '<p class="planned-block">Материалы будут добавлены после согласования первого блока.</p>';
    return `<section class="module-block intro-block"><header><span>${String(blockIndex + 1).padStart(2, '0')}</span><div><p>Блок ${blockIndex + 1}</p><h2>${escapeHtml(block.title)}</h2></div></header><div class="chapter-list">${lessons}</div></section>`;
  }).join('');

  write(`courses/${introCourse.slug}/index.html`, shell({
    title: introCourse.title,
    description: introCourse.description,
    depth: 2,
    body: `<div class="course-head intro-head"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="../../index.html">Главная</a><span>/</span><span>${escapeHtml(introCourse.title)}</span></nav><h1>${escapeHtml(introCourse.title)}</h1><p>${escapeHtml(introCourse.description)}</p></div><div class="outline intro-outline">${introOutline}</div>`,
  }));

  readyLessons.forEach((lesson, index) => {
    const previous = readyLessons[index - 1];
    const next = readyLessons[index + 1];
    const fileFor = (position) => `lesson-${String(position + 1).padStart(2, '0')}.html`;
    write(`courses/${introCourse.slug}/${fileFor(index)}`, shell({
      title: lesson.title,
      description: plainText(lesson.html).slice(0, 155),
      depth: 2,
      body: `<div class="reader-layout"><aside class="reader-rail"><a href="index.html">← Содержание курса</a><div class="rail-index"><span>${String(index + 1).padStart(2, '0')}</span><small>из ${readyLessons.length}</small></div><p>${escapeHtml(lesson.block.title)}</p><div class="rail-progress" aria-label="Лекция ${index + 1} из ${readyLessons.length}"><i style="width:${Math.round((index + 1) / readyLessons.length * 100)}%"></i></div><small>${lesson.minutes} минут · Лекция</small></aside><article class="lesson"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="../../index.html">Главная</a><span>/</span><a href="index.html">${escapeHtml(introCourse.title)}</a><span>/</span><span>${escapeHtml(lesson.block.title)}</span></nav><header class="lesson-head"><h1>${escapeHtml(lesson.title)}</h1><p>Блок ${lesson.blockIndex + 1} · ${escapeHtml(lesson.block.title)}</p></header><div class="lesson-content">${lesson.html}</div><nav class="pager" aria-label="Навигация между лекциями">${previous ? `<a class="prev" href="${fileFor(index - 1)}"><small>Назад</small><span>← ${escapeHtml(previous.title)}</span></a>` : '<span></span>'}${next ? `<a class="next" href="${fileFor(index + 1)}"><small>Дальше</small><span>${escapeHtml(next.title)} →</span></a>` : '<a class="next" href="index.html"><small>Курс завершён</small><span>К содержанию курса →</span></a>'}</nav></article></div>`,
    }));
  });
}

const searchIndex = courses.flatMap((course) => course.pages.flatMap((page) => {
  const url = `courses/${course.slug}/${page.file}`;
  const place = routeByUrl.get(url)?.record;
  if (!place) return [];
  return [{
    course: 'Единый маршрут',
    courseSlug: course.slug,
    module: displayStageTitle(place.route.stageTitle),
    chapter: place.route.topic,
    stageId: place.route.stage,
    topicId: `${place.route.stage}-topic-${place.route.topicOrder}`,
    stageNumber: place.route.stageOrder,
    title: page.safeTitle,
    type: pageKind(page.taskType),
    url,
    text: plainText(page.safeHtml).slice(0, 12000),
  }];
}));
{
  searchIndex.sort((a, b) => routeByUrl.get(a.url).index - routeByUrl.get(b.url).index);
  const introSearchLessons = activeIntroBlocks.flatMap((block, blockIndex) => block.lessons.map((lesson) => ({ ...lesson, block, blockIndex })));
  const introSearch = introSearchLessons.map((lesson, lessonIndex) => ({
    course: introCourse.title,
    courseSlug: introCourse.slug,
    module: `Блок ${lesson.blockIndex + 1}. ${lesson.block.title}`,
    chapter: lesson.block.title,
    title: lesson.title,
    type: 'Вводная лекция',
    url: `courses/${introCourse.slug}/lesson-${String(lessonIndex + 1).padStart(2, '0')}.html`,
    text: plainText(lesson.html).slice(0, 12000),
  }));
  searchIndex.unshift(...introSearch);
}
write('assets/search-index.json', JSON.stringify(searchIndex));
if (isUnified) write('assets/route-map.json', JSON.stringify(curriculum.records, null, 2) + '\n');

write('search.html', shell({
  title: 'Поиск',
  description: 'Полнотекстовый поиск по единому маршруту тестирования.',
  body: `<section class="search-page"><span class="eyebrow">Поиск по ${searchIndex.length} материалам</span><h1>Что вы хотите найти?</h1><form id="search-form" class="search-large" role="search"><label class="sr-only" for="search-input">Поиск</label><input id="search-input" name="q" type="search" placeholder="Введите термин или фразу" autofocus><button>Найти</button></form><p id="search-status" class="search-status" aria-live="polite">Введите не меньше двух символов.</p><div id="search-results" class="search-results"></div></section>`,
}));

write('about.html', shell({
  title: 'О курсе',
  description: 'Как устроен персональный курс QA.',
  body: `<article class="about"><span class="eyebrow">Персональный курс QA</span><h1>Спокойное чтение,<br>без действий на платформе</h1><p>На сайте доступны вводный курс, основной QA-маршрут и архив исходных учебных материалов.</p><h2>Что сохранено</h2><ul><li>заголовки, текст, списки, таблицы и безопасные внешние ссылки;</li><li>вводный курс, основной маршрут «этап → тема → шаг» и архивная структура учебных материалов;</li><li>текстовые описания изображений без загрузки самих файлов.</li></ul><h2>Чего здесь нет</h2><p>Логинов, паролей, cookies, токенов, профилей учеников, комментариев, прогресса, ответов и решений. Формы обратной связи и шаги ревью исключены; ответы не отправляются.</p></article>`,
}));

write('404.html', fs.readFileSync(path.join(outDir, 'index.html'), 'utf8'));
write('.nojekyll', '');
write('assets/site.css', fs.readFileSync(path.join(root, 'site-src', 'site.css'), 'utf8'));
if (isUnified) write('assets/route.css', fs.readFileSync(path.join(root, 'site-src', 'route.css'), 'utf8'));
write('assets/site.js', fs.readFileSync(path.join(root, 'site-src', 'site.js'), 'utf8'));
write('assets/landing.css', fs.readFileSync(path.join(root, 'site-src', 'landing.css'), 'utf8'));
write('assets/landing.js', fs.readFileSync(path.join(root, 'site-src', 'landing.js'), 'utf8'));
const staticAssetsDir = path.join(root, 'site-src', 'assets');
if (fs.existsSync(staticAssetsDir)) fs.cpSync(staticAssetsDir, path.join(outDir, 'assets'), { recursive: true });

console.log(JSON.stringify({ environment: siteEnvironment, courses: courses.length, chapters: totalChapters, pages: totalPages, searchRecords: searchIndex.length, output: outDir }));
