import { useEffect, useState } from 'react';
import reflectionSourceRaw from '../data/reflection-source.txt?raw';
import './ReflectionPage.css';

type ReflectionSectionId = 'tuiXue' | 'me' | 'xiaoming';

interface ReflectionSectionConfig {
  id: ReflectionSectionId;
  label: string;
  description: string;
  placeholder: string;
}

interface ReflectionGroup {
  date: string | null;
  sentences: string[];
}

interface ReflectionStoredState {
  notes: Record<ReflectionSectionId, string>;
  savedAt: string;
}

const STORAGE_KEY = 'aspire-reflection-notes-v2';
const LEGACY_STORAGE_KEY = 'aspire-reflection-notes-v1';
const DATE_LINE_PATTERN = /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?$/;
const SENTENCE_PATTERN = /[^。！？；!?;]+[。！？；!?;]?/g;

const SECTIONS: ReflectionSectionConfig[] = [
  {
    id: 'tuiXue',
    label: '退学炒股',
    description: '完整原文已经预置，按日期和句子整理，方便长期回看。',
    placeholder: '支持继续手动补充或删改，每个日期下建议一行一句。',
  },
  {
    id: 'me',
    label: '我',
    description: '自动摘出偏向自我提醒和复盘的句子，方便单独聚焦自己。',
    placeholder: '可以补充你自己的纪律、复盘结论和当天最该提醒自己的话。',
  },
  {
    id: 'xiaoming',
    label: '小明',
    description: '自动摘出包含“小明”的句子，单独盯住最容易诱发偏差的提醒。',
    placeholder: '可以继续把你和“小明”的关键对话与提醒补进来。',
  },
];

const DAILY_PROMPTS = [
  '今天出手的理由，是否仍然站得住？',
  '今天最大的偏离，是冲动、侥幸，还是执行不到位？',
  '如果明天只保留一条纪律，我最该留下哪一句？',
];

const createEmptyNotes = (): Record<ReflectionSectionId, string> => ({
  tuiXue: '',
  me: '',
  xiaoming: '',
});

const cloneNotes = (notes: Record<ReflectionSectionId, string>): Record<ReflectionSectionId, string> => ({
  tuiXue: notes.tuiXue,
  me: notes.me,
  xiaoming: notes.xiaoming,
});

const isBlankNotes = (notes: Record<ReflectionSectionId, string>) =>
  Object.values(notes).every((value) => value.trim().length === 0);

const splitIntoSentences = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const matched = normalized.match(SENTENCE_PATTERN);
  if (!matched) {
    return [normalized];
  }

  return matched
    .map((sentence) => sentence.trim())
    .filter(Boolean);
};

const parseReflectionText = (source: string): ReflectionGroup[] => {
  const groups: ReflectionGroup[] = [];
  let currentGroup: ReflectionGroup | null = null;

  source.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (DATE_LINE_PATTERN.test(line)) {
      currentGroup = {
        date: line,
        sentences: [],
      };
      groups.push(currentGroup);
      return;
    }

    if (!currentGroup) {
      currentGroup = {
        date: null,
        sentences: [],
      };
      groups.push(currentGroup);
    }

    currentGroup.sentences.push(...splitIntoSentences(line));
  });

  return groups.filter((group) => group.sentences.length > 0);
};

const buildSectionText = (
  groups: ReflectionGroup[],
  predicate: (sentence: string) => boolean
) =>
  groups
    .map((group) => {
      const sentences = group.sentences.filter(predicate);
      if (sentences.length === 0) {
        return '';
      }

      return group.date ? `${group.date}\n${sentences.join('\n')}` : sentences.join('\n');
    })
    .filter(Boolean)
    .join('\n\n');

const PRESET_GROUPS = parseReflectionText(reflectionSourceRaw);
const PRESET_NOTES: Record<ReflectionSectionId, string> = {
  tuiXue: buildSectionText(PRESET_GROUPS, () => true),
  me: buildSectionText(PRESET_GROUPS, (sentence) => !sentence.includes('小明')),
  xiaoming: buildSectionText(PRESET_GROUPS, (sentence) => sentence.includes('小明')),
};

const readStoredState = (): ReflectionStoredState => {
  if (typeof window === 'undefined') {
    return {
      notes: cloneNotes(PRESET_NOTES),
      savedAt: '',
    };
  }

  const currentRaw = window.localStorage.getItem(STORAGE_KEY);
  if (currentRaw) {
    try {
      const parsed = JSON.parse(currentRaw) as {
        notes?: Partial<Record<ReflectionSectionId, string>>;
        savedAt?: string;
      };

      return {
        notes: {
          tuiXue: parsed.notes?.tuiXue ?? '',
          me: parsed.notes?.me ?? '',
          xiaoming: parsed.notes?.xiaoming ?? '',
        },
        savedAt: parsed.savedAt ?? '',
      };
    } catch {
      return {
        notes: cloneNotes(PRESET_NOTES),
        savedAt: '',
      };
    }
  }

  const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) {
    return {
      notes: cloneNotes(PRESET_NOTES),
      savedAt: '',
    };
  }

  try {
    const parsed = JSON.parse(legacyRaw) as {
      notes?: Partial<Record<ReflectionSectionId, string>>;
      savedAt?: string;
    };
    const loadedNotes = {
      tuiXue: parsed.notes?.tuiXue ?? '',
      me: parsed.notes?.me ?? '',
      xiaoming: parsed.notes?.xiaoming ?? '',
    };

    return {
      notes: isBlankNotes(loadedNotes) ? cloneNotes(PRESET_NOTES) : loadedNotes,
      savedAt: parsed.savedAt ?? '',
    };
  } catch {
    return {
      notes: cloneNotes(PRESET_NOTES),
      savedAt: '',
    };
  }
};

