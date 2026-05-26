import { useState, useRef, useEffect, useCallback } from 'react';
import { stockService } from '../../services/StockService';
import type { StockSearchResult } from '../../services/StockService';
import './StockSearchInput.css';

interface StockSearchInputProps {
  value: string;
  onChange: (stockCode: string, stockName: string, board: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const StockSearchInput = ({
  value,
  onChange,
  placeholder = '输入股票代码/名称/简称搜索',
  disabled = false,
}: StockSearchInputProps) => {
  const [keyword, setKeyword] = useState(value);
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noResult, setNoResult] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const doSearch = useCallback(async (kw: string) => {
    if (!kw.trim() || kw.trim().length < 1) {
      setResults([]);
      setShowDropdown(false);
      setNoResult(false);
      return;
    }
    setLoading(true);
    setNoResult(false);
    try {
      const res = await stockService.search(kw.trim());
      const data = res.data || [];
      setResults(data);
      setShowDropdown(true);
      setNoResult(data.length === 0);
    } catch {
      setResults([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setKeyword(val);
    // 清除之前的定时器
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(val);
    }, 300);
  };

  const handleSelect = (stock: StockSearchResult) => {
    setKeyword(`${stock.StockCode} - ${stock.StockName}`);
    setShowDropdown(false);
    setResults([]);
    onChange(stock.StockCode, stock.StockName, stock.Board);
  };

  const handleBlur = () => {
    // 延迟关闭，等待点击选项
    setTimeout(() => setShowDropdown(false), 200);
  };

  return (
    <div className="stock-search-wrapper" ref={wrapperRef}>
      <input
        type="text"
        className="form-input stock-search-input"
        placeholder={placeholder}
        value={keyword}
        onChange={handleInputChange}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        onBlur={handleBlur}
        disabled={disabled}
        autoComplete="off"
      />
      {loading && <div className="stock-search-loading">搜索中...</div>}
      {showDropdown && !loading && results.length > 0 && (
        <ul className="stock-search-dropdown">
          {results.map((stock) => (
            <li
              key={stock.StockCode}
              className="stock-search-item"
              onMouseDown={() => handleSelect(stock)}
            >
              <span className="stock-code">{stock.StockCode}</span>
              <span className="stock-name">{stock.StockName}</span>
              {stock.StockAbbr && (
                <span className="stock-abbr">({stock.StockAbbr})</span>
              )}
              <span className="stock-board">{stock.Board}</span>
            </li>
          ))}
        </ul>
      )}
      {showDropdown && !loading && noResult && (
        <div className="stock-search-empty">未找到相关股票，请尝试其他关键词</div>
      )}
    </div>
  );
};

export default StockSearchInput;
