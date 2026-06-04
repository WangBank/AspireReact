import { useState, useCallback, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import './Layout.css';

interface NavLinkItem {
  label: string;
  path: string;
  type: 'link';
}

const NAV_ITEMS: NavLinkItem[] = [
  { label: '首页', path: '/dashboard', type: 'link' },
  { label: '录入', path: '/entry/unified', type: 'link' },
  { label: '数据列表', path: '/list/unified', type: 'link' },
  { label: '统计', path: '/statistics', type: 'link' },
  { label: '体检', path: '/health', type: 'link' },
  { label: '审计', path: '/audits/imports', type: 'link' },
  { label: '全局笔记', path: '/notes/global', type: 'link' },
  { label: '心魔笔记', path: '/notes/stock', type: 'link' },
  { label: '吾日三省吾身', path: '/notes/reflection', type: 'link' },
  { label: '设置', path: '/config', type: 'link' },
];

const QUICK_ENTRY_PATH = '/entry/unified';
const isStandaloneDisplayMode = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || ((window.navigator as Navigator & { standalone?: boolean }).standalone ?? false);
const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isInstallPromptSupported = () => 'BeforeInstallPromptEvent' in window;

interface InstallGuideContent {
  title: string;
  description: string;
  steps: string[];
}

const Layout = observer(({ children }: { children: React.ReactNode }) => {
  const { authStore } = useStore();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installHint, setInstallHint] = useState('');
  const [installGuide, setInstallGuide] = useState<InstallGuideContent | null>(null);
  const [installCopyNotice, setInstallCopyNotice] = useState('');
  const [isStandaloneApp, setIsStandaloneApp] = useState(() => isStandaloneDisplayMode());
  const [isIosInstallTarget] = useState(() => isIosDevice());
  const isEntryRoute = location.pathname.startsWith('/entry');
  const showFloatingEntry = !isEntryRoute;
  const showInstallAction = !isStandaloneApp;

  const handleLogout = useCallback(() => {
    authStore.logout();
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    window.location.href = '/login';
  }, [authStore]);

  useEffect(() => {
    if (!userMenuOpen) return;

    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.navbar-user')) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  useEffect(() => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!installCopyNotice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setInstallCopyNotice('');
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [installCopyNotice]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setInstallPromptEvent(promptEvent);
      setInstallHint('');
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setInstallHint('应用已经安装到桌面，可以像原生应用一样直接打开。');
      setIsStandaloneApp(true);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      setIsStandaloneApp(isStandaloneDisplayMode());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const openInstallGuide = useCallback((content: InstallGuideContent) => {
    setInstallGuide(content);
    setInstallCopyNotice('');
    setMobileMenuOpen(false);
  }, []);

  const closeInstallGuide = useCallback(() => {
    setInstallGuide(null);
  }, []);

  const copyInstallLink = useCallback(async () => {
    const url = window.location.href;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('textarea');
        input.value = url;
        input.setAttribute('readonly', 'true');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }

      setInstallCopyNotice('当前地址已复制，可以去 Chrome / Edge / Safari 里打开安装。');
    } catch {
      setInstallCopyNotice(`复制失败，请手动复制当前地址：${url}`);
    }
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (isStandaloneApp) {
      setInstallHint('应用已经安装好了。');
      return;
    }

    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallHint('安装请求已提交，系统完成后就能从桌面直接打开。');
      } else {
        setInstallHint('这次先取消了，后面也可以随时再安装。');
      }

      setInstallPromptEvent(null);
      return;
    }

    if (isIosInstallTarget) {
      openInstallGuide({
        title: '请从 Safari 添加到主屏幕',
        description: 'iPhone 或 iPad 上通常不会弹出单独的安装窗口，需要从浏览器菜单手动添加。',
        steps: [
          '在 Safari 里打开当前地址。',
          '点击底部或顶部的“分享”按钮。',
          '选择“添加到主屏幕”，确认后即可像原生应用一样打开。',
        ],
      });
      return;
    }

    if (window.isSecureContext && isInstallPromptSupported()) {
      openInstallGuide({
        title: '当前浏览器没有弹出安装窗口',
        description: '这通常发生在嵌入式浏览器、受限 WebView，或者浏览器暂时没有把当前站点判断为可安装时。',
        steps: [
          '先复制当前地址。',
          '再用系统 Chrome 或 Edge 打开这个地址。',
          '从地址栏右侧或浏览器菜单里选择“安装应用”或“添加到桌面”。',
        ],
      });
      return;
    }

    openInstallGuide({
      title: '当前环境不支持直接安装',
      description: '像 Codex 内置浏览器这类嵌入式浏览器，通常不会触发 PWA 的系统安装提示，所以看起来会像“没反应”。',
      steps: [
        '先复制当前地址。',
        '再用系统 Chrome、Edge 或 Safari 打开这个地址。',
        '在浏览器菜单里选择“安装应用”或“添加到主屏幕”。',
      ],
    });
  }, [installPromptEvent, isIosInstallTarget, isStandaloneApp, openInstallGuide]);

  const avatarLetter = (authStore.username ?? '?').charAt(0).toUpperCase();

  return (
    <div className="layout-container">
      <nav className="navbar">
        <div className="navbar-main">
          <NavLink to="/dashboard" className="navbar-brand">
            <div className="navbar-brand__icon">S</div>
            <span className="navbar-brand__text">心魔录</span>
          </NavLink>

          <ul className="navbar-links">
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `navbar-link${isActive ? ' navbar-link--active' : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="navbar-actions">
          <NavLink
            to={QUICK_ENTRY_PATH}
            className={`navbar-entry-cta${isEntryRoute ? ' navbar-entry-cta--active' : ''}`}
          >
            <span className="navbar-entry-cta__icon" aria-hidden="true">
              +
            </span>
            <span className="navbar-entry-cta__body">
              <span className="navbar-entry-cta__title">快捷录入</span>
              <span className="navbar-entry-cta__meta">OCR / 手动一体</span>
            </span>
          </NavLink>

          {showInstallAction && (
            <button
              type="button"
              className="navbar-install-cta"
              onClick={handleInstallApp}
              title="安装心魔录到桌面"
            >
              <span className="navbar-install-cta__icon" aria-hidden="true">
                ↓
              </span>
              <span className="navbar-install-cta__body">
                <span className="navbar-install-cta__title">安装应用</span>
                <span className="navbar-install-cta__meta">桌面直达 / 离线可开</span>
              </span>
            </button>
          )}

          <div className="navbar-user">
            <button
              className="navbar-user__trigger"
              onClick={() => setUserMenuOpen((value) => !value)}
              type="button"
              aria-haspopup="true"
              aria-expanded={userMenuOpen}
            >
              <div className="navbar-user__avatar">{avatarLetter}</div>
              <span className="navbar-user__name">{authStore.username ?? '用户'}</span>
              <span className={`navbar-user__arrow${userMenuOpen ? ' navbar-user__arrow--open' : ''}`}>▾</span>
            </button>

            {userMenuOpen && (
              <div className="navbar-user__menu">
                <button
                  className="navbar-user__menu-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    window.location.href = '/profile';
                  }}
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  个人信息
                </button>
                <div className="navbar-user__menu-divider" />
                <button
                  className="navbar-user__menu-item navbar-user__menu-item--danger"
                  onClick={handleLogout}
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  退出登录
                </button>
              </div>
            )}
          </div>

          <button
            className={`navbar-mobile-toggle${mobileMenuOpen ? ' navbar-mobile-toggle--active' : ''}`}
            onClick={() => setMobileMenuOpen((value) => !value)}
            type="button"
            aria-label="打开导航菜单"
            aria-expanded={mobileMenuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <button
        className={`navbar-mobile-backdrop${mobileMenuOpen ? ' navbar-mobile-backdrop--visible' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        type="button"
        aria-label="关闭导航遮罩"
      />

      <aside className={`navbar-mobile-drawer${mobileMenuOpen ? ' navbar-mobile-drawer--open' : ''}`}>
        <div className="navbar-mobile-drawer__header">
          <div>
            <div className="navbar-mobile-drawer__title">心魔录</div>
            <div className="navbar-mobile-drawer__subtitle">欢迎回来，{authStore.username ?? '用户'}</div>
          </div>
          <button
            className="navbar-mobile-drawer__close"
            onClick={() => setMobileMenuOpen(false)}
            type="button"
            aria-label="关闭导航菜单"
          >
            ×
          </button>
        </div>

        <div className="navbar-mobile-drawer__content">
          <NavLink
            to={QUICK_ENTRY_PATH}
            className={`navbar-mobile-entry${isEntryRoute ? ' navbar-mobile-entry--active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="navbar-mobile-entry__icon" aria-hidden="true">
              +
            </span>
            <span className="navbar-mobile-entry__body">
              <span className="navbar-mobile-entry__title">快捷录入</span>
              <span className="navbar-mobile-entry__meta">直接进入统一录入页</span>
            </span>
          </NavLink>

          {showInstallAction && (
            <button
              type="button"
              className="navbar-mobile-install"
              onClick={handleInstallApp}
            >
              <span className="navbar-mobile-install__icon" aria-hidden="true">
                ↓
              </span>
              <span className="navbar-mobile-install__body">
                <span className="navbar-mobile-install__title">安装应用</span>
                <span className="navbar-mobile-install__meta">把心魔录添加到桌面</span>
              </span>
            </button>
          )}

          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `navbar-mobile-link${isActive ? ' navbar-mobile-link--active' : ''}`
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="navbar-mobile-drawer__footer">
          {installHint && <div className="navbar-install-hint navbar-install-hint--mobile">{installHint}</div>}
          <button
            className="navbar-mobile-action"
            onClick={() => {
              setMobileMenuOpen(false);
              window.location.href = '/profile';
            }}
            type="button"
          >
            个人信息
          </button>
          <button
            className="navbar-mobile-action navbar-mobile-action--danger"
            onClick={handleLogout}
            type="button"
          >
            退出登录
          </button>
        </div>
      </aside>

      {installHint && <div className="navbar-install-hint">{installHint}</div>}

      {installGuide && (
        <>
          <button
            type="button"
            className="install-guide-backdrop"
            aria-label="关闭安装说明"
            onClick={closeInstallGuide}
          />
          <section
            className="install-guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-guide-title"
          >
            <div className="install-guide-modal__header">
              <div>
                <h2 id="install-guide-title" className="install-guide-modal__title">{installGuide.title}</h2>
                <p className="install-guide-modal__desc">{installGuide.description}</p>
              </div>
              <button
                type="button"
                className="install-guide-modal__close"
                onClick={closeInstallGuide}
                aria-label="关闭安装说明"
              >
                ×
              </button>
            </div>

            <ol className="install-guide-modal__steps">
              {installGuide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <div className="install-guide-modal__url">
              <span className="install-guide-modal__url-label">当前地址</span>
              <code className="install-guide-modal__url-value">{window.location.href}</code>
            </div>

            {installCopyNotice && (
              <div className="install-guide-modal__notice">{installCopyNotice}</div>
            )}

            <div className="install-guide-modal__actions">
              <button
                type="button"
                className="install-guide-modal__primary"
                onClick={copyInstallLink}
              >
                复制当前地址
              </button>
              <button
                type="button"
                className="install-guide-modal__secondary"
                onClick={closeInstallGuide}
              >
                我知道了
              </button>
            </div>
          </section>
        </>
      )}

      <main className="layout-content">
        {children}
      </main>

      {showFloatingEntry && (
        <NavLink to={QUICK_ENTRY_PATH} className="floating-entry-button" aria-label="进入快捷录入页面">
          <span className="floating-entry-button__icon" aria-hidden="true">
            +
          </span>
          <span className="floating-entry-button__text">快捷录入</span>
        </NavLink>
      )}
    </div>
  );
});

export default Layout;
