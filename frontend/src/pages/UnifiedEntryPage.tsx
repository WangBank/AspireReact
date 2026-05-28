import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { runInAction } from 'mobx';
import { useStore } from '../stores/StoreProvider';
import { tradeService } from '../services/TradeService';
import StockSearchInput from '../components/StockSearchInput';
import './UnifiedEntryPage.css';

interface TradeRow {
  id: number;
  stockCode: string;
  stockName: string;
  board: string;
  positionValue: string;
  positionQuantity: string;
  costPrice: string;
  currentPrice: string;
  dailyPnL: string;
}

let nextRowId = 1;

const emptyTradeRow = (): TradeRow => ({
  id: nextRowId++,
  stockCode: '',
  stockName: '',
  board: '',
  positionValue: '',
  positionQuantity: '',
  costPrice: '',
  currentPrice: '',
  dailyPnL: '',
});

const UnifiedEntryPage = observer(() => {
  const { unifiedEntryStore } = useStore();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const isEditMode = Boolean(id);
  const editingId = id ? parseInt(id, 10) : 0;

  const today = new Date().toISOString().split('T')[0];

  // 账户资金
  const [acDate, setAcDate] = useState(today);
  const [acTotalAssets, setAcTotalAssets] = useState('');
  const [acPositionValue, setAcPositionValue] = useState('');
  const [acAvailable, setAcAvailable] = useState('');
  const [acDailyPnL, setAcDailyPnL] = useState('');
  const [acRemark, setAcRemark] = useState('');

  // 银证流水
  const [bfDate, setBfDate] = useState(today);
  const [bfFlowType, setBfFlowType] = useState<'转入' | '转出'>('转入');
  const [bfAmount, setBfAmount] = useState('');
  const [bfRemark, setBfRemark] = useState('');

  // 交易持仓（多行）
  const [tradeDate, setTradeDate] = useState(today);
  const [tradeRows, setTradeRows] = useState<TradeRow[]>([emptyTradeRow()]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<'account' | 'flow' | 'trade' | null>(null);

  // ── 编辑模式：加载已有数据 ──
  useEffect(() => {
    if (!isEditMode || !editingId) return;
    (async () => {
      const res = await tradeService.getById(editingId);
      if (res.success && res.data) {
        const d = res.data;
        setTradeDate(d.tradeDate?.split('T')[0] || today);
        setTradeRows([{
          id: nextRowId++,
          stockCode: d.stockCode || '',
          stockName: d.stockName || '',
          board: d.board || '',
          positionValue: d.positionPnL != null ? String(d.positionPnL) : '',
          positionQuantity: '',
          costPrice: d.costPrice != null ? String(d.costPrice) : '',
          currentPrice: d.currentPrice != null ? String(d.currentPrice) : '',
          dailyPnL: d.cumulativePnL != null ? String(d.cumulativePnL) : '',
        }]);
      }
    })();
  }, [isEditMode, editingId]);

  // ── 账户资金验证 ──
  const validateAccount = (): boolean => {
    const e: Record<string, string> = {};
    if (!acDate) e.acDate = '请选择日期';
    if (acTotalAssets === '' || isNaN(Number(acTotalAssets)) || Number(acTotalAssets) < 0)
      e.acTotalAssets = '请输入有效的正数';
    if (acPositionValue === '' || isNaN(Number(acPositionValue)) || Number(acPositionValue) < 0)
      e.acPositionValue = '请输入非负数';
    if (acAvailable === '' || isNaN(Number(acAvailable)) || Number(acAvailable) < 0)
      e.acAvailable = '请输入非负数';
    if (acDailyPnL === '' || isNaN(Number(acDailyPnL)))
      e.acDailyPnL = '请输入数字';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── 银证流水验证 ──
  const validateBankFlow = (): boolean => {
    const e: Record<string, string> = {};
    if (!bfDate) e.bfDate = '请选择日期';
    if (bfAmount === '' || isNaN(Number(bfAmount)) || Number(bfAmount) <= 0)
      e.bfAmount = '请输入大于0的金额';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── 交易持仓验证 ──
  const validateTrades = (): string | null => {
    const validRows = tradeRows.filter(r => r.stockCode && r.board);
    if (validRows.length === 0) return '请至少添加一条持仓记录';
    for (const row of validRows) {
      if (!row.positionValue || isNaN(Number(row.positionValue)) || Number(row.positionValue) < 0)
        return `股票 ${row.stockCode} 的持仓市值无效`;
      if (!row.positionQuantity || isNaN(Number(row.positionQuantity)) || Number(row.positionQuantity) < 0)
        return `股票 ${row.stockCode} 的持仓数量无效`;
    }
    return null;
  };

  // ── 股票搜索回调 ──
  const handleStockSelect = (rowId: number, code: string, name: string, board: string) => {
    setTradeRows(prev =>
      prev.map(r => (r.id === rowId ? { ...r, stockCode: code, stockName: name, board } : r))
    );
    setErrors(p => ({ ...p, [`trade_${rowId}`]: '' }));
  };

  // ── 交易行操作 ──
  const addTradeRow = () => setTradeRows(prev => [...prev, emptyTradeRow()]);

  const removeTradeRow = (id: number) => {
    if (tradeRows.length <= 1) return;
    setTradeRows(prev => prev.filter(r => r.id !== id));
  };

  const updateTradeRow = (id: number, field: keyof Omit<TradeRow, 'id' | 'stockName'>, value: string) => {
    setTradeRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // ── 提交各区块 ──
  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAccount()) return;
    unifiedEntryStore.clearMessages();
    await unifiedEntryStore.submitAccount({
      date: acDate,
      totalAssets: Number(acTotalAssets),
      positionValue: Number(acPositionValue),
      availableFunds: Number(acAvailable),
      dailyPnL: Number(acDailyPnL),
      remark: acRemark.trim() || undefined,
    });
  };

  const handleSubmitBankFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBankFlow()) return;
    unifiedEntryStore.clearMessages();
    await unifiedEntryStore.submitBankFlow({
      date: bfDate,
      flowType: bfFlowType,
      amount: Number(bfAmount),
      remark: bfRemark.trim() || undefined,
    });
  };

  const handleSubmitTrades = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateTrades();
    if (err) {
      setErrors({ trade: err });
      return;
    }
    setErrors({});
    unifiedEntryStore.clearMessages();

    const trades = tradeRows
      .filter(r => r.stockCode && r.board)
      .map(r => ({
        tradeDate,
        stockCode: r.stockCode,
        stockName: r.stockName,
        board: r.board,
        buyPrice: 0,
        buyQuantity: 0,
        sellPrice: 0,
        sellQuantity: 0,
        positionPnL: Number(r.positionValue) || 0,
        cumulativePnL: Number(r.dailyPnL) || 0,
        costPrice: Number(r.costPrice) || 0,
        currentPrice: Number(r.currentPrice) || 0,
        tradeNote: `持仓数量：${r.positionQuantity}股，持仓市值：${r.positionValue}元`,
        tonghuashunLink: undefined,
      }));

    if (isEditMode && editingId) {
      // 编辑模式：只支持单行，调用 update
      const single = trades[0];
      if (single) {
        const res = await tradeService.update(editingId, single);
        if (res.success) {
          unifiedEntryStore.successMessage = '持仓修改成功';
        } else {
          unifiedEntryStore.error = res.message || '修改失败';
        }
      }
    } else {
      await unifiedEntryStore.submitTrades(trades);
    }
  };

  const handleSubmitAll = async () => {
    const acOk = validateAccount();
    const bfOk = validateBankFlow();
    const tradeErr = validateTrades();
    if (!acOk || !bfOk || tradeErr) {
      setErrors(p => ({ ...p, submitAll: '请先修正各区块的错误后再提交' }));
      return;
    }
    setErrors({});
    unifiedEntryStore.clearMessages();

    const accountReq = {
      date: acDate,
      totalAssets: Number(acTotalAssets),
      positionValue: Number(acPositionValue),
      availableFunds: Number(acAvailable),
      dailyPnL: Number(acDailyPnL),
      remark: acRemark.trim() || undefined,
    };
    const bankFlowReq = {
      date: bfDate,
      flowType: bfFlowType,
      amount: Number(bfAmount),
      remark: bfRemark.trim() || undefined,
    };
    const trades = tradeRows
      .filter(r => r.stockCode && r.board)
      .map(r => ({
        tradeDate,
        stockCode: r.stockCode,
        stockName: r.stockName,
        board: r.board,
        buyPrice: 0,
        buyQuantity: 0,
        sellPrice: 0,
        sellQuantity: 0,
        positionPnL: Number(r.positionValue) || 0,
        cumulativePnL: Number(r.dailyPnL) || 0,
        costPrice: Number(r.costPrice) || 0,
        currentPrice: Number(r.currentPrice) || 0,
        tradeNote: `持仓数量：${r.positionQuantity}股，持仓市值：${r.positionValue}元`,
        tonghuashunLink: undefined,
      }));

    if (isEditMode && editingId) {
      const single = trades[0];
      if (single) {
        const res = await tradeService.update(editingId, single);
        runInAction(() => {
          if (res.success) {
            unifiedEntryStore.successMessage = '持仓修改成功';
          } else {
            unifiedEntryStore.error = res.message || '修改失败';
          }
        });
      }
      setErrors({});
      return;
    }

    await unifiedEntryStore.submitAll(accountReq, bankFlowReq, trades);
  };

  // ── 重置 ──
  const resetAll = () => {
    setAcDate(today);
    setAcTotalAssets('');
    setAcPositionValue('');
    setAcAvailable('');
    setAcDailyPnL('');
    setAcRemark('');

    setBfDate(today);
    setBfFlowType('转入');
    setBfAmount('');
    setBfRemark('');

    setTradeDate(today);
    setTradeRows([emptyTradeRow()]);

    setErrors({});
    unifiedEntryStore.clearMessages();
  };

  return (
    <div className="unified-entry-container">
      <h1 className="entry-page-title">{isEditMode ? '编辑持仓' : '统一录入'}</h1>
      <p className="entry-page-subtitle">{isEditMode ? '修改已有持仓记录' : '一次性录入账户资金、银证流水和多只股票持仓'}</p>

      {unifiedEntryStore.error && (
        <div className="entry-error-banner" role="alert">
          {unifiedEntryStore.error}
        </div>
      )}
      {unifiedEntryStore.successMessage && (
        <div className="entry-success-banner" role="status">
          {unifiedEntryStore.successMessage}
        </div>
      )}
      {errors.submitAll && (
        <div className="entry-error-banner">{errors.submitAll}</div>
      )}

      {/* ── 区块1：账户资金 ── */}
      <section className="unified-section">
        <h2 className="unified-section-title">账户资金</h2>
        <form className="entry-form" onSubmit={handleSubmitAccount} noValidate>
          <div className="form-group">
            <label htmlFor="ue-ac-date" className="form-label">日期 <span className="required-star">*</span></label>
            <input
              id="ue-ac-date"
              type="date"
              className={`form-input ${errors.acDate ? 'form-input-error' : ''}`}
              value={acDate}
              onChange={e => { setAcDate(e.target.value); setErrors(p => ({ ...p, acDate: '' })); }}
            />
            {errors.acDate && <span className="form-error">{errors.acDate}</span>}
          </div>

          <div className="form-row">
            <div className="form-group form-group-half">
              <label htmlFor="ue-ac-total" className="form-label">总资产（元）<span className="required-star">*</span></label>
              <input id="ue-ac-total" type="number" step="0.01" min="0" className={`form-input ${errors.acTotalAssets ? 'form-input-error' : ''}`} placeholder="0.00" value={acTotalAssets} onChange={e => { setAcTotalAssets(e.target.value); setErrors(p => ({ ...p, acTotalAssets: '' })); }} />
              {errors.acTotalAssets && <span className="form-error">{errors.acTotalAssets}</span>}
            </div>
            <div className="form-group form-group-half">
              <label htmlFor="ue-ac-pos" className="form-label">持仓市值（元）<span className="required-star">*</span></label>
              <input id="ue-ac-pos" type="number" step="0.01" min="0" className={`form-input ${errors.acPositionValue ? 'form-input-error' : ''}`} placeholder="0.00" value={acPositionValue} onChange={e => { setAcPositionValue(e.target.value); setErrors(p => ({ ...p, acPositionValue: '' })); }} />
              {errors.acPositionValue && <span className="form-error">{errors.acPositionValue}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group form-group-half">
              <label htmlFor="ue-ac-avail" className="form-label">可用资金（元）<span className="required-star">*</span></label>
              <input id="ue-ac-avail" type="number" step="0.01" min="0" className={`form-input ${errors.acAvailable ? 'form-input-error' : ''}`} placeholder="0.00" value={acAvailable} onChange={e => { setAcAvailable(e.target.value); setErrors(p => ({ ...p, acAvailable: '' })); }} />
              {errors.acAvailable && <span className="form-error">{errors.acAvailable}</span>}
            </div>
            <div className="form-group form-group-half">
              <label htmlFor="ue-ac-pnl" className="form-label">当日盈亏（元）<span className="required-star">*</span></label>
              <input id="ue-ac-pnl" type="number" step="0.01" className={`form-input ${errors.acDailyPnL ? 'form-input-error' : ''}`} placeholder="0.00" value={acDailyPnL} onChange={e => { setAcDailyPnL(e.target.value); setErrors(p => ({ ...p, acDailyPnL: '' })); }} />
              {errors.acDailyPnL && <span className="form-error">{errors.acDailyPnL}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="ue-ac-remark" className="form-label">备注</label>
            <textarea id="ue-ac-remark" className="form-textarea" placeholder="可选备注（最多500字）" value={acRemark} onChange={e => setAcRemark(e.target.value.slice(0, 500))} rows={2} maxLength={500} />
          </div>

          <button type="submit" className="entry-submit-btn" disabled={unifiedEntryStore.loading}>
            {unifiedEntryStore.loading ? '提交中...' : '保存账户资金'}
          </button>
        </form>
      </section>

      {/* ── 区块2：银证流水 ── */}
      <section className="unified-section">
        <h2 className="unified-section-title">银证流水</h2>
        <form className="entry-form" onSubmit={handleSubmitBankFlow} noValidate>
          <div className="form-group">
            <label htmlFor="ue-bf-date" className="form-label">日期 <span className="required-star">*</span></label>
            <input id="ue-bf-date" type="date" className={`form-input ${errors.bfDate ? 'form-input-error' : ''}`} value={bfDate} onChange={e => { setBfDate(e.target.value); setErrors(p => ({ ...p, bfDate: '' })); }} />
            {errors.bfDate && <span className="form-error">{errors.bfDate}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">流水类型 <span className="required-star">*</span></label>
            <div className="radio-group">
              {(['转入', '转出'] as const).map(type => (
                <label key={type} className={`radio-label ${bfFlowType === type ? 'radio-label-active' : ''}`}>
                  <input type="radio" name="bfFlowType" value={type} checked={bfFlowType === type} onChange={() => setBfFlowType(type)} className="radio-input" />
                  <span className="radio-custom" />
                  <span className="radio-text">{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="ue-bf-amount" className="form-label">金额（元）<span className="required-star">*</span></label>
            <input id="ue-bf-amount" type="number" step="0.01" min="0.01" className={`form-input ${errors.bfAmount ? 'form-input-error' : ''}`} placeholder="0.00" value={bfAmount} onChange={e => { setBfAmount(e.target.value); setErrors(p => ({ ...p, bfAmount: '' })); }} />
            {errors.bfAmount && <span className="form-error">{errors.bfAmount}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="ue-bf-remark" className="form-label">备注</label>
            <textarea id="ue-bf-remark" className="form-textarea" placeholder="可选备注（最多500字）" value={bfRemark} onChange={e => setBfRemark(e.target.value.slice(0, 500))} rows={2} maxLength={500} />
          </div>

          <button type="submit" className="entry-submit-btn" disabled={unifiedEntryStore.loading}>
            {unifiedEntryStore.loading ? '提交中...' : '保存银证流水'}
          </button>
        </form>
      </section>

      {/* ── 区块3：多股票持仓录入 ── */}
      <section className="unified-section">
        <h2 className="unified-section-title">多股票持仓录入</h2>
        <form className="entry-form" onSubmit={handleSubmitTrades} noValidate>
          <div className="form-group">
            <label htmlFor="ue-trade-date" className="form-label">持仓日期 <span className="required-star">*</span></label>
            <input
              id="ue-trade-date"
              type="date"
              className="form-input"
              value={tradeDate}
              onChange={e => setTradeDate(e.target.value)}
            />
          </div>

          {errors.trade && <div className="entry-error-banner">{errors.trade}</div>}

          {tradeRows.map((row, idx) => (
            <div key={row.id} className="trade-row-card">
              <div className="trade-row-header">
                <span className="trade-row-index">#{idx + 1}</span>
                {tradeRows.length > 1 && (
                  <button type="button" className="trade-row-remove" onClick={() => removeTradeRow(row.id)} title="删除此行">
                    ✕
                  </button>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">股票搜索 <span className="required-star">*</span></label>
                <StockSearchInput
                  value={row.stockCode ? `${row.stockCode} - ${row.stockName}` : ''}
                  onChange={(code, name, board) => handleStockSelect(row.id, code, name, board)}
                  placeholder="输入股票代码/名称/简称搜索"
                />
                {errors[`trade_${row.id}`] && <span className="form-error">{errors[`trade_${row.id}`]}</span>}
              </div>

              {row.stockCode && (
                <div className="selected-stock-info">
                  <span className="selected-stock-code">{row.stockCode}</span>
                  <span className="selected-stock-name">{row.stockName}</span>
                  <span className="selected-stock-board">{row.board}</span>
                </div>
              )}

              <div className="form-row">
                <div className="form-group form-group-half">
                  <label className="form-label">持仓市值（元）<span className="required-star">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    value={row.positionValue}
                    onChange={e => updateTradeRow(row.id, 'positionValue', e.target.value)}
                  />
                </div>
                <div className="form-group form-group-half">
                  <label className="form-label">持仓数量（股）<span className="required-star">*</span></label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    className="form-input"
                    placeholder="0"
                    value={row.positionQuantity}
                    onChange={e => updateTradeRow(row.id, 'positionQuantity', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group form-group-half">
                  <label className="form-label">成本价（元）</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    className="form-input"
                    placeholder="0.000"
                    value={row.costPrice}
                    onChange={e => updateTradeRow(row.id, 'costPrice', e.target.value)}
                  />
                </div>
                <div className="form-group form-group-half">
                  <label className="form-label">现价（元）</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    className="form-input"
                    placeholder="0.000"
                    value={row.currentPrice}
                    onChange={e => updateTradeRow(row.id, 'currentPrice', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group form-group-half">
                  <label className="form-label">当日盈亏（元）</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={row.dailyPnL}
                    onChange={e => updateTradeRow(row.id, 'dailyPnL', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <button type="button" className="entry-add-row-btn" onClick={addTradeRow}>
            + 添加股票
          </button>

          {unifiedEntryStore.batchResult && unifiedEntryStore.batchResult.Errors && unifiedEntryStore.batchResult.Errors.length > 0 && (
            <div className="entry-error-banner">
              {unifiedEntryStore.batchResult.Errors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}

          <button type="submit" className="entry-submit-btn" disabled={unifiedEntryStore.loading}>
            {unifiedEntryStore.loading ? '提交中...' : isEditMode ? '保存修改' : `保存持仓（${tradeRows.filter(r => r.stockCode).length}只股票）`}
          </button>
        </form>
      </section>

      {/* ── 一键全部提交 ── */}
      <div className="unified-submit-all">
        <button
          type="button"
          className="entry-submit-all-btn"
          disabled={unifiedEntryStore.loading}
          onClick={handleSubmitAll}
        >
          {unifiedEntryStore.loading ? '提交中...' : '一键保存全部'}
        </button>
        <button
          type="button"
          className="entry-reset-btn"
          onClick={resetAll}
        >
          重置全部
        </button>
      </div>
    </div>
  );
});

export default UnifiedEntryPage;
