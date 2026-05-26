import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useStore } from '../stores/StoreProvider';
import './StockLink.css';

interface StockLinkProps {
  stockCode: string;
  stockName?: string;
}

const StockLink = observer(({ stockCode, stockName }: StockLinkProps) => {
  const { configStore } = useStore();

  // 首次挂载时加载配置
  useEffect(() => {
    if (!configStore.tonghuashunLinkPrefix && !configStore.loading) {
      configStore.fetch();
    }
  }, [configStore]);

  const prefix = configStore.tonghuashunLinkPrefix;

  // 没有配置链接前缀时，只显示纯文本
  if (!prefix) {
    return (
      <span className="stock-link stock-link--no-link" title={stockName ?? stockCode}>
        {stockCode}
      </span>
    );
  }

  const href = `${prefix}${stockCode}/`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <a
      className="stock-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      title={`在 ${prefix} 中查看 ${stockCode} ${stockName ?? ''}`}
    >
      {stockCode}
    </a>
  );
});

export default StockLink;
