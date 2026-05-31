import { Link } from 'react-router-dom';
import './StockHistoryLink.css';

interface StockHistoryLinkProps {
  stockCode?: string | null;
  stockName?: string | null;
  className?: string;
}

const StockHistoryLink = ({ stockCode, stockName, className = '' }: StockHistoryLinkProps) => {
  const code = stockCode?.trim() ?? '';
  const name = stockName?.trim() ?? '';
  const label = name || code || '-';

  if (!code) {
    return <span className={className}>{label}</span>;
  }

  const query = name ? `?name=${encodeURIComponent(name)}` : '';

  return (
    <Link
      to={`/stocks/${encodeURIComponent(code)}/history${query}`}
      className={`stock-history-link ${className}`.trim()}
      title={`查看 ${label} 的历史流水`}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  );
};

export default StockHistoryLink;
