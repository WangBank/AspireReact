import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useStore } from '../stores/StoreProvider';
import './AccountEntryPage.css';

const BankFlowEntryPage = observer(() => {
  const { bankFlowEntryStore } = useStore();

  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [flowType, setFlowType] = useState<'转入' | '转出'>('转入');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!date) newErrors.date = '请选择日期';
    if (amount === '' || isNaN(Number(amount)) || Number(amount) <= 0)
      newErrors.amount = '请输入大于0的金额';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    bankFlowEntryStore.clearMessages();
    await bankFlowEntryStore.submit({
      date,
      flowType,
      amount: Number(amount),
      remark: remark.trim() || undefined,
    });
    if (!bankFlowEntryStore.error) {
      setDate(today);
      setFlowType('转入');
      setAmount('');
      setRemark('');
      setErrors({});
    }
  };

  return (
    <div className="entry-page-container">
      <h1 className="entry-page-title">银证流水录入</h1>
      <p className="entry-page-subtitle">录入银行与证券账户间的转账流水</p>

      <form className="entry-form" onSubmit={handleSubmit} noValidate>
        {bankFlowEntryStore.error && (
          <div className="entry-error-banner" role="alert">
            {bankFlowEntryStore.error}
          </div>
        )}
        {bankFlowEntryStore.successMessage && (
          <div className="entry-success-banner" role="status">
            {bankFlowEntryStore.successMessage}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="bf-date" className="form-label">日期 <span className="required-star">*</span></label>
          <input
            id="bf-date"
            type="date"
            className={`form-input ${errors.date ? 'form-input-error' : ''}`}
            value={date}
            onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: '' })); }}
          />
          {errors.date && <span className="form-error">{errors.date}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">流水类型 <span className="required-star">*</span></label>
          <div className="radio-group">
            <label className={`radio-label ${flowType === '转入' ? 'radio-label-active' : ''}`}>
              <input
                type="radio"
                name="flowType"
                value="转入"
                checked={flowType === '转入'}
                onChange={() => setFlowType('转入')}
                className="radio-input"
              />
              <span className="radio-custom" />
              <span className="radio-text">转入</span>
            </label>
            <label className={`radio-label ${flowType === '转出' ? 'radio-label-active' : ''}`}>
              <input
                type="radio"
                name="flowType"
                value="转出"
                checked={flowType === '转出'}
                onChange={() => setFlowType('转出')}
                className="radio-input"
              />
              <span className="radio-custom" />
              <span className="radio-text">转出</span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="bf-amount" className="form-label">金额（元） <span className="required-star">*</span></label>
          <input
            id="bf-amount"
            type="number"
            step="0.01"
            min="0.01"
            className={`form-input ${errors.amount ? 'form-input-error' : ''}`}
            placeholder="0.00"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: '' })); }}
          />
          {errors.amount && <span className="form-error">{errors.amount}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="bf-remark" className="form-label">备注</label>
          <textarea
            id="bf-remark"
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
          disabled={bankFlowEntryStore.loading}
        >
          {bankFlowEntryStore.loading ? '提交中...' : '提交录入'}
        </button>
      </form>
    </div>
  );
});

export default BankFlowEntryPage;