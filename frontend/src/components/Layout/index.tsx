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

const Layout = observer(({ children }: { children: React.ReactNode }) => {
  const { authStore } = useStore();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

      <main className="layout-content">
        {children}
      </main>
    </div>
  );
});

export default Layout;
