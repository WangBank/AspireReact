import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import './ConfigPage.css';

const ConfigPage = observer(() => {
  const { configStore } = useStore();
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    configStore.fetch();
  }, [configStore]);

  // 当后端配置加载完成后，同步到输入框
  useEffect(() => {
    if (configStore.tonghuashunLinkPrefix) {
      setInputValue(configStore.tonghuashunLinkPrefix);
    }
  }, [configStore.tonghuashunLinkPrefix]);

  const handleSave = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    await configStore.updatePrefix(trimmed);
  };

  const handleClear = () => {
    setInputValue('');
  };

  const previewUrl = inputValue.trim()
    ? `${inputValue.trim()}${inputValue.trim().endsWith('/') ? '' : '/'}000001/`
    : null;

  return (
    <div className="config-container">
      <header className="config-header">
        <div>
          <h1 className="config-title">系统配置</h1>
          <p className="config-subtitle">管理同花顺心魔详情页链接前缀</p>
        </div>
      </header>

      <main className="config-main">
        {configStore.loading && !configStore.tonghuashunLinkPrefix && (
          <div className="config-status">
            <div className="config-spinner" />
            <span>加载中...</span>
          </div>
        )}

        {configStore.error && (
          <div className="config-error">
            <span>{configStore.error}</span>
            <button onClick={() => { configStore.clearError(); configStore.fetch(); }} type="button">
              重试
            </button>
          </div>
        )}

        {configStore.saveSuccess && (
          <div className="config-success">
            <span>✅ 配置保存成功！</span>
            <button
              onClick={() => configStore.clearSaveSuccess()}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                color: '#166534',
                cursor: 'pointer',
                fontWeight: 600,
                fontFamily: 'inherit',
                fontSize: '0.8rem',
              }}
              type="button"
            >
              关闭
            </button>
          </div>
        )}

        <div className="config-card">
          <p className="config-card-title">同花顺链接前缀</p>

          <div className="config-field">
            <label>链接前缀 URL</label>
            <div className="config-field-input">
              <input
                type="text"
                placeholder="如 https://www.10jqka.com.cn/"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={configStore.loading}
                autoComplete="off"
              />
              <button
                className="config-save-btn"
                onClick={handleSave}
                disabled={configStore.loading || !inputValue.trim()}
                type="button"
              >
                {configStore.loading ? '保存中...' : '保存配置'}
              </button>
              <button
                className="config-save-btn"
                style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db' }}
                onClick={handleClear}
                disabled={configStore.loading}
                type="button"
              >
                清空
              </button>
            </div>
            <p className="config-hint">
              配置后，在交易列表和统计汇总页面点击心魔代码即可跳转至同花顺心魔详情页。
              常见值：https://www.10jqka.com.cn/ 或 https://stockpage.10jqka.com.cn/
            </p>
          </div>

          {previewUrl && (
            <div className="config-preview">
              <p className="config-preview-label">链接预览（以 000001 为例）</p>
              <a
                className="config-preview-link"
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {previewUrl}
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
});

export default ConfigPage;
