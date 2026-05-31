import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import { formatLocalDate } from '../utils/date';
import './AccountEntryPage.css';

const AccountEntryPage = observer(() => {
  const { accountEntryStore } = useStore();

  const today = formatLocalDate();
  const [date, setDate] = useState(today);
  const [totalAssets, setTotalAssets] = useState('');
  const [positionValue, setPositionValue] = useState('');
  const [availableFunds, setAvailableFunds] = useState('');
  const [dailyPnL, setDailyPnL] = useState('');
  const [remark, setRemark] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const totalAssetsValue = totalAssets === '' ? null : Number(totalAssets);
  const positionValueValue = positionValue === '' ? null : Number(positionValue);
  const availableFundsValue = availableFunds === '' ? null : Number(availableFunds);
  const accountBalanceDiff = totalAssetsValue != null
    && positionValueValue != null
    && availableFundsValue != null
    && !Number.isNaN(totalAssetsValue)
    && !Number.isNaN(positionValueValue)
    && !Number.isNaN(availableFundsValue)
    ? totalAssetsValue - positionValueValue - availableFundsValue
    : null;
  const hasAccountBalanceWarning = accountBalanceDiff != null && Math.abs(accountBalanceDiff) >= 1;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!date) newErrors.date = '请选择日期';
    if (totalAssets === '' || isNaN(Number(totalAssets)) || Number(totalAssets) < 0)
      newErrors.totalAssets = '请输入有效的正数';
    if (positionValue === '' || isNaN(Number(positionValue)) || Number(positionValue) < 0)
      newErrors.positionValue = '请输入非负数';
    if (availableFunds === '' || isNaN(Number(availableFunds)) || Number(availableFunds) < 0)
      newErrors.availableFunds = '请输入非负数';
    if (dailyPnL === '' || isNaN(Number(dailyPnL)))
      newErrors.dailyPnL = '请输入数字';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    accountEntryStore.clearMessages();
    await accountEntryStore.submit({
      date,
      totalAssets: Number(totalAssets),
      positionValue: Number(positionValue),
      availableFunds: Number(availableFunds),
      dailyPnL: Number(dailyPnL),
      remark: remark.trim() || undefined,
    });
    if (!accountEntryStore.error) {
      setDate(today);
      setTotalAssets('');
      setPositionValue('');
      setAvailableFunds('');
      setDailyPnL('');
      setRemark('');
      setErrors({});
    }
  };

  return (
    <div className="entry-page-container">
      <h1 className="entry-page-title">账户资金录入</h1>
      <p className="entry-page-subtitle">录入每日账户资金快照</p>

      <form className="entry-form" onSubmit={handleSubmit} noValidate>
        {accountEntryStore.error && (
          <div className="entry-error-banner" role="alert">
            {accountEntryStore.error}
          </div>
        )}
        {accountEntryStore.successMessage && (
          <div className="entry-success-banner" role="status">
            {accountEntryStore.successMessage}
          </div>
        )}
        {hasAccountBalanceWarning && (
          <div className="entry-warning-banner" role="alert">
            当前总资产与持仓市值 + 可用资金相差 {accountBalanceDiff!.toFixed(2)} 元，请确认是否有识别遗漏、在途资金或手动录入误差。
          </div>
        )}

        <div className="form-group">
          <label htmlFor="ac-date" className="form-label">日期 <span className="required-star">*</span></label>
          <input
            id="ac-date"
            type="date"
            className={`form-input ${errors.date ? 'form-input-error' : ''}`}
            value={date}
            onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: '' })); }}
          />
          {errors.date && <span className="form-error">{errors.date}</span>}
        </div>

        <div className="form-row">
          <div className="form-group form-group-half">
            <label htmlFor="ac-total" className="form-label">总资产（元） <span className="required-star">*</span></label>
            <input
              id="ac-total"
              type="number"
              step="0.01"
              min="0"
              className={`form-input ${errors.totalAssets ? 'form-input-error' : ''}`}
              placeholder="0.00"
              value={totalAssets}
              onChange={(e) => { setTotalAssets(e.target.value); setErrors((p) => ({ ...p, totalAssets: '' })); }}
            />
            {errors.totalAssets && <span className="form-error">{errors.totalAssets}</span>}
          </div>

          <div className="form-group form-group-half">
            <label htmlFor="ac-position" className="form-label">持仓市值（元） <span className="required-star">*</span></label>
            <input
              id="ac-position"
              type="number"
              step="0.01"
              min="0"
              className={`form-input ${errors.positionValue ? 'form-input-error' : ''}`}
              placeholder="0.00"
              value={positionValue}
              onChange={(e) => { setPositionValue(e.target.value); setErrors((p) => ({ ...p, positionValue: '' })); }}
            />
            {errors.positionValue && <span className="form-error">{errors.positionValue}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group form-group-half">
            <label htmlFor="ac-available" className="form-label">可用资金（元） <span className="required-star">*</span></label>
            <input
              id="ac-available"
              type="number"
              step="0.01"
              min="0"
              className={`form-input ${errors.availableFunds ? 'form-input-error' : ''}`}
              placeholder="0.00"
              value={availableFunds}
              onChange={(e) => { setAvailableFunds(e.target.value); setErrors((p) => ({ ...p, availableFunds: '' })); }}
            />
            {errors.availableFunds && <span className="form-error">{errors.availableFunds}</span>}
          </div>

          <div className="form-group form-group-half">
            <label htmlFor="ac-pnl" className="form-label">当日盈亏（元） <span className="required-star">*</span></label>
            <input
              id="ac-pnl"
              type="number"
              step="0.01"
              className={`form-input ${errors.dailyPnL ? 'form-input-error' : ''}`}
              placeholder="0.00"
              value={dailyPnL}
              onChange={(e) => { setDailyPnL(e.target.value); setErrors((p) => ({ ...p, dailyPnL: '' })); }}
            />
            {errors.dailyPnL && <span className="form-error">{errors.dailyPnL}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="ac-remark" className="form-label">备注</label>
          <textarea
            id="ac-remark"
            className="form-textarea"
            placeholder="可选备注（最多500字）"
            value={remark}
            onChange={(e) => setRemark(e.target.value.slice(0, 500))}
            rows={3}
            maxLength={500}
          />
        </div>

        <button
          type="submit"
          className="entry-submit-btn"
          disabled={accountEntryStore.loading}
        >
          {accountEntryStore.loading ? '提交中...' : '提交录入'}
        </button>
      </form>
    </div>
  );
});

export default AccountEntryPage;
