// Reviewable, exhaustive placement of the two source courses. M = manual-testing,
// Q = mqa-base. Every source step must appear exactly once in this route.
const stages = [
  { id: 'start', title: '1. Старт и устройство продукта', goal: 'Понять роль тестировщика и путь запроса через веб-приложение.', outcome: 'Объясняете, что проверяет QA и где искать причину сбоя.', topics: [
    ['Зачем тестировать и как устроен курс', 'core', 'Q1'],
    ['Клиент, сервер, фронтенд и бэкенд', 'core', 'M59-65,M67'],
    ['Роли в IT-проекте', 'core', 'Q71'],
  ] },
  { id: 'requirements', title: '2. Требования', goal: 'Научиться извлекать проверяемые ожидания из требований и макетов.', outcome: 'Находите пробелы, задаёте вопросы и превращаете требование в проверки.', topics: [
    ['Смысл, типы и качество требований', 'core', 'Q80-84'],
    ['Источники и работа с изменениями', 'core', 'Q85-92,M123'],
    ['Практика требований', 'practice', 'Q94-97,M55'],
  ] },
  { id: 'checks', title: '3. Основные виды проверок', goal: 'Выбирать подход к проверке по цели, этапу и изменению продукта.', outcome: 'Составляете набор функциональных, негативных, smoke и исследовательских проверок.', topics: [
    ['Функциональные и UI-проверки', 'core', 'M1-6'],
    ['Позитивные и негативные сценарии', 'core', 'M20-21'],
    ['Уровни, готовность и способ выполнения', 'core', 'M22-32'],
    ['Smoke, регрессия и повторная проверка', 'core', 'M33-37'],
    ['Исследовательский подход и критический путь', 'core', 'M40-45'],
    ['Статические и динамические проверки', 'core', 'M46-47'],
    ['Расширенные нефункциональные направления', 'advanced', 'M7-19,M38'],
    ['Полевые советы', 'reference', 'M39,M48'],
  ] },
  { id: 'documents', title: '4. Тестовая документация', goal: 'Фиксировать проверки и дефекты так, чтобы команда могла их повторить.', outcome: 'Пишете чек-лист, тест-кейс и понятный баг-репорт.', topics: [
    ['Три основных документа и их связь', 'core', 'Q2-8'],
    ['Паспорт, состояние и окружение', 'core', 'Q9-23'],
    ['Шаги, ожидание и фактический результат', 'core', 'Q24-39'],
    ['Приоритет, серьёзность и вложения', 'core', 'Q40-46'],
    ['Выбор формата и поддержка проверок', 'core', 'Q47-59,M124'],
    ['Разобранные примеры', 'practice', 'Q60-69,M127'],
    ['Практика документов и баг-репортов', 'practice', 'Q74-78'],
    ['Как учиться по материалам', 'reference', 'Q72-73'],
  ] },
  { id: 'design', title: '5. Тест-дизайн', goal: 'Получать сильное покрытие без перебора всех комбинаций.', outcome: 'Применяете классы, границы, пары, решения и переходы состояний.', topics: [
    ['Основа и выбор техники', 'core', 'Q101,Q109,Q116-117'],
    ['Классы эквивалентности и границы', 'core', 'Q115,Q114,Q113,Q112,Q111,Q118'],
    ['Попарное тестирование', 'core', 'Q110,Q108'],
    ['Таблицы решений и причины-следствия', 'core', 'Q107,Q106,Q104'],
    ['Состояния и варианты использования', 'core', 'Q105,Q103,Q102'],
    ['Практика тест-дизайна', 'practice', 'Q120-124'],
  ] },
  { id: 'web-api', title: '6. Веб и API', goal: 'Читать HTTP-обмен и проверять интерфейс и API инструментами.', outcome: 'Разбираете запрос, ответ, JSON и ошибку в DevTools или Postman.', topics: [
    ['HTTP, HTTPS и полный цикл запроса', 'core', 'M68-69,M104'],
    ['REST, JSON, адреса и структура сообщений', 'core', 'M74,M76-80,M83-87'],
    ['Статус-коды', 'core', 'M88-92'],
    ['HTTP-методы', 'core', 'M94-102'],
    ['Кэш, cookies и проверка API', 'core', 'M105-106,M108'],
    ['DevTools, HTML/CSS, Postman и Swagger', 'core', 'M109-112'],
    ['Проверки интерфейса и бэкенда', 'practice', 'M122,M126,M128-130'],
    ['Практика веба и API', 'practice', 'M113-114,M116-119,M152-154,M156-157,M159-160'],
    ['Дополнительные форматы и инструменты', 'advanced', 'M71-73,M75,M81,M164-166'],
  ] },
  { id: 'database', title: '7. Базы данных и SQL', goal: 'Проверять данные чтением, фильтрацией и соединением таблиц.', outcome: 'Пишете SELECT, GROUP BY и JOIN для проверки результата.', topics: [
    ['База данных и таблицы', 'core', 'M132-135'],
    ['SELECT, группировка и агрегация', 'core', 'M136-140'],
    ['JOIN и вложенные запросы', 'core', 'M143-144'],
    ['Практика SQL', 'practice', 'M141-142,M145,M151'],
    ['Изменение данных', 'advanced', 'M146-147'],
    ['Шпаргалка и рабочие инструменты', 'reference', 'M148,M150,M162-163'],
  ] },
  { id: 'end-to-end', title: '8. Сквозная практика', goal: 'Пройти путь от требования через проверку до дефекта.', outcome: 'Собираете цельный пример работы тестировщика и план дальнейшей практики.', topics: [
    ['Разбор готовых сценариев', 'reference', 'M53-54'],
    ['Выбрать и уточнить требование', 'practice', 'M125,M161'],
    ['Спроектировать и записать проверки', 'practice', 'Q98,Q125'],
    ['Проверить веб, API и данные', 'practice', 'M115,M155'],
    ['Описать найденный дефект', 'practice', 'M56,M158'],
  ] },
  { id: 'interview', title: '9. Собеседование', goal: 'Повторить ключевые темы и потренироваться объяснять решения на конкретных примерах.', outcome: 'Отвечаете на вопросы по требованиям, видам проверок, архитектуре, API, SQL и тест-дизайну.', topics: [
    ['Как проходит собеседование', 'reference', 'Q70'],
    ['Требования и тест-дизайн', 'reference', 'Q93,Q119'],
    ['Виды тестирования', 'reference', 'M49-52'],
    ['Клиент-серверная архитектура', 'reference', 'M66'],
    ['Веб, API и HTTP', 'reference', 'M70,M82,M93,M103,M107'],
    ['SQL', 'reference', 'M149'],
  ] },
];

