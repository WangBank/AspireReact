export const formatTime = (value: string | null | undefined) => {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatLastSeen = (isOnline: boolean, lastSeenAt: string | null | undefined) => {
  if (isOnline) {
    return '在线';
  }

  if (!lastSeenAt) {
    return '离线';
  }

  return `最近活跃 ${formatTime(lastSeenAt)}`;
};
