export const TRADE_TAG_OPTIONS = [
  '龙头',
  '跟风',
  '低吸',
  '打板',
  '半路',
  '反包',
  '趋势',
  '套利',
  '做T',
  '模式外',
  '心急',
  '格局过头',
] as const;

export const normalizeTradeTags = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  tags.forEach((tag) => {
    const normalized = tag.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  });

  return result.slice(0, 20);
};
