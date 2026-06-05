import { useEffect, useState, useSyncExternalStore } from 'react';
import { networkActivity } from '../utils/networkActivity';

const GlobalLoadingMask = () => {
  const activeRequestCount = useSyncExternalStore(
    networkActivity.subscribe,
    networkActivity.getSnapshot,
    networkActivity.getSnapshot,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (activeRequestCount <= 0) {
      setVisible(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeRequestCount]);

  if (!visible) {
    return null;
  }

  return (
    <div className="global-loading-mask" aria-live="polite" aria-busy="true">
      <div className="global-loading-mask__panel">
        <div className="global-loading-mask__spinner" />
        <div className="global-loading-mask__text">
          <strong>正在同步数据</strong>
          <span>请求处理中，请稍候…</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalLoadingMask;
