(() => {
  const form = document.querySelector('#search-form');
  const input = document.querySelector('#search-input');
  const status = document.querySelector('#search-status');
  const results = document.querySelector('#search-results');
  if (!form || !input || !status || !results) return;

  const params = new URLSearchParams(location.search);
  input.value = params.get('q') || '';
  let indexPromise;
  const loadIndex = () => indexPromise ||= fetch('assets/search-index.json', { credentials: 'omit' }).then((response) => {
    if (!response.ok) throw new Error('Не удалось загрузить индекс');
    return response.json();
  });
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const normalize = (value) => value.toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const excerpt = (text, term) => {
    const normalized = normalize(text);
    const at = normalized.indexOf(term);
    const start = Math.max(0, at - 90);
    const end = Math.min(text.length, at + term.length + 150);
    const snippet = `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
    return escape(snippet).replace(new RegExp(escape(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (match) => `<mark>${match}</mark>`);
  };

  async function runSearch() {
    const raw = input.value.trim();
    const term = normalize(raw);
    if (term.length < 2) {
      status.textContent = 'Введите не меньше двух символов.';
      results.replaceChildren();
      return;
    }
    status.textContent = 'Ищу…';
    try {
      const index = await loadIndex();
      const found = index.map((item) => {
        const title = normalize(item.title);
        const chapter = normalize(item.chapter);
        const text = normalize(item.text);
        const score = (title.includes(term) ? 20 : 0) + (chapter.includes(term) ? 8 : 0) + (text.includes(term) ? 1 : 0);
        return { item, score, text };
      }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, 80);
      status.textContent = found.length ? `Найдено: ${found.length}${found.length === 80 ? '+' : ''}` : 'Ничего не найдено. Попробуйте другую формулировку.';
      results.innerHTML = found.map(({ item }) => `<a class="result" href="${escape(item.url)}?hl=${encodeURIComponent(raw)}"><small>${escape(item.course)} · ${escape(item.module)} · ${escape(item.type)}</small><h2>${escape(item.title)}</h2><p>${excerpt(item.text, term)}</p></a>`).join('');
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
  const article = document.querySelector('article.lesson');
  if (!article || !term || term.length > 120) return;

  const normalize = (value) => value.toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const needle = normalize(term);
  const highlights = [];
  const markMatches = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = normalize(node.textContent);
      const matches = [];
      let from = 0;
      while (matches.length < 100 && from < text.length) {
        const at = text.indexOf(needle, from);
        if (at < 0) break;
        matches.push(at);
        from = at + needle.length;
      }
      for (const at of matches.reverse()) {
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + needle.length);
        const mark = document.createElement('mark');
        mark.className = 'search-hit';
        range.surroundContents(mark);
        highlights.push(mark);
      }
    }
  };

  markMatches(article.querySelector('.lesson-content'));
  if (!highlights.length) markMatches(article.querySelector('.lesson-head'));
  if (!highlights.length) markMatches(article.querySelector('.breadcrumbs'));
  if (!highlights.length) return;
  const first = article.querySelector('.search-hit');
  requestAnimationFrame(() => first.scrollIntoView({ block: 'center', behavior: 'auto' }));
  document.addEventListener('click', () => {
    for (const mark of highlights) mark.replaceWith(document.createTextNode(mark.textContent));
    article.normalize();
  }, { once: true });
})();
