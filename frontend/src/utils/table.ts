export type SortOrder = 'asc' | 'desc';

export type SortableValue = string | number | boolean | Date | null | undefined;

export interface SortDescriptor<T> {
  getValue: (item: T) => SortableValue;
  order?: SortOrder;
}

const stringCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

const normalizeSortableValue = (value: SortableValue): string | number | null => {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  return value;
};

export const compareSortableValues = (
  leftValue: SortableValue,
  rightValue: SortableValue,
  order: SortOrder = 'asc'
): number => {
  const left = normalizeSortableValue(leftValue);
  const right = normalizeSortableValue(rightValue);

  if (left == null && right == null) {
    return 0;
  }

  if (left == null) {
    return 1;
  }

  if (right == null) {
    return -1;
  }

  let result = 0;
  if (typeof left === 'number' && typeof right === 'number') {
    result = left - right;
  } else {
    result = stringCollator.compare(String(left), String(right));
  }

  if (result === 0) {
    return 0;
  }

  return order === 'asc' ? result : -result;
};

export const sortItemsBy = <T>(items: T[], descriptors: SortDescriptor<T>[]): T[] => {
  if (descriptors.length === 0) {
    return [...items];
  }

  return [...items].sort((leftItem, rightItem) => {
    for (const descriptor of descriptors) {
      const result = compareSortableValues(
        descriptor.getValue(leftItem),
        descriptor.getValue(rightItem),
        descriptor.order ?? 'asc'
      );

      if (result !== 0) {
        return result;
      }
    }

    return 0;
  });
};

export const paginateItems = <T>(items: T[], page: number, pageSize: number): T[] => {
  const safePageSize = Math.max(1, pageSize);
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * safePageSize;
  return items.slice(start, start + safePageSize);
};

export const getTotalPages = (totalCount: number, pageSize: number): number => {
  const safePageSize = Math.max(1, pageSize);
  return Math.max(1, Math.ceil(totalCount / safePageSize));
};

export const clampPage = (page: number, totalPages: number): number => {
  return Math.max(1, Math.min(page, Math.max(1, totalPages)));
};

export type PaginationItem = number | 'ellipsis-left' | 'ellipsis-right';

export const buildPaginationItems = (
  totalPages: number,
  currentPage: number,
  siblingCount = 1
): PaginationItem[] => {
  const safeTotalPages = Math.max(1, totalPages);
  if (safeTotalPages <= 7) {
    return Array.from({ length: safeTotalPages }, (_, index) => index + 1);
  }

  const items: PaginationItem[] = [1];
  const start = Math.max(2, currentPage - siblingCount);
  const end = Math.min(safeTotalPages - 1, currentPage + siblingCount);

  if (start > 2) {
    items.push('ellipsis-left');
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (end < safeTotalPages - 1) {
    items.push('ellipsis-right');
  }

  items.push(safeTotalPages);
  return items;
};

export const nextSortState = <Field extends string>(
  currentField: Field,
  currentOrder: SortOrder,
  nextField: Field,
  defaultOrder: SortOrder = 'desc'
): { field: Field; order: SortOrder } => {
  if (currentField === nextField) {
    return {
      field: currentField,
      order: currentOrder === 'asc' ? 'desc' : 'asc',
    };
  }

  return {
    field: nextField,
    order: defaultOrder,
  };
};
