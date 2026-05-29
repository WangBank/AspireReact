import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/StoreProvider';
import { accountService } from '../services/AccountService';
import { bankFlowService } from '../services/BankFlowService';
import { tradeService } from '../services/TradeService';
import type { AccountDailyRequest } from '../services/AccountService';
import { imageImportService } from '../services/ImageImportService';
import type { PortfolioImportResponse } from '../services/ImageImportService';
import type { StockTradeRequest } from '../services/TradeService';
import StockSearchInput from '../components/StockSearchInput';
import './AccountEntryPage.css';
import './UnifiedEntryPage.css';

type EntryType = 'account' | 'bankflow' | 'trade';

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
  cumulativePnL: string;
  isLiquidated: boolean;
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
  cumulativePnL: '',
  isLiquidated: false,
});

const PAGE_TITLES: Record<EntryType, { create: string; edit: string }> = {
  account: { create: '录入账户资金', edit: '编辑账户资金' },
  bankflow: { create: '录入银证流水', edit: '编辑银证流水' },
  trade: { create: '录入交易持仓', edit: '编辑交易持仓' },
};

const UnifiedEntryPage = observer(() => {
  const { unifiedEntryStore: store } = useStore();
  const navigate = useNavigate();

  // 从 URL 读取 type 和 id 参数
  const params = new URLSearchParams(window.location.search);
  const urlType = (params.get('type') || 'trade') as EntryType;
  const urlId = params.get('id');

  const isEditMode = Boolean(urlId);
  const editingId = urlId ? parseInt(urlId, 10) : 0;
  const [entryType, setEntryType] = useState<EntryType>(isEditMode ? urlType : 'account');

  // 同步 URL 类型变化（编辑模式从列表页跳转时）
  useEffect(() => {
    if (isEditMode) setEntryType(urlType);
  }, [urlType, isEditMode]);

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
  const [importDate, setImportDate] = useState(today);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImportingImage, setIsImportingImage] = useState(false);
  const [importError, setImportError] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importNotice, setImportNotice] = useState('');
  const [lastImportResult, setLastImportResult] = useState<PortfolioImportResponse | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── 编辑模式：加载已有数据 ──
  useEffect(() => {
    if (!isEditMode || !editingId || !urlType) return;
    (async () => {
      if (entryType === 'account') {
        const res = await accountService.getById(editingId);
        if (res.success && res.data) {
          const d = res.data;
          setAcDate(d.date?.split('T')[0] || today);
          setAcTotalAssets(String(d.totalAssets ?? ''));
          setAcPositionValue(String(d.positionValue ?? ''));
          setAcAvailable(String(d.availableFunds ?? ''));
          setAcDailyPnL(String(d.dailyPnL ?? ''));
          setAcRemark(d.remark || '');
        }
      } else if (entryType === 'bankflow') {
        const res = await bankFlowService.getById(editingId);
        if (res.success && res.data) {
          const d = res.data;
          setBfDate(d.date?.split('T')[0] || today);
          setBfFlowType(d.flowType === '转出' ? '转出' : '转入');
          setBfAmount(String(d.amount ?? ''));
          setBfRemark(d.remark || '');
        }
      } else if (entryType === 'trade') {
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
            positionQuantity: d.positionQuantity != null ? String(d.positionQuantity) : '',
            costPrice: d.costPrice != null ? String(d.costPrice) : '',
            currentPrice: d.currentPrice != null ? String(d.currentPrice) : '',
            dailyPnL: d.dailyPnL != null ? String(d.dailyPnL) : '',
            cumulativePnL: d.cumulativePnL != null ? String(d.cumulativePnL) : '',
            isLiquidated: d.isLiquidated ?? false,
          }]);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editingId, entryType]);

  // ── 验证 ──
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

  const validateBankFlow = (): boolean => {
    const e: Record<string, string> = {};
    if (!bfDate) e.bfDate = '请选择日期';
    if (bfAmount === '' || isNaN(Number(bfAmount)) || Number(bfAmount) <= 0)
      e.bfAmount = '请输入大于0的金额';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateTrades = (): string | null => {
    const validRows = tradeRows.filter(r => r.stockCode && r.board);
    if (validRows.length === 0) return '请至少添加一条持仓记录';
    for (const row of validRows) {
      if (!row.positionValue || isNaN(Number(row.positionValue)))
        return `心魔 ${row.stockCode} 的持仓盈亏无效`;
      if (!row.positionQuantity || isNaN(Number(row.positionQuantity)) || Number(row.positionQuantity) < 0)
        return `心魔 ${row.stockCode} 的持仓数量无效`;
    }
    return null;
  };

  // ── 心魔搜索回调 ──
  const handleStockSelect = (rowId: number, code: string, name: string, board: string) => {
    setTradeRows(prev =>
      prev.map(r => (r.id === rowId ? { ...r, stockCode: code, stockName: name, board } : r))
    );
    setErrors(p => ({ ...p, [`trade_${rowId}`]: '' }));
  };

  const addTradeRow = () => setTradeRows(prev => [...prev, emptyTradeRow()]);

  const removeTradeRow = (id: number) => {
    if (tradeRows.length <= 1) return;
    setTradeRows(prev => prev.filter(r => r.id !== id));
  };

  const updateTradeRow = <K extends keyof Omit<TradeRow, 'id'>>(id: number, field: K, value: TradeRow[K]) => {
    setTradeRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const buildAccountRequest = (): AccountDailyRequest | null => {
    const hasAccountData = [acTotalAssets, acPositionValue, acAvailable, acDailyPnL]
      .some(value => value.trim() !== '');

    if (!hasAccountData) {
      return null;
    }

    return {
      date: acDate,
      totalAssets: Number(acTotalAssets),
      positionValue: Number(acPositionValue),
      availableFunds: Number(acAvailable),
      dailyPnL: Number(acDailyPnL),
      remark: acRemark.trim() || undefined,
    };
  };

  const buildTradeRequests = (): StockTradeRequest[] => (
    tradeRows
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
        cumulativePnL: Number(r.cumulativePnL) || 0,
        costPrice: Number(r.costPrice) || 0,
        currentPrice: Number(r.currentPrice) || 0,
        positionQuantity: Number(r.positionQuantity) || 0,
        dailyPnL: Number(r.dailyPnL) || 0,
        isLiquidated: r.isLiquidated,
        tradeNote: undefined,
        tonghuashunLink: undefined,
      }))
  );

  const applyImportedData = (data: PortfolioImportResponse) => {
    setAcDate(importDate);
    setTradeDate(importDate);

    if (data.account) {
      setAcTotalAssets(String(data.account.totalAssets));
      setAcPositionValue(String(data.account.positionValue));
      setAcAvailable(String(data.account.availableFunds));
      setAcDailyPnL(String(data.account.dailyPnL));
    }

    if (data.positions.length > 0) {
      setTradeRows(data.positions.map(position => ({
        id: nextRowId++,
        stockCode: position.stockCode,
        stockName: position.stockName,
        board: position.board,
        positionValue: String(position.positionPnL),
        positionQuantity: String(position.positionQuantity),
        costPrice: String(position.costPrice),
        currentPrice: String(position.currentPrice),
        dailyPnL: String(position.dailyPnL),
        cumulativePnL: String(position.cumulativePnL),
        isLiquidated: position.isLiquidated,
      })));
    } else {
      setTradeRows([emptyTradeRow()]);
    }

    setEntryType('account');
    setErrors({});
    setImportWarnings(data.warnings || []);
    setImportNotice(`识别完成，已回填到账户资金和交易持仓表单。当前识别到 ${data.positions.length} 条持仓。`);
    setLastImportResult(data);
  };

  const handleImportScreenshot = async () => {
    if (!importFile) {
      setImportError('请先选择一张券商持仓截图');
      return;
    }

    setIsImportingImage(true);
    setImportError('');
    setImportWarnings([]);
    setImportNotice('');
    store.clearMessages();

    try {
      const data = await imageImportService.importScreenshot(importFile);
      applyImportedData(data);
    } catch (err) {
      setLastImportResult(null);
      setImportError(err instanceof Error ? err.message : '图片识别失败，请稍后重试');
    } finally {
      setIsImportingImage(false);
    }
  };

  const handleSaveImportedData = async () => {
    const accountRequest = buildAccountRequest();
    const tradeRequests = buildTradeRequests();

    if (!accountRequest && tradeRequests.length === 0) {
      setImportError('当前没有可保存的识别结果');
      return;
    }

    const accountValid = accountRequest ? validateAccount() : true;
    const tradeError = tradeRequests.length > 0 ? validateTrades() : null;

    if (tradeError) {
      setErrors(prev => ({ ...prev, trade: tradeError }));
    }

    if (!accountValid || tradeError) {
      setImportError('识别结果里还有待确认字段，请检查表单后再保存');
      setEntryType(!accountValid ? 'account' : 'trade');
      return;
    }

    setErrors({});
    setImportError('');
    store.clearMessages();

    const result = await store.submitAll(accountRequest, null, tradeRequests);
    if (result.account || result.trades) {
      setImportNotice(`识别结果已写入：${result.account ? '账户资金已保存' : ''}${result.account && result.trades ? '，' : ''}${result.trades ? `持仓成功 ${store.batchResult?.successCount || 0} 条` : ''}`);
    }
  };

  // ── 提交 ──
  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAccount()) return;
    store.clearMessages();
    const req = buildAccountRequest();
    if (!req) return;
    if (isEditMode && editingId) {
      const res = await accountService.update(editingId, req);
      if (res.success) {
        store.successMessage = '账户资金修改成功';
      } else {
        store.error = res.message || '修改失败';
      }
    } else {
      await store.submitAccount(req);
    }
  };

  const handleSubmitBankFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBankFlow()) return;
    store.clearMessages();
    const req = {
      date: bfDate,
      flowType: bfFlowType,
      amount: Number(bfAmount),
      remark: bfRemark.trim() || undefined,
    };
    if (isEditMode && editingId) {
      const res = await bankFlowService.update(editingId, req);
      if (res.success) {
        store.successMessage = '银证流水修改成功';
      } else {
        store.error = res.message || '修改失败';
      }
    } else {
      await store.submitBankFlow(req);
    }
  };

  const handleSubmitTrades = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateTrades();
    if (err) {
      setErrors({ trade: err });
      return;
    }
    setErrors({});
    store.clearMessages();
    const trades = buildTradeRequests();

    if (isEditMode && editingId) {
      const single = trades[0];
      if (single) {
        const res = await tradeService.update(editingId, single);
        if (res.success) {
          store.successMessage = '持仓修改成功';
        } else {
          store.error = res.message || '修改失败';
        }
      }
    } else {
      await store.submitTrades(trades);
    }
  };

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
    setImportDate(today);
    setImportFile(null);
    setIsImportingImage(false);
    setImportError('');
    setImportWarnings([]);
    setImportNotice('');
    setLastImportResult(null);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
    setErrors({});
    store.clearMessages();
  };

  const pageTitle = isEditMode
    ? PAGE_TITLES[entryType]?.edit || '编辑'
    : PAGE_TITLES[entryType]?.create || '录入';

  return (
    <div className="unified-entry-container">
      <h1 className="entry-page-title">{pageTitle}</h1>
      <p className="entry-page-subtitle">
        {isEditMode ? '修改已有记录' : `录入${PAGE_TITLES[entryType]?.create?.replace('录入', '') || ''}数据`}
      </p>

      {!isEditMode && (
        <section className="image-import-panel">
          <div className="image-import-panel__header">
            <div>
              <h2 className="image-import-panel__title">图片识别导入</h2>
              <p className="image-import-panel__subtitle">上传同花顺手机端持仓页截图，自动回填每日盈亏、总资产、可用资金和持仓明细</p>
            </div>
            {lastImportResult && (
              <button
                type="button"
                className="image-import-panel__save"
                onClick={handleSaveImportedData}
                disabled={store.loading || isImportingImage}
              >
                {store.loading ? '保存中...' : '一键保存识别结果'}
              </button>
            )}
          </div>

          <div className="image-import-panel__grid">
            <div className="form-group form-group-half">
              <label htmlFor="ue-import-date" className="form-label">导入日期</label>
              <input
                id="ue-import-date"
                type="date"
                className="form-input"
                value={importDate}
                onChange={e => setImportDate(e.target.value)}
              />
            </div>

            <div className="form-group form-group-half">
              <label htmlFor="ue-import-file" className="form-label">券商截图</label>
              <input
                ref={importFileInputRef}
                id="ue-import-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="form-input image-import-panel__file"
                onChange={e => {
                  const nextFile = e.target.files?.[0] || null;
                  setImportFile(nextFile);
                  setImportError('');
                }}
              />
            </div>
          </div>

          <div className="image-import-panel__actions">
            <button
              type="button"
              className="entry-submit-all-btn"
              onClick={handleImportScreenshot}
              disabled={!importFile || isImportingImage || store.loading}
            >
              {isImportingImage ? '识别中...' : '识别并回填'}
            </button>
            {importFile && (
              <span className="image-import-panel__filename">{importFile.name}</span>
            )}
          </div>

          <p className="image-import-panel__hint">
            当前版本针对同花顺手机端持仓页整屏截图优化。请尽量保留“总资产、总市值、可用、当日参考盈亏”和完整持仓列表，识别结果会先回填表单，确认后再保存入库。
          </p>

          {importError && <div className="entry-error-banner">{importError}</div>}
          {importNotice && <div className="entry-success-banner">{importNotice}</div>}

          {lastImportResult && (
            <div className="image-import-panel__summary">
              <span>账户汇总：{lastImportResult.account ? '已识别' : '未识别完整'}</span>
              <span>持仓条数：{lastImportResult.positions.length}</span>
              <span>回填日期：{importDate}</span>
            </div>
          )}

          {importWarnings.length > 0 && (
            <div className="image-import-panel__warnings">
              <p className="image-import-panel__warnings-title">识别提醒</p>
              <ul className="image-import-panel__warnings-list">
                {importWarnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ── 类型切换标签 ── */}
      {!isEditMode && (
        <div className="unified-tab-bar">
          {(['account', 'bankflow', 'trade'] as EntryType[]).map(t => (
            <button
              key={t}
              className={`unified-tab ${entryType === t ? 'unified-tab-active' : ''}`}
              onClick={() => setEntryType(t)}
            >
              {t === 'account' ? '账户资金' : t === 'bankflow' ? '银证转账' : '交易持仓'}
            </button>
          ))}
        </div>
      )}

      {store.error && (
        <div className="entry-error-banner" role="alert">{store.error}</div>
      )}
      {store.successMessage && (
        <div className="entry-success-banner" role="status">{store.successMessage}</div>
      )}
      {errors.submitAll && (
        <div className="entry-error-banner">{errors.submitAll}</div>
      )}

      {/* ── 账户资金 ── */}
      {(entryType === 'account') && (
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

            <button type="submit" className="entry-submit-btn" disabled={store.loading}>
              {store.loading ? '提交中...' : isEditMode ? '保存修改' : '保存账户资金'}
            </button>
          </form>
        </section>
      )}

      {/* ── 银证流水 ── */}
      {(entryType === 'bankflow') && (
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

            <button type="submit" className="entry-submit-btn" disabled={store.loading}>
              {store.loading ? '提交中...' : isEditMode ? '保存修改' : '保存银证流水'}
            </button>
          </form>
        </section>
      )}

      {/* ── 交易持仓 ── */}
      {(entryType === 'trade') && (
        <section className="unified-section">
          <h2 className="unified-section-title">交易持仓录入</h2>
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
                    <button type="button" className="trade-row-remove" onClick={() => removeTradeRow(row.id)} title="删除此行">✕</button>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">心魔搜索 <span className="required-star">*</span></label>
                  <StockSearchInput
                    value={row.stockCode ? `${row.stockCode} - ${row.stockName}` : ''}
                    onChange={(code, name, board) => handleStockSelect(row.id, code, name, board)}
                    placeholder="输入心魔代码/名称/简称搜索"
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
                  <label className="form-label">
                    <input
                      type="checkbox"
                      checked={row.isLiquidated}
                      onChange={e => updateTradeRow(row.id, 'isLiquidated', e.target.checked)}
                    />
                    清仓（只记录盈亏，不记录持仓）
                  </label>
                </div>

                {!row.isLiquidated && (
                  <div className="form-row">
                    <div className="form-group form-group-half">
                      <label className="form-label">持仓盈亏（元）<span className="required-star">*</span></label>
                      <input type="number" step="0.01" className="form-input" placeholder="0.00" value={row.positionValue} onChange={e => updateTradeRow(row.id, 'positionValue', e.target.value)} />
                    </div>
                    <div className="form-group form-group-half">
                      <label className="form-label">持仓数量（股）<span className="required-star">*</span></label>
                      <input type="number" step="100" min="0" className="form-input" placeholder="0" value={row.positionQuantity} onChange={e => updateTradeRow(row.id, 'positionQuantity', e.target.value)} />
                    </div>
                  </div>
                )}

                {!row.isLiquidated && (
                  <div className="form-row">
                    <div className="form-group form-group-half">
                      <label className="form-label">成本价（元）</label>
                      <input type="number" step="0.001" min="0" className="form-input" placeholder="0.000" value={row.costPrice} onChange={e => updateTradeRow(row.id, 'costPrice', e.target.value)} />
                    </div>
                    <div className="form-group form-group-half">
                      <label className="form-label">现价（元）</label>
                      <input type="number" step="0.001" min="0" className="form-input" placeholder="0.000" value={row.currentPrice} onChange={e => updateTradeRow(row.id, 'currentPrice', e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group form-group-half">
                    <label className="form-label">当日盈亏（元）</label>
                    <input type="number" step="0.01" className="form-input" placeholder="0.00" value={row.dailyPnL} onChange={e => updateTradeRow(row.id, 'dailyPnL', e.target.value)} />
                  </div>
                  <div className="form-group form-group-half">
                    <label className="form-label">总盈亏（元）</label>
                    <input type="number" step="0.01" className="form-input" placeholder="0.00" value={row.cumulativePnL} onChange={e => updateTradeRow(row.id, 'cumulativePnL', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}

            <button type="button" className="entry-add-row-btn" onClick={addTradeRow}>+ 添加心魔</button>

            {store.batchResult && store.batchResult.errors && store.batchResult.errors.length > 0 && (
              <div className="entry-error-banner">
                {store.batchResult.errors.map((err: string, i: number) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}

            <button type="submit" className="entry-submit-btn" disabled={store.loading}>
              {store.loading ? '提交中...' : isEditMode ? '保存修改' : `保存持仓（${tradeRows.filter(r => r.stockCode).length}只心魔）`}
            </button>
          </form>
        </section>
      )}

      {/* ── 重置按钮 ── */}
      <div className="unified-submit-all">
        <button type="button" className="entry-reset-btn" onClick={resetAll}>重置</button>
        <button type="button" className="entry-cancel-btn" onClick={() => navigate('/list/unified')}>返回列表</button>
      </div>
    </div>
  );
});

export default UnifiedEntryPage;
