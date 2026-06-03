import { useCallback, useEffect, useRef, useState } from 'react';
import TablePagination from '../components/Table/TablePagination';
import StockHistoryLink from '../components/StockHistoryLink';
import {
  portfolioImportAuditService,
  type PortfolioImportAuditDetail,
  type PortfolioImportAuditListItem,
} from '../services/PortfolioImportAuditService';
import { extractDatePart } from '../utils/date';
import './PortfolioImportAuditPage.css';

const STATUS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待入库' },
  { key: 'success', label: '已成功' },
  { key: 'partial', label: '部分成功' },
  { key: 'failed', label: '保存失败' },
  { key: 'parse-failed', label: '识别失败' },
] as const;

const formatBytes = (value: number) => {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const getStatusLabel = (item: Pick<PortfolioImportAuditListItem, 'parseSuccess' | 'saveAttempted' | 'saveStatus'>) => {
  if (!item.parseSuccess) {
    return '识别失败';
  }

  if (!item.saveAttempted) {
    return '待入库';
  }

  if (item.saveStatus === 'success') {
    return '已成功';
  }

  if (item.saveStatus === 'partial') {
    return '部分成功';
  }

  return '保存失败';
};

const PortfolioImportAuditPage = () => {
  const initialAuditId = Number(new URLSearchParams(window.location.search).get('id') || 0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [saveStatus, setSaveStatus] = useState<(typeof STATUS_FILTERS)[number]['key']>('all');
  const [items, setItems] = useState<PortfolioImportAuditListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(initialAuditId || null);
  const [detail, setDetail] = useState<PortfolioImportAuditDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [detailRefreshNonce, setDetailRefreshNonce] = useState(0);
  const imageUrlRef = useRef('');

  const revokeImageUrl = useCallback(() => {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = '';
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await portfolioImportAuditService.getAudits({
        page,
        pageSize,
        saveStatus,
      });

      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);

      if (!selectedAuditId && data.items.length > 0) {
        setSelectedAuditId(data.items[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载识别审计列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, saveStatus, selectedAuditId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    let active = true;

    const loadDetail = async () => {
      if (!selectedAuditId) {
        setDetail(null);
        setDetailError('');
        return;
      }

      setDetailLoading(true);
      setDetailError('');

      try {
        const nextDetail = await portfolioImportAuditService.getAuditDetail(selectedAuditId);
        if (!active) {
          return;
        }

        setDetail(nextDetail);

        revokeImageUrl();
        setImageUrl('');

        if (nextDetail.hasImage) {
          const blob = await portfolioImportAuditService.getAuditImageBlob(selectedAuditId);
          if (!active) {
            return;
          }

          const nextImageUrl = URL.createObjectURL(blob);
          imageUrlRef.current = nextImageUrl;
          setImageUrl(nextImageUrl);
        }
      } catch (err) {
        if (active) {
          setDetailError(err instanceof Error ? err.message : '加载识别审计详情失败');
          setDetail(null);
        }
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [detailRefreshNonce, revokeImageUrl, selectedAuditId]);

  useEffect(() => () => {
    revokeImageUrl();
  }, [revokeImageUrl]);

  return (
    <div className="pia-container">
      <header className="pia-header">
        <div>
          <h1 className="pia-title">图片识别审计</h1>
          <p className="pia-subtitle">这里只展示走过 OCR 导入的新记录。历史手工录入不会出现在这里，也不需要补原图。</p>
        </div>
        <button
          type="button"
          className="pia-refresh-btn"
          onClick={() => {
            void loadList();
            setDetailRefreshNonce(value => value + 1);
          }}
          disabled={loading || detailLoading}
        >
          {loading ? '加载中...' : '刷新审计'}
        </button>
      </header>

      <main className="pia-main">
        <section className="pia-list-panel">
          <div className="pia-info-banner">
            <strong>历史手工记录继续可用。</strong>
            <span>之前手动录入的账户、银证和交易数据仍然会参与统计与体检；这个页面只负责回看后续图片识别链路。</span>
          </div>

          <div className="pia-toolbar">
            <div className="pia-filter-group">
              {STATUS_FILTERS.map(filter => (
                <button
                  key={filter.key}
                  type="button"
                  className={`pia-filter-btn ${saveStatus === filter.key ? 'pia-filter-btn--active' : ''}`.trim()}
                  onClick={() => {
                    setSaveStatus(filter.key);
                    setPage(1);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="pia-toolbar__meta">共 {total} 条审计记录</div>
          </div>

          {error && (
            <div className="pia-error">
              <span>{error}</span>
              <button type="button" onClick={() => void loadList()}>重试</button>
            </div>
          )}

          {loading && items.length === 0 && !error ? (
            <div className="pia-empty">正在加载识别审计列表...</div>
          ) : items.length === 0 ? (
            <div className="pia-empty">当前筛选条件下没有 OCR 审计记录。历史手工录入数据不在这里查看，可到数据体检页检查异常。</div>
          ) : (
            <>
              <div className="pia-list">
                {items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={`pia-list-item ${selectedAuditId === item.id ? 'pia-list-item--active' : ''}`.trim()}
                    onClick={() => setSelectedAuditId(item.id)}
                  >
                    <div className="pia-list-item__top">
                      <span className={`pia-status pia-status--${item.parseSuccess ? item.saveStatus || 'pending' : 'failed'}`}>
                        {getStatusLabel(item)}
                      </span>
                      <span className="pia-list-item__id">#{item.id}</span>
                    </div>
                    <p className="pia-list-item__file">{item.sourceFileName}</p>
                    <div className="pia-list-item__meta">
                      <span>识别日 {extractDatePart(item.recognizedDate || item.importDate || item.createdAt)}</span>
                      <span>{item.positionCount} 条心魔</span>
                      <span>{formatBytes(item.fileSize)}</span>
                    </div>
                    <p className="pia-list-item__message">{item.parseMessage}</p>
                  </button>
                ))}
              </div>
              <TablePagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                onPageChange={setPage}
              />
            </>
          )}
        </section>

        <section className="pia-detail-panel">
          {detailError && (
            <div className="pia-error">
              <span>{detailError}</span>
            </div>
          )}

          {detailLoading && !detail ? (
            <div className="pia-empty">正在加载审计详情...</div>
          ) : detail ? (
            <div className="pia-detail">
              <div className="pia-detail__hero">
                <div>
                  <div className="pia-detail__title-row">
                    <h2 className="pia-detail__title">{detail.sourceFileName}</h2>
                    <span className={`pia-status pia-status--${detail.parseSuccess ? detail.saveStatus || 'pending' : 'failed'}`}>
                      {getStatusLabel(detail)}
                    </span>
                  </div>
                  <p className="pia-detail__subtitle">
                    审计 #{detail.id} · 识别时间 {extractDatePart(detail.recognizedDate || detail.importDate || detail.createdAt)} · 图片大小 {formatBytes(detail.fileSize)}
                  </p>
                </div>
              </div>

              <div className="pia-detail__cards">
                <article className="pia-mini-card">
                  <p className="pia-mini-card__label">识别结果</p>
                  <p className="pia-mini-card__value">{detail.parseSuccess ? '成功' : '失败'}</p>
                  <p className="pia-mini-card__sub">{detail.parseMessage}</p>
                </article>
                <article className="pia-mini-card">
                  <p className="pia-mini-card__label">入库状态</p>
                  <p className="pia-mini-card__value">{getStatusLabel(detail)}</p>
                  <p className="pia-mini-card__sub">请求 {detail.requestedTradeCount} 条，已保存 {detail.savedTradeCount} 条</p>
                </article>
                <article className="pia-mini-card">
                  <p className="pia-mini-card__label">告警数量</p>
                  <p className="pia-mini-card__value">{detail.warningCount}</p>
                  <p className="pia-mini-card__sub">识别到 {detail.positionCount} 条心魔明细</p>
                </article>
              </div>

              {imageUrl ? (
                <section className="pia-block">
                  <div className="pia-block__header">
                    <h3>识别原图</h3>
                    <span>方便逐项对照 OCR 与最终入库结果</span>
                  </div>
                  <img src={imageUrl} alt="识别原图" className="pia-image" />
                </section>
              ) : null}

              {detail.recognizedPayload ? (
                <section className="pia-block">
                  <div className="pia-block__header">
                    <h3>识别结果摘要</h3>
                    <span>账户、银证和右侧流水的首次解析结果</span>
                  </div>
                  <div className="pia-summary-grid">
                    <div className="pia-summary-chip">账户 {detail.recognizedPayload.account ? '已识别' : '缺失'}</div>
                    <div className="pia-summary-chip">银证 {detail.recognizedPayload.bankFlow ? '已识别' : '缺失'}</div>
                    <div className="pia-summary-chip">心魔 {detail.recognizedPayload.positions.length} 条</div>
                    <div className="pia-summary-chip">回填日期 {extractDatePart(detail.recognizedPayload.recognizedDate || detail.importDate || detail.createdAt)}</div>
                  </div>

                  {detail.recognizedPayload.positions.length > 0 && (
                    <div className="pia-position-list">
                      {detail.recognizedPayload.positions.map(position => (
                        <article key={`${position.stockCode}-${position.stockName}`} className="pia-position-item">
                          <div className="pia-position-item__top">
                            <StockHistoryLink stockCode={position.stockCode} stockName={position.stockName} />
                            <span>{position.isLiquidated ? '清仓' : '持仓'}</span>
                          </div>
                          <p className="pia-position-item__meta">
                            买 {position.buyQuantity} @ {position.buyPrice}，卖 {position.sellQuantity} @ {position.sellPrice}，持仓 {position.positionQuantity}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {detail.saveResult ? (
                <section className="pia-block">
                  <div className="pia-block__header">
                    <h3>最终入库结果</h3>
                    <span>{detail.saveResult.saveCompletedAt ? `完成时间 ${extractDatePart(detail.saveResult.saveCompletedAt)}` : '尚未回填最终结果'}</span>
                  </div>
                  <p className="pia-save-message">{detail.saveResult.saveMessage || '暂无说明'}</p>
                  {detail.saveResult.saveErrors.length > 0 && (
                    <ul className="pia-error-list">
                      {detail.saveResult.saveErrors.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              {detail.recognizedText ? (
                <section className="pia-block">
                  <div className="pia-block__header">
                    <h3>OCR 原始文本</h3>
                    <span>出问题时最适合拿来排查日期、价格和列头偏移</span>
                  </div>
                  <pre className="pia-pre">{detail.recognizedText}</pre>
                </section>
              ) : null}

              {detail.finalPayload ? (
                <section className="pia-block">
                  <div className="pia-block__header">
                    <h3>最终提交载荷</h3>
                    <span>统一录入页点击“一键保存识别结果”时真正提交的内容</span>
                  </div>
                  <pre className="pia-pre">{JSON.stringify(detail.finalPayload, null, 2)}</pre>
                </section>
              ) : null}
            </div>
          ) : (
            <div className="pia-empty">左侧选择一条审计记录后，这里会显示原图、识别结果和最终入库结果。</div>
          )}
        </section>
      </main>
    </div>
  );
};

export default PortfolioImportAuditPage;
