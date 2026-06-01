import { useEffect, useState } from 'react';
import StockHistoryLink from '../components/StockHistoryLink';
import { dataHealthService, type DataHealthFinding, type DataHealthReport } from '../services/DataHealthService';
import { extractDatePart } from '../utils/date';
import './DataHealthPage.css';

const SEVERITY_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'error', label: '错误' },
  { key: 'warning', label: '提醒' },
  { key: 'info', label: '信息' },
] as const;

const formatMetricValue = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }

  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value);
};

const getSeverityLabel = (severity: DataHealthFinding['severity']) => {
  if (severity === 'error') {
    return '错误';
  }

  if (severity === 'warning') {
    return '提醒';
  }

  return '信息';
};

const DataHealthPage = () => {
  const [report, setReport] = useState<DataHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState<(typeof SEVERITY_FILTERS)[number]['key']>('all');

  const fetchReport = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await dataHealthService.getReport();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据体检失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, []);

  const findings = report?.findings ?? [];
  const visibleFindings = severityFilter === 'all'
    ? findings
    : findings.filter(item => item.severity === severityFilter);

  return (
    <div className="dhp-container">
      <header className="dhp-header">
        <div>
          <h1 className="dhp-title">数据体检</h1>
          <p className="dhp-subtitle">把历史脏数据、OCR 未落库记录、盈亏对不上的日期集中翻出来。历史手工录入的数据直接从库里体检，不要求补原图。</p>
        </div>
        <button
          type="button"
          className="dhp-refresh-btn"
          onClick={() => void fetchReport()}
          disabled={loading}
        >
          {loading ? '体检中...' : '重新体检'}
        </button>
      </header>

      <main className="dhp-main">
        {error && (
          <div className="dhp-error">
            <span>{error}</span>
            <button type="button" onClick={() => void fetchReport()}>
              重试
            </button>
          </div>
        )}

        {report && (
          <>
            <section className="dhp-notice">
              <strong>历史手工数据不受图片审计限制。</strong>
              <span>你之前手动录入的几百条记录仍会正常参与统计和体检；“图片识别审计”只覆盖从现在开始走 OCR 导入的新记录。</span>
            </section>

            <section className="dhp-cards">
              <article className="dhp-card">
                <p className="dhp-card__label">问题总数</p>
                <p className="dhp-card__value">{report.totalFindings}</p>
                <p className="dhp-card__sub">本次体检生成于 {extractDatePart(report.generatedAt)}</p>
              </article>
              <article className="dhp-card">
                <p className="dhp-card__label">高优先级错误</p>
                <p className="dhp-card__value dhp-card__value--error">{report.errorCount}</p>
                <p className="dhp-card__sub">建议优先修复这部分，再看统计结果。</p>
              </article>
              <article className="dhp-card">
                <p className="dhp-card__label">图片审计（仅 OCR）</p>
                <p className="dhp-card__value">{report.auditCount}</p>
                <p className="dhp-card__sub">待入库 {report.pendingAuditCount}，异常 {report.failedAuditCount}。历史手工录入不需要补图。</p>
              </article>
              <article className="dhp-card">
                <p className="dhp-card__label">历史录入覆盖</p>
                <p className="dhp-card__value">{report.tradeDayCount}</p>
                <p className="dhp-card__sub">账户 {report.accountDayCount} 天，银证 {report.bankFlowDayCount} 天</p>
              </article>
            </section>

            <section className="dhp-toolbar">
              <div className="dhp-filter-group">
                {SEVERITY_FILTERS.map(filter => (
                  <button
                    key={filter.key}
                    type="button"
                    className={`dhp-filter-btn ${severityFilter === filter.key ? 'dhp-filter-btn--active' : ''}`.trim()}
                    onClick={() => setSeverityFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="dhp-toolbar__meta">
                当前展示 {visibleFindings.length} / {findings.length} 条
              </div>
            </section>

            {visibleFindings.length === 0 ? (
              <div className="dhp-empty">当前筛选条件下没有异常。</div>
            ) : (
              <section className="dhp-findings">
                {visibleFindings.map((finding, index) => (
                  <article
                    key={`${finding.title}-${finding.businessDate || 'na'}-${index}`}
                    className={`dhp-finding dhp-finding--${finding.severity}`}
                  >
                    <div className="dhp-finding__top">
                      <span className={`dhp-severity dhp-severity--${finding.severity}`}>{getSeverityLabel(finding.severity)}</span>
                      <span className="dhp-finding__category">{finding.category}</span>
                      {finding.businessDate ? (
                        <span className="dhp-finding__date">{extractDatePart(finding.businessDate)}</span>
                      ) : null}
                    </div>
                    <h2 className="dhp-finding__title">{finding.title}</h2>
                    <p className="dhp-finding__desc">{finding.description}</p>

                    {(finding.stockCode || finding.stockName) && (
                      <div className="dhp-finding__stock">
                        <span>关联股票：</span>
                        <StockHistoryLink stockCode={finding.stockCode} stockName={finding.stockName} />
                        {finding.stockCode ? <span className="dhp-finding__code">（{finding.stockCode}）</span> : null}
                      </div>
                    )}

                    {(finding.currentValue != null || finding.expectedValue != null || finding.difference != null) && (
                      <div className="dhp-finding__metrics">
                        {finding.currentValue != null ? <span>当前值 {formatMetricValue(finding.currentValue)}</span> : null}
                        {finding.expectedValue != null ? <span>期望值 {formatMetricValue(finding.expectedValue)}</span> : null}
                        {finding.difference != null ? <span>差额 {formatMetricValue(finding.difference)}</span> : null}
                      </div>
                    )}

                    {finding.suggestedAction ? (
                      <p className="dhp-finding__action">建议：{finding.suggestedAction}</p>
                    ) : null}
                  </article>
                ))}
              </section>
            )}
          </>
        )}

        {loading && !report && !error && (
          <div className="dhp-loading">
            <div className="dhp-loading__spinner" />
            <span>正在扫描历史数据...</span>
          </div>
        )}
      </main>
    </div>
  );
};

export default DataHealthPage;