const source = { M: 'manual-testing', Q: 'mqa-base' };
// The underlying pages remain unique; these explicitly identified recaps point
// readers to the primary explanation instead of silently repeating it.
const alternativeTo = {
  Q23: 'Q20', Q26: 'Q25', Q34: 'Q33', Q36: 'Q35', Q38: 'Q37',
  Q109: 'Q101', Q116: 'Q101', Q118: 'M20', M36: 'M33',
};
function expand(spec) {
  return spec.split(',').flatMap((part) => {
    const match = /^([MQ])(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) throw new Error(`Некорректный номер шага: ${part}`);
    const start = Number(match[2]);
    const end = Number(match[3] || match[2]);
    if (end < start) throw new Error(`Обратный диапазон: ${part}`);
    return Array.from({ length: end - start + 1 }, (_, i) => ({ courseSlug: source[match[1]], number: start + i }));
  });
}

export function buildCurriculum(courses) {
  const lookup = new Map(courses.flatMap((course) => course.pages.map((page) => [`${course.slug}:${page.number}`, { course, page }])));
  const seen = new Set();
  const records = [];
  const route = stages.map((stage, stageIndex) => ({ ...stage, number: stageIndex + 1, topics: stage.topics.map(([title, role, spec], topicIndex) => {
    const items = expand(spec).map(({ courseSlug, number }) => {
      const key = `${courseSlug}:${number}`;
      if (seen.has(key)) throw new Error(`Повтор в маршруте: ${key}`);
      const found = lookup.get(key);
      if (!found) throw new Error(`Нет исходного шага: ${key}`);
      seen.add(key);
      const sourceKey = `${courseSlug === 'mqa-base' ? 'Q' : 'M'}${number}`;
      const alternative = alternativeTo[sourceKey];
      const record = {
        source: { course: courseSlug, step: number, module: found.page.moduleName, chapter: found.page.chapterName },
        route: { stage: stage.id, stageTitle: stage.title, topic: title, stageOrder: stageIndex + 1, topicOrder: topicIndex + 1, lessonOrder: records.length + 1, role: alternative ? 'alternative' : role },
        title: found.page.safeTitle,
        taskType: found.page.taskType,
        url: `courses/${courseSlug}/${found.page.file}`,
        ...(alternative ? { alternativeTo: alternative } : {}),
      };
      records.push(record);
      return record;
    });
    const taskTypes = new Set(items.map((item) => item.taskType === 'lecture' ? 'lecture' : 'practice'));
    return { title, role, kind: taskTypes.size === 2 ? 'mixed' : [...taskTypes][0], items };
  }) }));
  const missing = [...lookup.keys()].filter((key) => !seen.has(key));
  if (missing.length) throw new Error(`Не распределены ${missing.length} шагов: ${missing.join(', ')}`);
  for (const record of records) {
    if (record.alternativeTo && !lookup.has(`${source[record.alternativeTo[0]]}:${Number(record.alternativeTo.slice(1))}`)) {
      throw new Error(`Не найден основной разбор: ${record.alternativeTo}`);
    }
  }
  return { stages: route, records };
}
