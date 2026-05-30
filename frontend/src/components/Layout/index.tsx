import { useState, useCallback, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../stores/StoreProvider';
import './Layout.css';

const NAV_ITEMS = [
  { label: '首页', path: '/dashboard', type: 'link' },
  {
    label: '录入',
    type: 'link',
    path: '/entry/unified'
    // children: [
    //   { label: '统一录入', path: '/entry/unified' },
    //   { label: '账户录入', path: '/entry/account' },
    //   { label: '流水录入', path: '/entry/bankflow' },
    //   { label: '交易录入', path: '/entry/trade' },
    // ],
  },
  {
    label: '数据列表',
    type: 'link',
    path: '/list/unified',
  },
  { label: '统计', path: '/statistics', type: 'link' },
  {
    label: '笔记',
    type: 'dropdown',
    children: [
      { label: '全局笔记', path: '/notes/global' },
      { label: '心魔笔记', path: '/notes/stock' },
    ],
  },
  { label: '设置', path: '/config', type: 'link' },
] as const;

const NavDropdown = observer(({ label, children }: {
  label: string;
  children: { label: string; path: string }[];
}) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // 当前路由是否在该下拉菜单范围内
  const isActive = children.some((c) => location.pathname.startsWith(c.path));

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.navbar-dropdown')) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <li className="navbar-dropdown">
      <button
        className={`navbar-link${isActive ? ' navbar-link--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {label}
        <span style={{ fontSize: '0.625rem', marginLeft: 4, display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
      </button>
      {open && (
        <div className="navbar-dropdown__menu">
          {children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              className="navbar-dropdown__item"
              onClick={() => setOpen(false)}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </li>
  );
});

const Layout = observer(({ children }: { children: React.ReactNode }) => {
  const { authStore } = useStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = useCallback(() => {
    authStore.logout();
    setUserMenuOpen(false);
    window.location.href = '/login';
  }, [authStore]);

  // 点击外部关闭用户菜单
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.navbar-user')) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const avatarLetter = (authStore.username ?? '?').charAt(0).toUpperCase();

  return (
    <div className="layout-container">
      <nav className="navbar">
        {/* Brand */}
        <NavLink to="/dashboard" className="navbar-brand">
          <div className="navbar-brand__icon">S</div>
          <span className="navbar-brand__text">心魔录</span>
        </NavLink>

        {/* Nav Links */}
        <ul className="navbar-links">
          {NAV_ITEMS.map((item) => {
            if (item.type === 'dropdown') {
              return (
                <NavDropdown
                  key={item.label}
                  label={item.label}
                  children={[...item.children]}
                />
              );
            }
            return (
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
            );
          })}
        </ul>

        {/* User Area */}
        <div className="navbar-user">
          <button
            className="navbar-user__trigger"
            onClick={() => setUserMenuOpen((v) => !v)}
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
      </nav>

      {/* Page Content */}
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
});

export default Layout;
