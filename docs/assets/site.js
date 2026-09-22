const searchFold = (value) => String(value).toLocaleLowerCase('ru').replace(/ё/g, 'е')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

function searchRange(value, query) {
  const text = String(value);
  let folded = '';
  const starts = [];
  const ends = [];
  let pendingSpace = false;
  for (let i = 0; i < text.length;) {
    const char = String.fromCodePoint(text.codePointAt(i));
    const end = i + char.length;
    const normalized = char.toLocaleLowerCase('ru').replace(/ё/g, 'е');
    if (/[\p{L}\p{N}]/u.test(normalized)) {
      if (pendingSpace && folded) { folded += ' '; starts.push(i); ends.push(i); }
      pendingSpace = false;
      folded += normalized;
      starts.push(i);
      ends.push(end);
    } else pendingSpace = true;
    i = end;
  }
  const needle = searchFold(query);
  const at = folded.indexOf(needle);
  return at < 0 ? null : [starts[at], ends[at + needle.length - 1]];
}

const searchEscape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function openLinkedTopic() {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target?.tagName === 'DETAILS') target.open = true;
}
window.addEventListener('hashchange', openLinkedTopic);
openLinkedTopic();
function searchEmphasis(text, query) {
  const range = searchRange(text, query);
  return range ? `${searchEscape(text.slice(0, range[0]))}<mark>${searchEscape(text.slice(range[0], range[1]))}</mark>${searchEscape(text.slice(range[1]))}` : searchEscape(text);
}

(() => {
  const form = document.querySelector('#search-form');
  const input = document.querySelector('#search-input');
  const status = document.querySelector('#search-status');
  const results = document.querySelector('#search-results');
  if (!form || !input || !status || !results) return;
  input.value = new URLSearchParams(location.search).get('q') || '';
  let indexPromise;
  const loadIndex = () => indexPromise ||= fetch('assets/search-index.json', { credentials: 'omit' }).then((response) => {
    if (!response.ok) throw new Error('Не удалось загрузить индекс');
    return response.json();
  });
  const excerpt = (text, query) => {
    const range = searchRange(text, query);
    if (!range) return searchEscape(text.slice(0, 180) + (text.length > 180 ? '…' : ''));
    const start = Math.max(0, range[0] - 80);
    const end = Math.min(text.length, range[1] + 130);
    return `${start ? '…' : ''}${searchEmphasis(text.slice(start, end), query)}${end < text.length ? '…' : ''}`;
  };

  async function runSearch() {
    const raw = input.value.trim();
    const term = searchFold(raw);
    if (term.length < 2) { status.textContent = 'Введите не меньше двух символов.'; results.replaceChildren(); return; }
    status.textContent = 'Ищу…';
    try {
      const index = await loadIndex();
      const guides = new Map();
      for (const item of index) {
        if (!item.stageId) continue;
        if (!guides.has(item.stageId)) guides.set(item.stageId, { title: `Этап ${item.stageNumber} · ${item.module}`, url: `index.html#${item.stageId}`, type: 'Этап' });
        if (!guides.has(item.topicId)) guides.set(item.topicId, { title: item.chapter, url: `index.html#${item.topicId}`, type: 'Тема', module: item.module });
      }
      const guideMatches = [...guides.values()].filter((item) => searchFold(item.title).includes(term)).map((item) => ({
        score: item.type === 'Этап' ? 100 : 80,
        html: `<a class="result" href="${searchEscape(item.url.replace('#', `?hl=${encodeURIComponent(raw)}&scope=guide#`))}"><small>${item.type}${item.module ? ` · ${searchEmphasis(item.module, raw)}` : ''}</small><h2>${searchEmphasis(item.title, raw)}</h2></a>`,
      }));
      const pageMatches = index.map((item) => {
        const titleMatch = searchFold(item.title).includes(term);
        const topicMatch = searchFold(item.chapter).includes(term);
        const textMatch = searchFold(item.text).includes(term);
        const score = (titleMatch ? 40 : 0) + (topicMatch ? 16 : 0) + (textMatch ? 1 : 0);
        const scope = titleMatch ? 'title' : topicMatch ? 'topic' : 'content';
        return { item, score, scope, titleMatch, textMatch };
      }).filter(({ score, titleMatch, textMatch }) => score > 0 && (titleMatch || textMatch)).map(({ item, score, scope }) => ({
        score,
        html: `<a class="result" href="${searchEscape(item.url)}?hl=${encodeURIComponent(raw)}&scope=${scope}"><small>${searchEscape(item.course)} · ${searchEscape(item.module)} · ${searchEscape(item.type)}</small><h2>${searchEmphasis(item.title, raw)}</h2><p>${searchEmphasis(item.chapter, raw)}</p>${scope === 'content' || searchRange(item.text, raw) ? `<p>${excerpt(item.text, raw)}</p>` : ''}</a>`,
      }));
      const found = [...guideMatches, ...pageMatches].sort((a, b) => b.score - a.score);
      status.textContent = found.length ? `Найдено: ${found.length}` : 'Ничего не найдено. Попробуйте другую формулировку.';
      results.innerHTML = found.slice(0, 80).map(({ html }) => html).join('');
      history.replaceState(null, '', `?q=${encodeURIComponent(raw)}`);
    } catch {
      status.textContent = 'Поиск временно недоступен. Обновите страницу и попробуйте снова.';
    }
  }
  form.addEventListener('submit', (event) => { event.preventDefault(); runSearch(); });
  if (input.value.trim().length >= 2) runSearch();
})();

(() => {
  const term = new URLSearchParams(location.search).get('hl')?.trim();
  const scope = new URLSearchParams(location.search).get('scope');
  const article = document.querySelector('article.lesson');
  const guide = !article && location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  const root = article || guide;
  if (!root || !term || term.length > 120) return;
  const marks = [];
  const markFirst = (root) => {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const text = nodes.map((node) => node.textContent).join('');
    const range = searchRange(text, term);
    if (!range) return;
    let offset = 0;
    for (const node of nodes) {
      const from = Math.max(0, range[0] - offset);
      const to = Math.min(node.textContent.length, range[1] - offset);
      offset += node.textContent.length;
      if (from >= to) continue;
      const selection = document.createRange();
      selection.setStart(node, from);
      selection.setEnd(node, to);
      const mark = document.createElement('mark');
      mark.className = 'search-hit';
      selection.surroundContents(mark);
      marks.push(mark);
    }
  };
  if (article) {
    if (scope === 'title') markFirst(article.querySelector('.lesson-head h1'));
    else if (scope === 'topic') markFirst(article.querySelector('.breadcrumbs'));
    else markFirst(article.querySelector('.lesson-content'));
    if (!marks.length) markFirst(article.querySelector('.lesson-head'));
    if (!marks.length) markFirst(article.querySelector('.lesson-content'));
    if (!marks.length) markFirst(article.querySelector('.breadcrumbs'));
  } else markFirst(guide.querySelector('header,summary'));
  if (!marks.length) return;
  requestAnimationFrame(() => marks[0].scrollIntoView({ block: 'center', behavior: 'auto' }));
  const clear = () => {
    for (const mark of marks) mark.replaceWith(document.createTextNode(mark.textContent));
    root.normalize();
    document.removeEventListener('pointerdown', clear, true);
    document.removeEventListener('touchstart', clear, true);
    document.removeEventListener('click', clear, true);
  };
  document.addEventListener('pointerdown', clear, true);
  document.addEventListener('touchstart', clear, { capture: true, passive: true });
  document.addEventListener('click', clear, true);
})();
