import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SortableHeader from '../components/Table/SortableHeader';
import TablePagination from '../components/Table/TablePagination';
import ConfigPage from './ConfigPage';
import PortfolioImportAuditPage from './PortfolioImportAuditPage';
import {
  adminService,
  type AdminSummary,
  type AdminUser,
} from '../services/AdminService';
import {
  clampPage,
  getTotalPages,
  nextSortState,
  paginateItems,
  sortItemsBy,
  type SortOrder,
} from '../utils/table';
import './AdminPage.css';

type AdminTab = 'overview' | 'users' | 'settings' | 'audits' | 'reflection';
type AdminUserRoleFilter = 'all' | 'Admin' | 'User';
type AdminUserStatusFilter = 'all' | 'active' | 'inactive';
type AdminUserDataFilter = 'all' | 'with-data' | 'without-data';
type AdminUserSortField =
  | 'username'
  | 'role'
  | 'status'
  | 'latestDataDate'
  | 'currentTotalAssets'
  | 'latestDailyPnL'
  | 'totalPnL'
  | 'realizedPnL'
  | 'unrealizedPnL'
  | 'netBankFlow'
  | 'winRate'
  | 'totalTrades'
  | 'lastLoginAt'
  | 'createdAt';

const TAB_ITEMS: Array<{ key: AdminTab; label: string; description: string }> = [
  { key: 'overview', label: '系统概览', description: '用户规模、数据量与导出入口' },
  { key: 'users', label: '用户维护', description: '筛选、批量维护和战绩收益' },
  { key: 'settings', label: '系统设置', description: '同花顺链接等全局配置' },
  { key: 'audits', label: '识别审计', description: 'OCR 原图、识别结果和入库回看' },
  { key: 'reflection', label: '吾日三省', description: '维护统一的完整原文' },
];

const DEFAULT_PASSWORD = '123456';
const USER_PAGE_SIZE = 20;

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未记录';

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('zh-CN') : '未录入';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

const getInitial = (value: string) => value.trim().charAt(0).toUpperCase() || '?';

const getPnLClassName = (value: number) =>
  value >= 0 ? 'admin-page__pnl--positive' : 'admin-page__pnl--negative';

const hasUserData = (user: AdminUser) =>
  Boolean(user.performance.latestDataDate)
  || user.performance.accountRecordCount > 0
  || user.performance.bankFlowRecordCount > 0
  || user.performance.tradeRecordCount > 0;

const buildUserKeyword = (user: AdminUser) =>
  [
    user.username,
    user.email,
    user.role,
    user.performance.latestDataDate ?? '',
  ].join(' ').toLowerCase();

const getUserSortValue = (user: AdminUser, field: AdminUserSortField) => {
  switch (field) {
    case 'username':
      return user.username;
    case 'role':
      return user.role;
    case 'status':
      return user.isActive;
    case 'latestDataDate':
      return user.performance.latestDataDate ? new Date(user.performance.latestDataDate) : null;
    case 'currentTotalAssets':
      return user.performance.currentTotalAssets;
    case 'latestDailyPnL':
      return user.performance.latestDailyPnL;
    case 'totalPnL':
      return user.performance.totalPnL;
    case 'realizedPnL':
      return user.performance.realizedPnL;
    case 'unrealizedPnL':
      return user.performance.unrealizedPnL;
    case 'netBankFlow':
      return user.performance.netBankFlow;
    case 'winRate':
      return user.performance.winRate;
    case 'totalTrades':
      return user.performance.totalTrades;
    case 'lastLoginAt':
      return user.lastLoginAt ? new Date(user.lastLoginAt) : null;
    case 'createdAt':
      return new Date(user.createdAt);
    default:
      return user.username;
  }
};

const getUserSortDefaultOrder = (field: AdminUserSortField): SortOrder => {
  switch (field) {
    case 'username':
    case 'role':
      return 'asc';
    default:
      return 'desc';
  }
};

const AdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTabParam = searchParams.get('tab');
  const activeTab: AdminTab = TAB_ITEMS.some((item) => item.key === currentTabParam)
    ? (currentTabParam as AdminTab)
    : 'overview';

  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [usersSuccess, setUsersSuccess] = useState('');
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<number, string>>({});
  const [userKeyword, setUserKeyword] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<AdminUserRoleFilter>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<AdminUserStatusFilter>('all');
  const [userDataFilter, setUserDataFilter] = useState<AdminUserDataFilter>('all');
  const [userSortField, setUserSortField] = useState<AdminUserSortField>('createdAt');
  const [userSortOrder, setUserSortOrder] = useState<SortOrder>('desc');
  const [userPage, setUserPage] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [bulkPassword, setBulkPassword] = useState(DEFAULT_PASSWORD);

  const [reflectionText, setReflectionText] = useState('');
  const [reflectionUpdatedAt, setReflectionUpdatedAt] = useState<string | null>(null);
  const [reflectionUpdatedBy, setReflectionUpdatedBy] = useState<string | null>(null);
  const [reflectionLoaded, setReflectionLoaded] = useState(false);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [reflectionError, setReflectionError] = useState('');
  const [reflectionSaving, setReflectionSaving] = useState(false);
  const [reflectionSuccess, setReflectionSuccess] = useState('');

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');
  const [exportTempPath, setExportTempPath] = useState<string | null>(null);

  const sentenceCount = useMemo(() => {
    const matched = reflectionText.match(/[^。！？；!?;]+[。！？；!?;]?/g);
    return matched?.length ?? 0;
  }, [reflectionText]);

  const dateCount = useMemo(() => {
    const matched = reflectionText.match(/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?$/gm);
    return matched?.length ?? 0;
  }, [reflectionText]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError('');

    try {
      const data = await adminService.getSummary();
      setSummary(data);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : '加载管理员概览失败');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');

    try {
      const data = await adminService.getUsers();
      setUsers(data);
      setPasswordDrafts((current) => {
        const next = { ...current };
        data.forEach((user) => {
          next[user.id] = next[user.id] ?? DEFAULT_PASSWORD;
        });
        return next;
      });
      setSelectedUserIds((current) => current.filter((id) => data.some((user) => user.id === id)));
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : '加载用户列表失败');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadReflection = useCallback(async () => {
    setReflectionLoading(true);
    setReflectionError('');
    setReflectionSuccess('');

    try {
      const data = await adminService.getReflectionContent();
      setReflectionText(data.content || '');
      setReflectionUpdatedAt(data.updatedAt);
      setReflectionUpdatedBy(data.updatedByUsername);
      setReflectionLoaded(true);
    } catch (err) {
      setReflectionError(err instanceof Error ? err.message : '加载吾日三省吾身原文失败');
    } finally {
      setReflectionLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadUsers();
  }, [loadSummary, loadUsers]);

  useEffect(() => {
    if (activeTab === 'reflection' && !reflectionLoaded && !reflectionLoading) {
      void loadReflection();
    }
  }, [activeTab, loadReflection, reflectionLoaded, reflectionLoading]);

  useEffect(() => {
    setUserPage(1);
  }, [userKeyword, userRoleFilter, userStatusFilter, userDataFilter]);

  const filteredUsers = useMemo(() => {
    const keyword = userKeyword.trim().toLowerCase();

    return users.filter((user) => {
      if (keyword && !buildUserKeyword(user).includes(keyword)) {
        return false;
      }

      if (userRoleFilter !== 'all' && user.role !== userRoleFilter) {
        return false;
      }

      if (userStatusFilter === 'active' && !user.isActive) {
        return false;
      }

      if (userStatusFilter === 'inactive' && user.isActive) {
        return false;
      }

      if (userDataFilter === 'with-data' && !hasUserData(user)) {
        return false;
      }

      if (userDataFilter === 'without-data' && hasUserData(user)) {
        return false;
      }

      return true;
    });
  }, [userDataFilter, userKeyword, userRoleFilter, userStatusFilter, users]);

  const sortedUsers = useMemo(() => (
    sortItemsBy(filteredUsers, [
      {
        getValue: (user) => getUserSortValue(user, userSortField),
        order: userSortOrder,
      },
      {
        getValue: (user) => new Date(user.createdAt),
        order: 'desc',
      },
    ])
  ), [filteredUsers, userSortField, userSortOrder]);

  const userTotalPages = useMemo(
    () => getTotalPages(sortedUsers.length, USER_PAGE_SIZE),
    [sortedUsers.length],
  );

  useEffect(() => {
    setUserPage((current) => clampPage(current, userTotalPages));
  }, [userTotalPages]);

  const pagedUsers = useMemo(
    () => paginateItems(sortedUsers, userPage, USER_PAGE_SIZE),
    [sortedUsers, userPage],
  );

  const selectedUserIdSet = useMemo(
    () => new Set(selectedUserIds),
    [selectedUserIds],
  );

  const currentPageUserIds = useMemo(
    () => pagedUsers.map((user) => user.id),
    [pagedUsers],
  );

  const currentPageSelectedCount = useMemo(
    () => currentPageUserIds.filter((id) => selectedUserIdSet.has(id)).length,
    [currentPageUserIds, selectedUserIdSet],
  );

  const allCurrentPageSelected = currentPageUserIds.length > 0
    && currentPageSelectedCount === currentPageUserIds.length;

  const filteredSelectedCount = useMemo(
    () => filteredUsers.filter((user) => selectedUserIdSet.has(user.id)).length,
    [filteredUsers, selectedUserIdSet],
  );

  const filteredUserStats = useMemo(() => {
    const withDataCount = filteredUsers.filter(hasUserData).length;
    const activeCount = filteredUsers.filter((user) => user.isActive).length;
    const totalAssets = filteredUsers.reduce((sum, user) => sum + user.performance.currentTotalAssets, 0);
    const totalPnL = filteredUsers.reduce((sum, user) => sum + user.performance.totalPnL, 0);
    const netBankFlow = filteredUsers.reduce((sum, user) => sum + user.performance.netBankFlow, 0);

    return {
      withDataCount,
      activeCount,
      totalAssets,
      totalPnL,
      netBankFlow,
    };
  }, [filteredUsers]);

  const handleTabChange = (tab: AdminTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (tab !== 'audits') {
      next.delete('id');
    }
    setSearchParams(next);
  };

  const handleUserSort = (field: AdminUserSortField) => {
    const next = nextSortState(
      userSortField,
      userSortOrder,
      field,
      getUserSortDefaultOrder(field),
    );
    setUserSortField(next.field);
    setUserSortOrder(next.order);
  };

  const handleUserStatus = async (user: AdminUser, isActive: boolean) => {
    setBusyUserId(user.id);
    setUsersError('');
    setUsersSuccess('');

    try {
      await adminService.updateUserStatus(user.id, isActive);
      setUsersSuccess(`${user.username} 已${isActive ? '启用' : '停用'}`);
      await Promise.all([loadUsers(), loadSummary()]);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : '更新用户状态失败');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleUserRole = async (user: AdminUser, role: 'Admin' | 'User') => {
    setBusyUserId(user.id);
    setUsersError('');
    setUsersSuccess('');

    try {
      await adminService.updateUserRole(user.id, role);
      setUsersSuccess(`${user.username} 已调整为${role === 'Admin' ? '管理员' : '普通用户'}`);
      await Promise.all([loadUsers(), loadSummary()]);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : '更新用户角色失败');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleResetPassword = async (user: AdminUser) => {
    const newPassword = (passwordDrafts[user.id] || '').trim();
    if (!newPassword) {
      setUsersError(`请先为 ${user.username} 输入新密码`);
      return;
    }

    setBusyUserId(user.id);
    setUsersError('');
    setUsersSuccess('');

    try {
      await adminService.resetUserPassword(user.id, newPassword);
      setUsersSuccess(`${user.username} 的密码已重置`);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : '重置密码失败');
    } finally {
      setBusyUserId(null);
    }
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ));
  };

  const handleToggleCurrentPage = (checked: boolean) => {
    setSelectedUserIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...currentPageUserIds]));
      }

      return current.filter((id) => !currentPageUserIds.includes(id));
    });
  };

  const handleSelectFiltered = () => {
    setSelectedUserIds((current) => (
      Array.from(new Set([...current, ...filteredUsers.map((user) => user.id)]))
    ));
  };

  const handleResetUserFilters = () => {
    setUserKeyword('');
    setUserRoleFilter('all');
    setUserStatusFilter('all');
    setUserDataFilter('all');
    setUserPage(1);
  };

  const requireSelectedUsers = () => {
    if (selectedUserIds.length === 0) {
      setUsersError('请先勾选至少一个用户');
      setUsersSuccess('');
      return null;
    }

    return selectedUserIds;
  };

  const handleBatchStatus = async (isActive: boolean) => {
    const userIds = requireSelectedUsers();
    if (!userIds) {
      return;
    }

    setBatchBusy(true);
    setUsersError('');
    setUsersSuccess('');

    try {
      const result = await adminService.batchUpdateUserStatus(userIds, isActive);
      setUsersSuccess(`已批量${isActive ? '启用' : '停用'} ${result.updatedCount} 个用户`);
      await Promise.all([loadUsers(), loadSummary()]);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : '批量更新用户状态失败');
    } finally {
      setBatchBusy(false);
    }
  };

  const handleBatchRole = async (role: 'Admin' | 'User') => {
    const userIds = requireSelectedUsers();
    if (!userIds) {
      return;
    }

    setBatchBusy(true);
    setUsersError('');
    setUsersSuccess('');

    try {
      const result = await adminService.batchUpdateUserRole(userIds, role);
      setUsersSuccess(`已批量设置 ${result.updatedCount} 个用户为${role === 'Admin' ? '管理员' : '普通用户'}`);
      await Promise.all([loadUsers(), loadSummary()]);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : '批量更新用户角色失败');
    } finally {
      setBatchBusy(false);
    }
  };

  const handleBatchPasswordReset = async () => {
    const userIds = requireSelectedUsers();
    if (!userIds) {
      return;
    }

    const newPassword = bulkPassword.trim();
    if (!newPassword) {
      setUsersError('请先输入批量重置密码');
      setUsersSuccess('');
      return;
    }

    setBatchBusy(true);
    setUsersError('');
    setUsersSuccess('');

    try {
      const result = await adminService.batchResetUserPassword(userIds, newPassword);
      setUsersSuccess(`已批量重置 ${result.updatedCount} 个用户的密码`);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : '批量重置密码失败');
    } finally {
      setBatchBusy(false);
    }
  };

  const handleExportDatabase = async () => {
    setExporting(true);
    setExportError('');
    setExportSuccess('');

    try {
      const result = await adminService.exportDatabase();
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setExportTempPath(result.tempFilePath);
      setExportSuccess(`已导出 ${result.fileName}`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : '导出数据库备份失败');
    } finally {
      setExporting(false);
    }
  };

  const handleSaveReflection = async () => {
    setReflectionSaving(true);
    setReflectionError('');
    setReflectionSuccess('');

    try {
      const data = await adminService.updateReflectionContent(reflectionText);
      setReflectionText(data.content || '');
      setReflectionUpdatedAt(data.updatedAt);
      setReflectionUpdatedBy(data.updatedByUsername);
      setReflectionSuccess('吾日三省吾身原文已保存');
    } catch (err) {
      setReflectionError(err instanceof Error ? err.message : '保存吾日三省吾身原文失败');
    } finally {
      setReflectionSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page__hero">
        <div>
          <h1 className="admin-page__title">管理员后台</h1>
          <p className="admin-page__subtitle">统一管理系统配置、用户、图片识别审计与“吾日三省吾身”原文。</p>
        </div>
        <div className="admin-page__hero-actions">
          <button
            type="button"
            className="admin-page__primary-btn"
            onClick={handleExportDatabase}
            disabled={exporting}
          >
            {exporting ? '导出中...' : '一键导出数据库备份'}
          </button>
          <button
            type="button"
            className="admin-page__secondary-btn"
            onClick={() => void loadSummary()}
            disabled={summaryLoading}
          >
            刷新概览
          </button>
        </div>
      </header>

      <section className="admin-page__tabs">
        {TAB_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`admin-page__tab${activeTab === item.key ? ' admin-page__tab--active' : ''}`}
            onClick={() => handleTabChange(item.key)}
          >
            <span className="admin-page__tab-label">{item.label}</span>
            <span className="admin-page__tab-desc">{item.description}</span>
          </button>
        ))}
      </section>

      {(exportError || exportSuccess || exportTempPath) && (
        <section className="admin-page__notice-card">
          {exportError && <div className="admin-page__notice admin-page__notice--error">{exportError}</div>}
          {exportSuccess && <div className="admin-page__notice admin-page__notice--success">{exportSuccess}</div>}
          {exportTempPath && (
            <div className="admin-page__notice admin-page__notice--info">
              临时文件：<code>{exportTempPath}</code>
            </div>
          )}
        </section>
      )}

      {activeTab === 'overview' && (
        <section className="admin-page__panel">
          <div className="admin-page__panel-header">
            <div>
              <h2>系统概览</h2>
              <p>优先看用户规模、数据量和最近一次活跃时间。</p>
            </div>
          </div>

          {summaryError && <div className="admin-page__notice admin-page__notice--error">{summaryError}</div>}

          {summaryLoading && !summary ? (
            <div className="admin-page__empty">正在加载系统概览...</div>
          ) : summary ? (
            <>
              <div className="admin-page__metrics">
                <article className="admin-page__metric-card">
                  <span className="admin-page__metric-label">系统用户</span>
                  <strong className="admin-page__metric-value">{summary.totalUsers}</strong>
                  <span className="admin-page__metric-meta">启用 {summary.activeUsers} / 管理员 {summary.adminUsers}</span>
                </article>
                <article className="admin-page__metric-card">
                  <span className="admin-page__metric-label">账户资金记录</span>
                  <strong className="admin-page__metric-value">{summary.totalAccounts}</strong>
                  <span className="admin-page__metric-meta">银证 {summary.totalBankFlows} / 交易 {summary.totalTrades}</span>
                </article>
                <article className="admin-page__metric-card">
                  <span className="admin-page__metric-label">识别审计</span>
                  <strong className="admin-page__metric-value">{summary.totalAudits}</strong>
                  <span className="admin-page__metric-meta">最近识别 {formatDateTime(summary.lastAuditCreatedAt)}</span>
                </article>
                <article className="admin-page__metric-card">
                  <span className="admin-page__metric-label">最近登录</span>
                  <strong className="admin-page__metric-value admin-page__metric-value--small">
                    {formatDateTime(summary.lastUserLoginAt)}
                  </strong>
                  <span className="admin-page__metric-meta">可用于判断当前系统活跃情况</span>
                </article>
              </div>

              <div className="admin-page__quick-grid">
                <button type="button" className="admin-page__quick-card" onClick={() => handleTabChange('users')}>
                  <strong>进入用户维护</strong>
                  <span>表格筛选、批量维护、战绩收益总览</span>
                </button>
                <button type="button" className="admin-page__quick-card" onClick={() => handleTabChange('settings')}>
                  <strong>进入系统设置</strong>
                  <span>维护同花顺心魔详情页链接前缀</span>
                </button>
                <button type="button" className="admin-page__quick-card" onClick={() => handleTabChange('audits')}>
                  <strong>进入识别审计</strong>
                  <span>查看 OCR 原图、识别文本和最终提交载荷</span>
                </button>
                <button type="button" className="admin-page__quick-card" onClick={() => handleTabChange('reflection')}>
                  <strong>维护吾日三省</strong>
                  <span>统一编辑原文，普通用户页自动变成只读回看</span>
                </button>
              </div>
            </>
          ) : (
            <div className="admin-page__empty">当前没有可展示的系统概览数据。</div>
          )}
        </section>
      )}

      {activeTab === 'users' && (
        <section className="admin-page__panel">
          <div className="admin-page__panel-header">
            <div>
              <h2>用户维护</h2>
              <p>支持筛选、排序、多选批量处理，并直接查看每个人的战绩和收益。</p>
            </div>
            <button
              type="button"
              className="admin-page__secondary-btn"
              onClick={() => void loadUsers()}
              disabled={usersLoading}
            >
              {usersLoading ? '刷新中...' : '刷新用户'}
            </button>
          </div>

          {usersError && <div className="admin-page__notice admin-page__notice--error">{usersError}</div>}
          {usersSuccess && <div className="admin-page__notice admin-page__notice--success">{usersSuccess}</div>}

          <div className="admin-page__metrics admin-page__metrics--users">
            <article className="admin-page__metric-card">
              <span className="admin-page__metric-label">筛选用户</span>
              <strong className="admin-page__metric-value">{filteredUsers.length}</strong>
              <span className="admin-page__metric-meta">启用 {filteredUserStats.activeCount} / 有数据 {filteredUserStats.withDataCount}</span>
            </article>
            <article className="admin-page__metric-card">
              <span className="admin-page__metric-label">筛选资产</span>
              <strong className="admin-page__metric-value admin-page__metric-value--small">
                {formatMoney(filteredUserStats.totalAssets)}
              </strong>
              <span className="admin-page__metric-meta">当前表格可见用户的最新总资产</span>
            </article>
            <article className="admin-page__metric-card">
              <span className="admin-page__metric-label">筛选累计收益</span>
              <strong className={`admin-page__metric-value admin-page__metric-value--small ${getPnLClassName(filteredUserStats.totalPnL)}`}>
                {formatMoney(filteredUserStats.totalPnL)}
              </strong>
              <span className="admin-page__metric-meta">汇总当前筛选结果的累计收益</span>
            </article>
            <article className="admin-page__metric-card">
              <span className="admin-page__metric-label">筛选净入金</span>
              <strong className={`admin-page__metric-value admin-page__metric-value--small ${getPnLClassName(filteredUserStats.netBankFlow)}`}>
                {formatMoney(filteredUserStats.netBankFlow)}
              </strong>
              <span className="admin-page__metric-meta">共选中 {selectedUserIds.length} 人，筛选内命中 {filteredSelectedCount} 人</span>
            </article>
          </div>

          <div className="admin-page__toolbar">
            <input
              type="text"
              value={userKeyword}
              onChange={(event) => setUserKeyword(event.target.value)}
              placeholder="搜索用户名、邮箱或最近日期"
              className="admin-page__toolbar-input"
            />
            <select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value as AdminUserRoleFilter)}>
              <option value="all">全部角色</option>
              <option value="Admin">管理员</option>
              <option value="User">普通用户</option>
            </select>
            <select value={userStatusFilter} onChange={(event) => setUserStatusFilter(event.target.value as AdminUserStatusFilter)}>
              <option value="all">全部状态</option>
              <option value="active">仅启用</option>
              <option value="inactive">仅停用</option>
            </select>
            <select value={userDataFilter} onChange={(event) => setUserDataFilter(event.target.value as AdminUserDataFilter)}>
              <option value="all">全部数据状态</option>
              <option value="with-data">仅看有数据</option>
              <option value="without-data">仅看无数据</option>
            </select>
            <button
              type="button"
              className="admin-page__secondary-btn"
              onClick={handleResetUserFilters}
              disabled={usersLoading}
            >
              重置筛选
            </button>
          </div>

          <div className="admin-page__bulk-bar">
            <div className="admin-page__bulk-meta">
              <span className="admin-page__toolbar-tag">已选 {selectedUserIds.length} 人</span>
              <span className="admin-page__toolbar-tag">当前页 {pagedUsers.length} 人</span>
              <span className="admin-page__toolbar-tag">筛选结果 {filteredUsers.length} 人</span>
            </div>

            <div className="admin-page__bulk-actions">
              <button type="button" className="admin-page__mini-btn" onClick={() => handleToggleCurrentPage(true)} disabled={usersLoading || batchBusy || pagedUsers.length === 0}>
                当前页全选
              </button>
              <button type="button" className="admin-page__mini-btn" onClick={handleSelectFiltered} disabled={usersLoading || batchBusy || filteredUsers.length === 0}>
                全选筛选结果
              </button>
              <button type="button" className="admin-page__mini-btn" onClick={() => setSelectedUserIds([])} disabled={usersLoading || batchBusy || selectedUserIds.length === 0}>
                清空选择
              </button>
            </div>

            <div className="admin-page__bulk-actions">
              <button type="button" className="admin-page__mini-btn" onClick={() => void handleBatchStatus(true)} disabled={usersLoading || batchBusy}>
                批量启用
              </button>
              <button type="button" className="admin-page__mini-btn" onClick={() => void handleBatchStatus(false)} disabled={usersLoading || batchBusy}>
                批量停用
              </button>
              <button type="button" className="admin-page__mini-btn" onClick={() => void handleBatchRole('Admin')} disabled={usersLoading || batchBusy}>
                设为管理员
              </button>
              <button type="button" className="admin-page__mini-btn" onClick={() => void handleBatchRole('User')} disabled={usersLoading || batchBusy}>
                设为普通用户
              </button>
            </div>

            <div className="admin-page__bulk-actions admin-page__bulk-actions--password">
              <input
                type="text"
                value={bulkPassword}
                onChange={(event) => setBulkPassword(event.target.value)}
                placeholder="批量重置密码"
                className="admin-page__toolbar-input admin-page__toolbar-input--password"
              />
              <button
                type="button"
                className="admin-page__mini-btn admin-page__mini-btn--danger"
                onClick={() => void handleBatchPasswordReset()}
                disabled={usersLoading || batchBusy}
              >
                {batchBusy ? '处理中...' : '批量重置密码'}
              </button>
            </div>
          </div>

          {usersLoading && users.length === 0 ? (
            <div className="admin-page__empty">正在加载用户列表...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="admin-page__empty">
              当前筛选条件下没有用户记录，可以调整关键字或重置筛选后再看。
            </div>
          ) : (
            <>
              <div className="admin-page__table-wrap">
                <table className="admin-page__user-table">
                  <thead>
                    <tr>
                      <th className="admin-page__checkbox-col">
                        <input
                          type="checkbox"
                          checked={allCurrentPageSelected}
                          onChange={(event) => handleToggleCurrentPage(event.target.checked)}
                          aria-label="全选当前页"
                        />
                      </th>
                      <SortableHeader field="username" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort}>
                        用户
                      </SortableHeader>
                      <SortableHeader field="role" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort}>
                        角色
                      </SortableHeader>
                      <SortableHeader field="status" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort}>
                        状态
                      </SortableHeader>
                      <SortableHeader field="latestDataDate" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort}>
                        最近数据
                      </SortableHeader>
                      <SortableHeader field="currentTotalAssets" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort} className="admin-page__th-num">
                        最新资产
                      </SortableHeader>
                      <SortableHeader field="latestDailyPnL" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort} className="admin-page__th-num">
                        当日盈亏
                      </SortableHeader>
                      <SortableHeader field="totalPnL" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort} className="admin-page__th-num">
                        累计收益
                      </SortableHeader>
                      <SortableHeader field="realizedPnL" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort} className="admin-page__th-num">
                        已实现
                      </SortableHeader>
                      <SortableHeader field="unrealizedPnL" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort} className="admin-page__th-num">
                        持仓盈亏
                      </SortableHeader>
                      <SortableHeader field="netBankFlow" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort} className="admin-page__th-num">
                        净入金
                      </SortableHeader>
                      <SortableHeader field="totalTrades" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort}>
                        战绩
                      </SortableHeader>
                      <SortableHeader field="winRate" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort}>
                        胜率
                      </SortableHeader>
                      <SortableHeader field="lastLoginAt" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort}>
                        最近登录
                      </SortableHeader>
                      <SortableHeader field="createdAt" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort}>
                        注册时间
                      </SortableHeader>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedUsers.map((user) => {
                      const isBusy = busyUserId === user.id || batchBusy;
                      const passwordDraft = passwordDrafts[user.id] ?? DEFAULT_PASSWORD;

                      return (
                        <tr key={user.id}>
                          <td className="admin-page__checkbox-col" data-label="选择">
                            <input
                              type="checkbox"
                              checked={selectedUserIdSet.has(user.id)}
                              onChange={() => toggleUserSelection(user.id)}
                              aria-label={`选择 ${user.username}`}
                            />
                          </td>
                          <td data-label="用户">
                            <div className="admin-page__table-user">
                              <div className="admin-page__user-avatar admin-page__user-avatar--small">
                                {user.avatarUrl ? (
                                  <img src={user.avatarUrl} alt={`${user.username}头像`} />
                                ) : (
                                  getInitial(user.username)
                                )}
                              </div>
                              <div className="admin-page__table-user-meta">
                                <div className="admin-page__user-title-row">
                                  <strong>{user.username}</strong>
                                  {hasUserData(user) ? (
                                    <span className="admin-page__badge admin-page__badge--data">有数据</span>
                                  ) : (
                                    <span className="admin-page__badge">未录入</span>
                                  )}
                                </div>
                                <span>{user.email}</span>
                                <span>
                                  账户 {user.performance.accountRecordCount} / 流水 {user.performance.bankFlowRecordCount} / 交易 {user.performance.tradeRecordCount}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td data-label="角色">
                            <span className={`admin-page__badge${user.isAdmin ? ' admin-page__badge--admin' : ''}`}>
                              {user.isAdmin ? '管理员' : '普通用户'}
                            </span>
                          </td>
                          <td data-label="状态">
                            <span className={`admin-page__badge${user.isActive ? ' admin-page__badge--active' : ' admin-page__badge--inactive'}`}>
                              {user.isActive ? '已启用' : '已停用'}
                            </span>
                          </td>
                          <td data-label="最近数据">{formatDate(user.performance.latestDataDate)}</td>
                          <td data-label="最新资产" className="admin-page__td-num">
                            {formatMoney(user.performance.currentTotalAssets)}
                          </td>
                          <td data-label="当日盈亏" className={`admin-page__td-num ${getPnLClassName(user.performance.latestDailyPnL)}`}>
                            {formatMoney(user.performance.latestDailyPnL)}
                          </td>
                          <td data-label="累计收益" className={`admin-page__td-num ${getPnLClassName(user.performance.totalPnL)}`}>
                            {formatMoney(user.performance.totalPnL)}
                          </td>
                          <td data-label="已实现" className={`admin-page__td-num ${getPnLClassName(user.performance.realizedPnL)}`}>
                            {formatMoney(user.performance.realizedPnL)}
                          </td>
                          <td data-label="持仓盈亏" className={`admin-page__td-num ${getPnLClassName(user.performance.unrealizedPnL)}`}>
                            {formatMoney(user.performance.unrealizedPnL)}
                          </td>
                          <td data-label="净入金" className={`admin-page__td-num ${getPnLClassName(user.performance.netBankFlow)}`}>
                            {formatMoney(user.performance.netBankFlow)}
                          </td>
                          <td data-label="战绩">
                            <div className="admin-page__record-stack">
                              <strong>{user.performance.totalTrades} 轮</strong>
                              <span>盈 {user.performance.winTrades} / 亏 {user.performance.loseTrades}</span>
                            </div>
                          </td>
                          <td data-label="胜率">{formatPercent(user.performance.winRate)}</td>
                          <td data-label="最近登录">{formatDateTime(user.lastLoginAt)}</td>
                          <td data-label="注册时间">{formatDateTime(user.createdAt)}</td>
                          <td data-label="操作">
                            <div className="admin-page__table-actions">
                              <div className="admin-page__button-row">
                                <button
                                  type="button"
                                  className="admin-page__mini-btn"
                                  onClick={() => void handleUserStatus(user, !user.isActive)}
                                  disabled={isBusy}
                                >
                                  {user.isActive ? '停用' : '启用'}
                                </button>
                                <button
                                  type="button"
                                  className="admin-page__mini-btn"
                                  onClick={() => void handleUserRole(user, user.isAdmin ? 'User' : 'Admin')}
                                  disabled={isBusy || (!user.isActive && !user.isAdmin)}
                                >
                                  {user.isAdmin ? '设为普通' : '设为管理员'}
                                </button>
                              </div>
                              <div className="admin-page__password-row admin-page__password-row--table">
                                <input
                                  type="text"
                                  value={passwordDraft}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setPasswordDrafts((current) => ({ ...current, [user.id]: value }));
                                  }}
                                  placeholder="新密码"
                                />
                                <button
                                  type="button"
                                  className="admin-page__mini-btn admin-page__mini-btn--danger"
                                  onClick={() => void handleResetPassword(user)}
                                  disabled={isBusy}
                                >
                                  {isBusy ? '处理中...' : '重置'}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <TablePagination
                page={userPage}
                totalPages={userTotalPages}
                totalItems={sortedUsers.length}
                onPageChange={setUserPage}
                infoText={`共 ${sortedUsers.length} 个用户，第 ${userPage}/${userTotalPages} 页`}
              />
            </>
          )}
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="admin-page__panel">
          <div className="admin-page__panel-header">
            <div>
              <h2>系统设置</h2>
              <p>这里接管原来的单独设置页。</p>
            </div>
          </div>
          <ConfigPage embedded />
        </section>
      )}

      {activeTab === 'audits' && (
        <section className="admin-page__panel">
          <div className="admin-page__panel-header">
            <div>
              <h2>图片识别审计</h2>
              <p>审计功能已经迁到后台，支持从录入页按审计 ID 直接跳进来。</p>
            </div>
          </div>
          <PortfolioImportAuditPage embedded />
        </section>
      )}

      {activeTab === 'reflection' && (
        <section className="admin-page__panel">
          <div className="admin-page__panel-header">
            <div>
              <h2>吾日三省吾身原文维护</h2>
              <p>这里维护的是全量原文；普通用户页面会自动按日期分组、按句拆分并只读展示。</p>
            </div>
            <button
              type="button"
              className="admin-page__secondary-btn"
              onClick={() => void loadReflection()}
              disabled={reflectionLoading}
            >
              {reflectionLoading ? '刷新中...' : '刷新原文'}
            </button>
          </div>

          {reflectionError && <div className="admin-page__notice admin-page__notice--error">{reflectionError}</div>}
          {reflectionSuccess && <div className="admin-page__notice admin-page__notice--success">{reflectionSuccess}</div>}

          {reflectionLoading && !reflectionLoaded ? (
            <div className="admin-page__empty">正在加载吾日三省吾身原文...</div>
          ) : (
            <>
              <div className="admin-page__reflection-meta">
                <span>最近维护：{formatDateTime(reflectionUpdatedAt)}</span>
                <span>维护人：{reflectionUpdatedBy || '未记录'}</span>
                <span>日期段：{dateCount}</span>
                <span>句子数：{sentenceCount}</span>
              </div>

              <textarea
                className="admin-page__reflection-textarea"
                value={reflectionText}
                onChange={(event) => setReflectionText(event.target.value)}
                placeholder="请输入完整原文，建议保留每个日期单独一行，正文一行一句。"
                rows={24}
              />

              <div className="admin-page__reflection-actions">
                <button
                  type="button"
                  className="admin-page__primary-btn"
                  onClick={handleSaveReflection}
                  disabled={reflectionSaving || !reflectionText.trim()}
                >
                  {reflectionSaving ? '保存中...' : '保存原文'}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default AdminPage;
