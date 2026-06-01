import { useEffect, useState } from 'react';
import './TradeTags.css';

interface SingleChoiceEditorProps {
  value: string;
  onChange: (next: string) => void;
  options: readonly string[];
  placeholder?: string;
  hint?: string;
  emptyText?: string;
}

const SingleChoiceEditor = ({
  value,
  onChange,
  options,
  placeholder = '可输入自定义内容',
  hint = '',
  emptyText = '暂未选择',
}: SingleChoiceEditorProps) => {
  const [draft, setDraft] = useState('');
  const isPresetValue = value !== '' && options.includes(value);

  useEffect(() => {
    setDraft(isPresetValue ? '' : value);
  }, [isPresetValue, value]);

  const applyDraft = () => {
    onChange(draft.trim());
  };

  const toggleOption = (option: string) => {
    onChange(value === option ? '' : option);
  };

  return (
    <div className="choice-editor">
      <div className="trade-tags__options">
        {options.map(option => (
          <button
            key={option}
            type="button"
            className={`trade-tags__option ${value === option ? 'trade-tags__option--active' : ''}`}
            onClick={() => toggleOption(option)}
          >
            {option}
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
          onBlur={applyDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              applyDraft();
            }
          }}
          maxLength={50}
        />
        <button type="button" className="trade-tags__action-btn" onClick={applyDraft}>
          设置
        </button>
        {value && (
          <button type="button" className="trade-tags__action-btn trade-tags__action-btn--secondary" onClick={() => onChange('')}>
            清空
          </button>
        )}
      </div>

      <div className="trade-tags__selected">
        {value ? (
          <span className="trade-tags__pill">{value}</span>
        ) : (
          <span className="trade-tags__empty">{emptyText}</span>
        )}
      </div>

      {hint && <p className="trade-tags__hint">{hint}</p>}
    </div>
  );
};

export default SingleChoiceEditor;
