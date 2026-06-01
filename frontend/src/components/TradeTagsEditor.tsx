import { useState } from 'react';
import { TRADE_TAG_OPTIONS, normalizeTradeTags } from '../constants/tradeTags';
import './TradeTags.css';

interface TradeTagsEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  options?: readonly string[];
  placeholder?: string;
  hint?: string;
  emptyText?: string;
}

const splitCustomTags = (value: string) =>
  value
    .split(/[,\n，]+/)
    .map(item => item.trim())
    .filter(Boolean);

const TradeTagsEditor = ({
  value,
  onChange,
  options = TRADE_TAG_OPTIONS,
  placeholder = '自定义标签，按回车或输入逗号添加',
  hint = '建议用标签标记模式、心态和交易动作，后面就能按标签统计胜率与盈亏。',
  emptyText = '暂未添加标签',
}: TradeTagsEditorProps) => {
  const [draft, setDraft] = useState('');

  const selected = normalizeTradeTags(value);

  const toggleTag = (tag: string) => {
    const next = selected.includes(tag)
      ? selected.filter(item => item !== tag)
      : [...selected, tag];
    onChange(normalizeTradeTags(next));
  };

  const removeTag = (tag: string) => {
    onChange(selected.filter(item => item !== tag));
  };

  const appendDraftTags = () => {
    const nextDraftTags = splitCustomTags(draft);
    if (nextDraftTags.length === 0) {
      return;
    }

    onChange(normalizeTradeTags([...selected, ...nextDraftTags]));
    setDraft('');
  };

  return (
    <div className="trade-tags">
      <div className="trade-tags__options">
        {options.map(tag => (
          <button
            key={tag}
            type="button"
            className={`trade-tags__option ${selected.includes(tag) ? 'trade-tags__option--active' : ''}`}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="trade-tags__input-row">
        <input
          type="text"
          className="form-input trade-tags__input"
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={appendDraftTags}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
              event.preventDefault();
              appendDraftTags();
            }
          }}
          maxLength={200}
        />
        <button type="button" className="trade-tags__action-btn" onClick={appendDraftTags}>
          添加
        </button>
      </div>

      {selected.length > 0 ? (
        <div className="trade-tags__selected">
          {selected.map(tag => (
            <span key={tag} className="trade-tags__pill">
              {tag}
              <button
                type="button"
                className="trade-tags__remove"
                aria-label={`移除标签 ${tag}`}
                onClick={() => removeTag(tag)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <span className="trade-tags__empty">{emptyText}</span>
      )}

      <p className="trade-tags__hint">{hint}</p>
    </div>
  );
};

export default TradeTagsEditor;