const ReflectionPage = () => {
  const [storedState, setStoredState] = useState<ReflectionStoredState>(() => readStoredState());
  const [query, setQuery] = useState('');

  const notes = storedState.notes;
  const savedAt = storedState.savedAt;
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    const nextSavedAt = new Date().toLocaleString('zh-CN', { hour12: false });
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        notes,
        savedAt: nextSavedAt,
      })
    );
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);

    setStoredState((current) => ({
      ...current,
      savedAt: nextSavedAt,
    }));
  }, [notes]);

  const replaceNotes = (nextNotes: Record<ReflectionSectionId, string>) => {
    setStoredState((current) => ({
      ...current,
      notes: cloneNotes(nextNotes),
    }));
  };

  const updateSection = (id: ReflectionSectionId, value: string) => {
    setStoredState((current) => ({
      ...current,
      notes: {
        ...current.notes,
        [id]: value,
      },
    }));
  };

  const clearSection = (id: ReflectionSectionId) => {
    updateSection(id, '');
  };

  const restorePreset = () => {
    replaceNotes(PRESET_NOTES);
    setQuery('');
  };

  const clearAll = () => {
    replaceNotes(createEmptyNotes());
    setQuery('');
  };

  return (
    <div className="reflection-container">
      <header className="reflection-header">
        <div>
          <h1 className="reflection-title">吾日三省吾身</h1>
          <p className="reflection-subtitle">完整原文已内置，按日期和句子回看，尽量把情绪化交易扼杀在出手前。</p>
        </div>
        <div className="reflection-header__actions">
          <div className="reflection-save-meta">
            <span className="reflection-save-meta__label">本地最近保存</span>
            <span className="reflection-save-meta__value">{savedAt || '已载入预置原文'}</span>
          </div>
          <button className="reflection-btn reflection-btn--secondary" onClick={restorePreset} type="button">
            恢复预置原文
          </button>
          <button className="reflection-btn reflection-btn--secondary" onClick={clearAll} type="button">
            清空当前编辑
          </button>
        </div>
      </header>

      <section className="reflection-banner">
        <p className="reflection-banner__title">已预置完整原文</p>
        <p className="reflection-banner__text">
          这里已经内置了完整文章，并按日期保留、按句拆开。你可以直接搜索、删改、补充，也可以随时一键恢复到预置版本。
        </p>
      </section>

      <section className="reflection-prompts">
        {DAILY_PROMPTS.map((prompt, index) => (
          <article className="reflection-prompt-card" key={prompt}>
            <span className="reflection-prompt-card__index">0{index + 1}</span>
            <p className="reflection-prompt-card__text">{prompt}</p>
          </article>
        ))}
      </section>

      <section className="reflection-toolbar">
        <label className="reflection-search">
          <span className="reflection-search__label">搜索句子</span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入关键词，按句过滤"
          />
        </label>
      </section>

      <section className="reflection-grid">
        {SECTIONS.map((section) => {
          const previewGroups = parseReflectionText(notes[section.id]);
          const totalSentenceCount = previewGroups.reduce((sum, group) => sum + group.sentences.length, 0);
          const visibleGroups = previewGroups
            .map((group) => ({
              ...group,
              sentences: normalizedQuery
                ? group.sentences.filter((sentence) => sentence.toLowerCase().includes(normalizedQuery))
                : group.sentences,
            }))
            .filter((group) => group.sentences.length > 0);
          const visibleSentenceCount = visibleGroups.reduce((sum, group) => sum + group.sentences.length, 0);

          let visibleIndex = 0;

          return (
            <article className="reflection-card" key={section.id}>
              <div className="reflection-card__header">
                <div>
                  <h2 className="reflection-card__title">{section.label}</h2>
                  <p className="reflection-card__description">{section.description}</p>
                </div>
                <div className="reflection-card__meta">
                  <span>{totalSentenceCount} 句</span>
                  <button
                    className="reflection-btn reflection-btn--ghost"
                    onClick={() => clearSection(section.id)}
                    type="button"
                  >
                    清空
                  </button>
                </div>
              </div>

              <textarea
                className="reflection-card__textarea"
                value={notes[section.id]}
                onChange={(event) => updateSection(section.id, event.target.value)}
                placeholder={section.placeholder}
                rows={12}
              />

              <div className="reflection-card__preview">
                <div className="reflection-card__preview-header">
                  <span>按句预览</span>
                  <span>
                    {visibleSentenceCount} / {totalSentenceCount}
                  </span>
                </div>
                {visibleGroups.length > 0 ? (
                  <div className="reflection-card__line-list">
                    {visibleGroups.map((group, groupIndex) => (
                      <div className="reflection-card__group" key={`${section.id}-${groupIndex}-${group.date ?? 'default'}`}>
                        {group.date ? <div className="reflection-card__date">{group.date}</div> : null}
                        {group.sentences.map((sentence) => {
                          visibleIndex += 1;

                          return (
                            <div className="reflection-card__line" key={`${section.id}-${groupIndex}-${visibleIndex}-${sentence}`}>
                              <span className="reflection-card__line-index">{String(visibleIndex).padStart(2, '0')}</span>
                              <span className="reflection-card__line-text">{sentence}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="reflection-card__empty">
                    {totalSentenceCount === 0 ? '还没有整理内容。' : '没有匹配当前关键词的句子。'}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
};

export default ReflectionPage;
