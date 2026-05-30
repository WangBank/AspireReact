import { buildPaginationItems } from '../../utils/table';
import './TableControls.css';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  infoText?: string;
}

const TablePagination = ({
  page,
  totalPages,
  totalItems,
  onPageChange,
  infoText,
}: TablePaginationProps) => {
  if (totalPages <= 1) {
    return null;
  }

  const items = buildPaginationItems(totalPages, page);

  return (
    <div className="table-pagination">
      <button
        type="button"
        className="table-pagination__button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ‹ 上一页
      </button>
      {items.map((item, index) => (
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            className={`table-pagination__button ${item === page ? 'table-pagination__button--active' : ''}`.trim()}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ) : (
          <span key={`${item}-${index}`} className="table-pagination__ellipsis">…</span>
        )
      ))}
      <button
        type="button"
        className="table-pagination__button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        下一页 ›
      </button>
      <span className="table-pagination__info">
        {infoText ?? `共 ${totalItems} 条，第 ${page}/${totalPages} 页`}
      </span>
    </div>
  );
};

export default TablePagination;
