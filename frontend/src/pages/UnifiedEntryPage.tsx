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
import type { BankFlowRequest } from '../services/BankFlowService';
import type { StockTradeRequest } from '../services/TradeService';
import StockSearchInput from '../components/StockSearchInput';
import { formatLocalDate } from '../utils/date';
import './AccountEntryPage.css';
import './UnifiedEntryPage.css';

type EntryType = 'account' | 'bankflow' | 'trade';

interface TradeRow {
  id: number;
  stockCode: string;
  stockName: string;
  board: string;
  buyPrice: string;
  buyQuantity: string;
  sellPrice: string;
  sellQuantity: string;
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
  buyPrice: '',
  buyQuantity: '',
  sellPrice: '',
  sellQuantity: '',
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

const parseOptionalNumber = (value: string): number | null => {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const UnifiedEntryPage = observer(() => {
  const { unifiedEntryStore: store, dashboardStore } = useStore();
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

  const today = formatLocalDate();

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
  const [importPreviewUrl, setImportPreviewUrl] = useState('');
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const importPreviewUrlRef = useRef<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => () => {
    if (importPreviewUrlRef.current) {
      URL.revokeObjectURL(importPreviewUrlRef.current);
    }
  }, []);

  useEffect(() => {
    void dashboardStore.fetchDashboard();
  }, [dashboardStore]);

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
            buyPrice: d.buyPrice != null ? String(d.buyPrice) : '',
            buyQuantity: d.buyQuantity != null ? String(d.buyQuantity) : '',
            sellPrice: d.sellPrice != null ? String(d.sellPrice) : '',
            sellQuantity: d.sellQuantity != null ? String(d.sellQuantity) : '',
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
  const buildAccountErrors = (): Record<string, string> => {
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
    return e;
  };

  const validateAccount = (): boolean => {
    const e = buildAccountErrors();
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildBankFlowErrors = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!bfDate) e.bfDate = '请选择日期';
    if (bfAmount === '' || isNaN(Number(bfAmount)) || Number(bfAmount) <= 0)
      e.bfAmount = '请输入大于0的金额';
    return e;
  };

  const validateBankFlow = (): boolean => {
    const e = buildBankFlowErrors();
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

  const updateImportFile = (nextFile: File | null) => {
    if (importPreviewUrlRef.current) {
      URL.revokeObjectURL(importPreviewUrlRef.current);
      importPreviewUrlRef.current = null;
    }

    setImportFile(nextFile);

    if (!nextFile) {
      setImportPreviewUrl('');
      if (importFileInputRef.current) {
        importFileInputRef.current.value = '';
      }
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(nextFile);
    importPreviewUrlRef.current = nextPreviewUrl;
    setImportPreviewUrl(nextPreviewUrl);
  };

  const clearEntryForms = (baseDate: string) => {
    setAcDate(baseDate);
    setAcTotalAssets('');
    setAcPositionValue('');
    setAcAvailable('');
    setAcDailyPnL('');
    setAcRemark('');
    setBfDate(baseDate);
    setBfFlowType('转入');
    setBfAmount('');
    setBfRemark('');
    setTradeDate(baseDate);
    setTradeRows([emptyTradeRow()]);
  };

  const clearImportedBackfill = ({
    preserveImportDate = true,
    clearStoreMessages = false,
    notice = '',
  }: {
    preserveImportDate?: boolean;
    clearStoreMessages?: boolean;
    notice?: string;
  } = {}) => {
    const nextBaseDate = preserveImportDate ? importDate : today;
    clearEntryForms(nextBaseDate);

    if (!preserveImportDate) {
      setImportDate(today);
    }

    setIsImportingImage(false);
    setImportError('');
    setImportWarnings([]);
    setImportNotice(notice);
    setLastImportResult(null);
    setErrors({});
    updateImportFile(null);

    if (clearStoreMessages) {
      store.clearMessages();
    }
  };

  const buildAccountRequest = (): AccountDailyRequest | null => {
    const normalizedValues = [acTotalAssets, acPositionValue, acAvailable, acDailyPnL]
      .map(value => value.trim());
    const hasAnyAccountData = normalizedValues.some(value => value !== '');
    const hasCompleteAccountData = normalizedValues.every(value => value !== '');

    if (!hasAnyAccountData || !hasCompleteAccountData) {
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

  const buildBankFlowRequest = (): BankFlowRequest | null => {
    if (!bfDate || bfAmount.trim() === '') {
      return null;
    }

    const amount = Number(bfAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      return null;
    }

    return {
      date: bfDate,
      flowType: bfFlowType,
      amount,
      remark: bfRemark.trim() || undefined,
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
        buyPrice: Number(r.buyPrice) || 0,
        buyQuantity: Number(r.buyQuantity) || 0,
        sellPrice: Number(r.sellPrice) || 0,
        sellQuantity: Number(r.sellQuantity) || 0,
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
    const effectiveDate = data.recognizedDate?.split('T')[0]
      || data.bankFlow?.date?.split('T')[0]
      || importDate;

    setAcDate(effectiveDate);
    setBfDate(effectiveDate);
    setTradeDate(effectiveDate);

    if (data.account) {
      setAcTotalAssets(String(data.account.totalAssets));
      setAcPositionValue(String(data.account.positionValue));
      setAcAvailable(String(data.account.availableFunds));
      setAcDailyPnL(String(data.account.dailyPnL));
    } else if (data.positions.length > 0) {
      const derivedDailyPnL = data.positions.reduce((sum, position) => sum + (position.dailyPnL || 0), 0);
      setAcTotalAssets('');
      setAcPositionValue('');
      setAcAvailable('');
      setAcDailyPnL(String(derivedDailyPnL));
    }

    if (data.bankFlow) {
      setBfFlowType(data.bankFlow.flowType);
      setBfAmount(String(data.bankFlow.amount));
      setBfRemark(data.bankFlow.remark || '');
    } else {
      setBfFlowType('转入');
      setBfAmount('');
      setBfRemark('');
    }

    if (data.positions.length > 0) {
      setTradeRows(data.positions.map(position => ({
        id: nextRowId++,
        stockCode: position.stockCode,
        stockName: position.stockName,
        board: position.board,
        buyPrice: String(position.buyPrice ?? 0),
        buyQuantity: String(position.buyQuantity ?? 0),
        sellPrice: String(position.sellPrice ?? 0),
        sellQuantity: String(position.sellQuantity ?? 0),
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

    setErrors({});
    setImportWarnings(data.warnings || []);
    setImportNotice(
      data.account
        ? `识别完成，已回填表单。${data.bankFlow ? '银证流水已同步识别，' : ''}当前识别到 ${data.positions.length} 条股票记录。`
        : `识别完成，已回填 ${data.positions.length} 条股票记录，并按流水合计回填账户当日盈亏。`
    );
    setLastImportResult(data);
  };

  const handleImportScreenshot = async () => {
    if (!importFile) {
      setImportError('请先选择一张券商截图');
      return;
    }

    setIsImportingImage(true);
    setImportError('');
    setImportWarnings([]);
    setImportNotice('');
    store.clearMessages();

    try {
      const data = await imageImportService.importScreenshot(importFile, importDate);
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
    const bankFlowRequest = buildBankFlowRequest();
    const tradeRequests = buildTradeRequests();

    if (!accountRequest && !bankFlowRequest && tradeRequests.length === 0) {
      setImportError('当前没有可保存的识别结果');
      return;
    }

    const mergedErrors: Record<string, string> = {
      ...(accountRequest ? buildAccountErrors() : {}),
      ...(bankFlowRequest ? buildBankFlowErrors() : {}),
    };
    const accountValid = accountRequest ? Object.keys(buildAccountErrors()).length === 0 : true;
    const bankFlowValid = bankFlowRequest ? Object.keys(buildBankFlowErrors()).length === 0 : true;
    const tradeError = tradeRequests.length > 0 ? validateTrades() : null;

    if (tradeError) {
      mergedErrors.trade = tradeError;
    }

    if (!accountValid || !bankFlowValid || tradeError) {
      setErrors(mergedErrors);
      setImportError('识别结果里还有待确认字段，请检查表单后再保存');
      return;
    }

    setErrors({});
    setImportError('');
    store.clearMessages();

    const result = await store.submitAll(accountRequest, bankFlowRequest, tradeRequests);
    if (result.account || result.bankFlow || result.trades) {
      const parts = [
        result.account ? '账户资金已保存' : '',
        result.bankFlow ? '银证流水已保存' : '',
        result.trades ? `持仓成功 ${store.batchResult?.successCount || 0} 条` : '',
      ].filter(Boolean);
      const allRequestedSucceeded = (!accountRequest || result.account)
        && (!bankFlowRequest || result.bankFlow)
        && (tradeRequests.length === 0 || result.trades);

      if (allRequestedSucceeded) {
        void dashboardStore.fetchDashboard();
        clearImportedBackfill({
          preserveImportDate: true,
          clearStoreMessages: false,
          notice: `识别结果已写入：${parts.join('，')}，已清空识别回填数据`,
        });
      } else {
        void dashboardStore.fetchDashboard();
        setImportNotice(`识别结果已写入：${parts.join('，')}`);
      }
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
        void dashboardStore.fetchDashboard();
      } else {
        store.error = res.message || '修改失败';
      }
    } else {
      const success = await store.submitAccount(req);
      if (success) {
        void dashboardStore.fetchDashboard();
      }
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
        void dashboardStore.fetchDashboard();
      } else {
        store.error = res.message || '修改失败';
      }
    } else {
      const success = await store.submitBankFlow(req);
      if (success) {
        void dashboardStore.fetchDashboard();
      }
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
          void dashboardStore.fetchDashboard();
        } else {
          store.error = res.message || '修改失败';
        }
      }
    } else {
      const success = await store.submitTrades(trades);
      if (success) {
        void dashboardStore.fetchDashboard();
      }
    }
  };

  const resetAll = () => {
    clearImportedBackfill({
      preserveImportDate: false,
      clearStoreMessages: true,
      notice: '',
    });
  };

  const pageTitle = isEditMode
    ? PAGE_TITLES[entryType]?.edit || '编辑'
    : '统一录入';
  const pageSubtitle = isEditMode
    ? '修改已有记录'
    : '在同一个页面录入账户资金、银证转账和交易持仓数据';
  const showAccountSection = !isEditMode || entryType === 'account';
  const showBankFlowSection = !isEditMode || entryType === 'bankflow';
  const showTradeSection = !isEditMode || entryType === 'trade';
  const hasDraftValues = isEditMode
    || !!lastImportResult
    || acTotalAssets.trim() !== ''
    || acPositionValue.trim() !== ''
    || acAvailable.trim() !== ''
    || acDailyPnL.trim() !== ''
    || acRemark.trim() !== ''
    || bfAmount.trim() !== ''
    || bfRemark.trim() !== ''
    || tradeRows.some(row =>
      row.stockCode.trim() !== ''
      || row.stockName.trim() !== ''
      || row.board.trim() !== ''
      || row.buyPrice.trim() !== ''
      || row.buyQuantity.trim() !== ''
      || row.sellPrice.trim() !== ''
      || row.sellQuantity.trim() !== ''
      || row.positionValue.trim() !== ''
      || row.positionQuantity.trim() !== ''
      || row.costPrice.trim() !== ''
      || row.currentPrice.trim() !== ''
      || row.dailyPnL.trim() !== ''
      || row.cumulativePnL.trim() !== ''
      || row.isLiquidated);
  const hasCustomDraftDate = tradeDate !== today || acDate !== today || bfDate !== today || importDate !== today;
  const shouldShowDraftInsight = hasDraftValues || hasCustomDraftDate;
  const currentRecordDateText = shouldShowDraftInsight
    ? (tradeDate || acDate || bfDate || dashboardStore.formatRecordDate(dashboardStore.latestRecordDate))
    : dashboardStore.formatRecordDate(dashboardStore.latestRecordDate);
  const currentAccountPnL = parseOptionalNumber(acDailyPnL);
  const currentTradePnL = tradeRows.reduce((sum, row) => sum + (parseOptionalNumber(row.dailyPnL) ?? 0), 0);
  const hasTradePnL = tradeRows.some(row => parseOptionalNumber(row.dailyPnL) !== null);
  const displayedDailyPnL = currentAccountPnL
    ?? (hasTradePnL ? currentTradePnL : (dashboardStore.data ? dashboardStore.latestRecordDailyPnL : null));
  const displayedDailyPnLText = displayedDailyPnL == null
    ? '--'
    : dashboardStore.formatPnL(displayedDailyPnL);

  return (
    <div className="unified-entry-container">
      <h1 className="entry-page-title">{pageTitle}</h1>
      <p className="entry-page-subtitle">{pageSubtitle}</p>
      <section className="entry-insight-bar">
        <div className="entry-insight-card">
          <span className="entry-insight-label">{shouldShowDraftInsight ? '当前录入日期' : '最近交易日期'}</span>
          <span className="entry-insight-value">{currentRecordDateText}</span>
        </div>
        <div className="entry-insight-card">
          <span className="entry-insight-label">当日盈亏</span>
          <span
            className={`entry-insight-value ${
              displayedDailyPnL != null
                ? dashboardStore.isPnLPositive(displayedDailyPnL)
                  ? 'entry-insight-value--positive'
                  : 'entry-insight-value--negative'
                : ''
            }`}
          >
            {displayedDailyPnLText}
          </span>
        </div>
      </section>

      {!isEditMode && (
        <section className="image-import-panel">
          <div className="image-import-panel__header">
            <div>
              <h2 className="image-import-panel__title">图片识别导入</h2>
              <p className="image-import-panel__subtitle">上传券商持仓页、当日流水表，或包含左侧账户日汇总与右侧流水的组合截图，自动回填账户、银证转账和股票明细</p>
            </div>
            {(lastImportResult || importFile || importWarnings.length > 0) && (
              <div className="image-import-panel__header-actions">
                <button
                  type="button"
                  className="image-import-panel__clear"
                  onClick={() => clearImportedBackfill({
                    preserveImportDate: true,
                    clearStoreMessages: false,
                    notice: '已清空识别回填数据',
                  })}
                  disabled={store.loading || isImportingImage}
                >
                  清空识别回填
                </button>
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
                  updateImportFile(nextFile);
                  setImportError('');
                  setImportWarnings([]);
                  setImportNotice('');
                  setLastImportResult(null);
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
            当前版本支持同花顺手机端持仓页整屏截图、包含“当日买入/当日卖出/买入均价/卖出均价/收盘价”的当日流水表截图，以及左侧包含日期/总资产/净流入、右侧显示当日明细的组合截图。识别结果会先回填到统一录入表单，确认后再保存入库。
          </p>

          {importError && <div className="entry-error-banner">{importError}</div>}
          {importNotice && <div className="entry-success-banner">{importNotice}</div>}

          {lastImportResult && (
            <>
              <div className="image-import-panel__summary">
                <span>账户汇总：{lastImportResult.account ? '已识别' : '未识别完整'}</span>
                <span>银证流水：{lastImportResult.bankFlow ? `${lastImportResult.bankFlow.flowType} ${lastImportResult.bankFlow.amount}` : '未识别/无净流入'}</span>
                <span>股票条数：{lastImportResult.positions.length}</span>
                <span>回填日期：{lastImportResult.recognizedDate?.split('T')[0] || importDate}</span>
              </div>

              {importPreviewUrl && (
                <div className="image-import-panel__preview">
                  <div className="image-import-panel__preview-header">
                    <p className="image-import-panel__preview-title">识别原图</p>
                    <span className="image-import-panel__preview-tip">识别完成后保留图片，方便你对照检查回填结果</span>
                  </div>
                  <img
                    src={importPreviewUrl}
                    alt="识别截图预览"
                    className="image-import-panel__preview-image"
                  />
                </div>
              )}
            </>
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
      {showAccountSection && (
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
      {showBankFlowSection && (
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
      {showTradeSection && (
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

                {(Number(row.buyQuantity) > 0 || Number(row.sellQuantity) > 0) && (
                  <div className="trade-row-flow">
                    <span>当日买入 {Number(row.buyQuantity || 0).toLocaleString()} 股 @ {Number(row.buyPrice || 0).toFixed(3)}</span>
                    <span>当日卖出 {Number(row.sellQuantity || 0).toLocaleString()} 股 @ {Number(row.sellPrice || 0).toFixed(3)}</span>
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
