import type { ReactNode } from 'react';
import type { SortOrder } from '../../utils/table';
import './TableControls.css';

interface SortableHeaderProps<Field extends string> {
  field: Field;
  currentField: Field;
  currentOrder: SortOrder;
  onSort: (field: Field) => void;
  children: ReactNode;
  className?: string;
  inactiveIndicator?: string;
}

const SortableHeader = <Field extends string>({
  field,
  currentField,
  currentOrder,
  onSort,
  children,
  className = '',
  inactiveIndicator = '↕',
}: SortableHeaderProps<Field>) => {
  const isActive = currentField === field;
  const indicator = isActive
    ? currentOrder === 'asc' ? '↑' : '↓'
    : inactiveIndicator;

  return (
    <th
      className={`table-sortable ${isActive ? 'table-sortable--active' : ''} ${className}`.trim()}
      onClick={() => onSort(field)}
    >
      <span className="table-sortable__label">
        <span>{children}</span>
        <span className="table-sortable__indicator">{indicator}</span>
      </span>
    </th>
  );
};

export default SortableHeader;
