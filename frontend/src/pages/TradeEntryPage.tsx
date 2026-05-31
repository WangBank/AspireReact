import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import StockSearchInput from '../components/StockSearchInput';
import StockHistoryLink from '../components/StockHistoryLink';
import TradeTagsEditor from '../components/TradeTagsEditor';
import { formatLocalDate } from '../utils/date';
import './AccountEntryPage.css';

const TradeEntryPage = observer(() => {
  const { tradeEntryStore } = useStore();

  const today = formatLocalDate();
  const [tradeDate, setTradeDate] = useState(today);
  const [stockCode, setStockCode] = useState('');
  const [stockName, setStockName] = useState('');
  const [board, setBoard] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyQuantity, setBuyQuantity] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellQuantity, setSellQuantity] = useState('');
  const [positionPnL, setPositionPnL] = useState('0');
  const [cumulativePnL, setCumulativePnL] = useState('0');
  const [tradeTags, setTradeTags] = useState<string[]>([]);
  const [tradeNote, setTradeNote] = useState('');
  const [tonghuashunLink, setTonghuashunLink] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!tradeDate) newErrors.tradeDate = '请选择交易日期';
    if (!stockCode) newErrors.stockCode = '请搜索并选择心魔';
    if (!board) newErrors.board = '请先选择心魔以自动填充板块';

    const bp = Number(buyPrice) || 0;
    const bq = Number(buyQuantity) || 0;
    const sp = Number(sellPrice) || 0;
    const sq = Number(sellQuantity) || 0;

    const hasBuy = bp > 0 && bq > 0;
    const hasSell = sp > 0 && sq > 0;

    if (!hasBuy && !hasSell) {
      newErrors.trade = '买入或卖出至少填写一方（价格>0 且 数量>0）';
    }
    if ((bp > 0 && bq === 0) || (bp === 0 && bq > 0)) {
      newErrors.buy = '买入价格和数量必须同时填写或同时为空';
    }
    if ((sp > 0 && sq === 0) || (sp === 0 && sq > 0)) {
      newErrors.sell = '卖出价格和数量必须同时填写或同时为空';
    }
    if (hasBuy && hasSell && bq !== sq) {
      newErrors.quantity = '同时存在买入和卖出时，数量应保持一致';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStockSelect = (code: string, name: string, selectedBoard: string) => {
    setStockCode(code);
    setStockName(name);
    setBoard(selectedBoard);
    setErrors((p) => ({ ...p, stockCode: '', board: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    tradeEntryStore.clearMessages();
    await tradeEntryStore.submit({
      tradeDate,
      stockCode,
      stockName,
      board,
      buyPrice: Number(buyPrice) || 0,
      buyQuantity: Number(buyQuantity) || 0,
      sellPrice: Number(sellPrice) || 0,
      sellQuantity: Number(sellQuantity) || 0,
      positionPnL: Number(positionPnL) || 0,
      cumulativePnL: Number(cumulativePnL) || 0,
      costPrice: 0,
      currentPrice: 0,
      positionQuantity: 0,
      dailyPnL: 0,
      isLiquidated: false,
      tradeTags: tradeTags.length > 0 ? tradeTags : undefined,
      tradeNote: tradeNote.trim() || undefined,
      tonghuashunLink: tonghuashunLink.trim() || undefined,
    });
    if (!tradeEntryStore.error) {
      setTradeDate(today);
      setStockCode('');
      setStockName('');
      setBoard('');
      setBuyPrice('');
      setBuyQuantity('');
      setSellPrice('');
      setSellQuantity('');
      setPositionPnL('0');
      setCumulativePnL('0');
      setTradeTags([]);
      setTradeNote('');
      setTonghuashunLink('');
      setErrors({});
    }
  };

  return (
    <div className="entry-page-container">
      <h1 className="entry-page-title">心魔交易录入</h1>
      <p className="entry-page-subtitle">录入心魔买卖交易记录</p>

      <form className="entry-form" onSubmit={handleSubmit} noValidate>
        {tradeEntryStore.error && (
          <div className="entry-error-banner" role="alert">
            {tradeEntryStore.error}
          </div>
        )}
        {tradeEntryStore.successMessage && (
          <div className="entry-success-banner" role="status">
            {tradeEntryStore.successMessage}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="t-date" className="form-label">交易日期 <span className="required-star">*</span></label>
          <input
            id="t-date"
            type="date"
            className={`form-input ${errors.tradeDate ? 'form-input-error' : ''}`}
            value={tradeDate}
            onChange={(e) => { setTradeDate(e.target.value); setErrors((p) => ({ ...p, tradeDate: '' })); }}
          />
          {errors.tradeDate && <span className="form-error">{errors.tradeDate}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">心魔搜索 <span className="required-star">*</span></label>
          <StockSearchInput
            value={stockCode ? `${stockCode} - ${stockName}` : ''}
            onChange={handleStockSelect}
            placeholder="输入心魔代码/名称/简称搜索"
          />
          {errors.stockCode && <span className="form-error">{errors.stockCode}</span>}
        </div>

        {stockCode && (
          <div className="selected-stock-info">
            <span className="selected-stock-code">{stockCode}</span>
            <StockHistoryLink
              stockCode={stockCode}
              stockName={stockName}
              className="selected-stock-name"
            />
            <span className="selected-stock-board">{board}</span>
          </div>
        )}

        {errors.trade && <div className="entry-error-banner">{errors.trade}</div>}

        <fieldset className="form-fieldset">
          <legend className="fieldset-legend">买入信息</legend>
          <div className="form-row">
            <div className="form-group form-group-half">
              <label htmlFor="t-buy-price" className="form-label">买入价格（元）</label>
              <input
                id="t-buy-price"
                type="number"
                step="0.01"
                min="0"
                className={`form-input ${errors.buy ? 'form-input-error' : ''}`}
                placeholder="0.00"
                value={buyPrice}
                onChange={(e) => { setBuyPrice(e.target.value); setErrors((p) => ({ ...p, buy: '', trade: '' })); }}
              />
            </div>
            <div className="form-group form-group-half">
              <label htmlFor="t-buy-qty" className="form-label">买入数量（股）</label>
              <input
                id="t-buy-qty"
                type="number"
                step="100"
                min="0"
                className={`form-input ${errors.buy ? 'form-input-error' : ''}`}
                placeholder="0"
                value={buyQuantity}
                onChange={(e) => { setBuyQuantity(e.target.value); setErrors((p) => ({ ...p, buy: '', trade: '' })); }}
              />
            </div>
          </div>
          {errors.buy && <span className="form-error">{errors.buy}</span>}
        </fieldset>

        <fieldset className="form-fieldset">
          <legend className="fieldset-legend">卖出信息</legend>
          <div className="form-row">
            <div className="form-group form-group-half">
              <label htmlFor="t-sell-price" className="form-label">卖出价格（元）</label>
              <input
                id="t-sell-price"
                type="number"
                step="0.01"
                min="0"
                className={`form-input ${errors.sell ? 'form-input-error' : ''}`}
                placeholder="0.00"
                value={sellPrice}
                onChange={(e) => { setSellPrice(e.target.value); setErrors((p) => ({ ...p, sell: '', trade: '' })); }}
              />
            </div>
            <div className="form-group form-group-half">
              <label htmlFor="t-sell-qty" className="form-label">卖出数量（股）</label>
              <input
                id="t-sell-qty"
                type="number"
                step="100"
                min="0"
                className={`form-input ${errors.sell ? 'form-input-error' : ''}`}
                placeholder="0"
                value={sellQuantity}
                onChange={(e) => { setSellQuantity(e.target.value); setErrors((p) => ({ ...p, sell: '', trade: '' })); }}
              />
            </div>
          </div>
          {errors.sell && <span className="form-error">{errors.sell}</span>}
        </fieldset>

        {errors.quantity && <span className="form-error">{errors.quantity}</span>}

        <div className="form-row">
          <div className="form-group form-group-half">
            <label htmlFor="t-pos-pnl" className="form-label">持仓盈亏（元）</label>
            <input
              id="t-pos-pnl"
              type="number"
              step="0.01"
              className="form-input"
              placeholder="0.00"
              value={positionPnL}
              onChange={(e) => setPositionPnL(e.target.value)}
            />
          </div>
          <div className="form-group form-group-half">
            <label htmlFor="t-cum-pnl" className="form-label">累计盈亏（元）</label>
            <input
              id="t-cum-pnl"
              type="number"
              step="0.01"
              className="form-input"
              placeholder="0.00"
              value={cumulativePnL}
              onChange={(e) => setCumulativePnL(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">交易标签</label>
          <TradeTagsEditor value={tradeTags} onChange={setTradeTags} />
        </div>

        <div className="form-group">
          <label htmlFor="t-note" className="form-label">交易笔记</label>
          <textarea
            id="t-note"
            className="form-textarea"
            placeholder="可选，最多2000字"
            value={tradeNote}
            onChange={(e) => setTradeNote(e.target.value.slice(0, 2000))}
            rows={3}
            maxLength={2000}
          />
        </div>

        <div className="form-group">
          <label htmlFor="t-link" className="form-label">同花顺链接</label>
          <input
            id="t-link"
            type="text"
            className="form-input"
            placeholder="可选，同花顺相关链接（最多500字）"
            value={tonghuashunLink}
            onChange={(e) => setTonghuashunLink(e.target.value.slice(0, 500))}
            maxLength={500}
          />
        </div>

        <button
          type="submit"
          className="entry-submit-btn"
          disabled={tradeEntryStore.loading}
        >
          {tradeEntryStore.loading ? '提交中...' : '提交录入'}
        </button>
      </form>
    </div>
  );
});

export default TradeEntryPage;
