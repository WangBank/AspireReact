import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reflectionService } from '../services/ReflectionService';
import { useStore } from '../stores/StoreProvider';
import './ReflectionPage.css';

type ReflectionSectionId = 'tuiXue' | 'me' | 'xiaoming';

interface ReflectionSectionConfig {
  id: ReflectionSectionId;
  label: string;
  description: string;
}

interface ReflectionGroup {
  date: string | null;
  sentences: string[];
}

const DATE_LINE_PATTERN = /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?$/;
const SENTENCE_PATTERN = /[^。！？；!?;]+[。！？；!?;]?/g;

const SECTIONS: ReflectionSectionConfig[] = [
  {
    id: 'tuiXue',
    label: '退学炒股',
    description: '完整原文按日期与句子整理，方便一口气回看整段脉络。',
  },
  {
    id: 'me',
    label: '我',
    description: '过滤掉“小明”相关内容后，单独盯住更适合自我提醒的句子。',
  },
  {
    id: 'xiaoming',
    label: '小明',
    description: '把包含“小明”的句子拆出来，专门盯住最容易诱发心魔的对话。',
  },
];

const DAILY_PROMPTS = [
  '今天出手的理由，是否还能经得起明天复盘？',
  '今天最明显的偏离，到底是冲动、侥幸，还是执行不到位？',
  '如果只保留一句纪律带到明天，我最该留下哪一句？',
];

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

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未记录';

const ReflectionPage = observer(() => {
  const navigate = useNavigate();
  const { authStore } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [content, setContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedByUsername, setUpdatedByUsername] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await reflectionService.getContent();
        if (!active) {
          return;
        }

        setContent(data.content || '');
        setUpdatedAt(data.updatedAt);
        setUpdatedByUsername(data.updatedByUsername);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : '加载吾日三省吾身内容失败');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo(() => parseReflectionText(content), [content]);
  const normalizedQuery = query.trim().toLowerCase();

  const sectionNotes = useMemo<Record<ReflectionSectionId, string>>(
    () => ({
      tuiXue: buildSectionText(groups, () => true),
      me: buildSectionText(groups, (sentence) => !sentence.includes('小明')),
      xiaoming: buildSectionText(groups, (sentence) => sentence.includes('小明')),
    }),
    [groups]
  );

  return (
    <div className="reflection-container">
      <header className="reflection-header">
        <div>
          <h1 className="reflection-title">吾日三省吾身</h1>
          <p className="reflection-subtitle">内容由管理员统一维护，普通用户只读回看，专注把情绪化交易拦在出手前。</p>
        </div>
        <div className="reflection-header__actions">
          <div className="reflection-save-meta">
            <span className="reflection-save-meta__label">最近维护</span>
            <span className="reflection-save-meta__value">{formatDateTime(updatedAt)}</span>
            <span className="reflection-save-meta__hint">
              {updatedByUsername ? `维护人 ${updatedByUsername}` : '当前还没有记录维护人'}
            </span>
          </div>
          {authStore.isAdmin && (
            <button
              className="reflection-btn reflection-btn--secondary"
              onClick={() => navigate('/admin?tab=reflection')}
              type="button"
            >
              去管理员后台维护
            </button>
          )}
        </div>
      </header>

      <section className="reflection-banner">
        <p className="reflection-banner__title">只读回看模式</p>
        <p className="reflection-banner__text">
          这里展示的是管理员维护后的完整原文，页面会自动按日期分组、按句拆分，并保留搜索能力，方便长期复盘。
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

      {loading ? (
        <div className="reflection-loading">正在加载内容...</div>
      ) : error ? (
        <div className="reflection-error">
          <span>{error}</span>
          <button
            className="reflection-btn reflection-btn--secondary"
            onClick={() => window.location.reload()}
            type="button"
          >
            重试
          </button>
        </div>
      ) : (
        <section className="reflection-grid">
          {SECTIONS.map((section) => {
            const previewGroups = parseReflectionText(sectionNotes[section.id]);
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
                    <span>{previewGroups.length} 组</span>
                  </div>
                </div>

                <div className="reflection-card__preview reflection-card__preview--read-only">
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
                      {totalSentenceCount === 0 ? '当前还没有维护内容。' : '没有匹配当前关键词的句子。'}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
});

export default ReflectionPage;
