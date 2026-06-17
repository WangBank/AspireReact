import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PageHeader from '../components/Page/PageHeader';
import {
  FilterToolbar,
  ResponsiveTableShell,
  SectionCard,
} from '../components/Page';
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
import { useStore } from '../stores/StoreProvider';
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

const USER_PAGE_SIZE = 20;

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未记录';

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('zh-CN') : '未录入';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

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

interface AdminMetricCardItem {
  label: string;
  value: string;
  detail: string;
  toneClassName?: string;
}

const AdminMetricGrid = ({ items }: { items: AdminMetricCardItem[] }) => (
  <Box
    sx={{
      display: 'grid',
      gap: 1.5,
      gridTemplateColumns: {
        xs: '1fr',
        md: 'repeat(2, minmax(0, 1fr))',
        xl: 'repeat(4, minmax(0, 1fr))',
      },
    }}
  >
    {items.map((item) => (
      <Paper
        key={item.label}
        component="article"
        elevation={0}
        sx={(theme) => ({
          p: 2.25,
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.default,
        })}
      >
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 1,
            color: 'text.secondary',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {item.label}
        </Typography>
        <Typography
          variant="h6"
          className={item.toneClassName}
          sx={{ fontWeight: 800, lineHeight: 1.3 }}
        >
          {item.value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.65 }}>
          {item.detail}
        </Typography>
      </Paper>
    ))}
  </Box>
);

const AdminPage = () => {
  const navigate = useNavigate();
  const { authStore } = useStore();
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
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);

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
          next[user.id] = next[user.id] ?? '';
        });
        return next;
      });
      setSelectedUserIds((current) => current.filter((id) => data.some((user) => user.id === id && !user.isAdmin)));
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

  const currentPageSelectableUserIds = useMemo(
    () => pagedUsers.filter((user) => !user.isAdmin).map((user) => user.id),
    [pagedUsers],
  );

  const currentPageSelectedCount = useMemo(
    () => currentPageSelectableUserIds.filter((id) => selectedUserIdSet.has(id)).length,
    [currentPageSelectableUserIds, selectedUserIdSet],
  );

  const allCurrentPageSelected = currentPageSelectableUserIds.length > 0
    && currentPageSelectedCount === currentPageSelectableUserIds.length;

  const filteredSelectedCount = useMemo(
    () => filteredUsers.filter((user) => !user.isAdmin && selectedUserIdSet.has(user.id)).length,
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
      setPasswordDrafts((current) => ({ ...current, [user.id]: '' }));
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : '重置密码失败');
    } finally {
      setBusyUserId(null);
    }
  };

  const toggleUserSelection = (userId: number) => {
    if (!users.some((user) => user.id === userId && !user.isAdmin)) {
      return;
    }

    setSelectedUserIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ));
  };

  const handleToggleCurrentPage = (checked: boolean) => {
    setSelectedUserIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...currentPageSelectableUserIds]));
      }

      return current.filter((id) => !currentPageSelectableUserIds.includes(id));
    });
  };

  const handleSelectFiltered = () => {
    setSelectedUserIds((current) => (
      Array.from(new Set([...current, ...filteredUsers.filter((user) => !user.isAdmin).map((user) => user.id)]))
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
    const operableUserIds = selectedUserIds.filter((id) => users.some((user) => user.id === id && !user.isAdmin));
    if (operableUserIds.length !== selectedUserIds.length) {
      setSelectedUserIds(operableUserIds);
    }

    if (operableUserIds.length === 0) {
      setUsersError('请先勾选至少一个用户');
      setUsersSuccess('');
      return null;
    }

    return operableUserIds;
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

  const handlePickRestoreFile = () => {
    if (restoring) {
      return;
    }

    restoreFileInputRef.current?.click();
  };

  const handleRestoreFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setRestoreError('');
    setRestoreFile(file);
    setRestoreConfirmed(false);
    setRestoreDialogOpen(true);
  };

  const handleCloseRestoreDialog = () => {
    if (restoring) {
      return;
    }

    setRestoreDialogOpen(false);
    setRestoreConfirmed(false);
    setRestoreFile(null);
  };

  const handleRestoreDatabase = async () => {
    if (!restoreFile) {
      setRestoreError('请先选择要恢复的 dump 文件');
      return;
    }

    if (!restoreConfirmed) {
      setRestoreError('请先确认当前数据库将被彻底覆盖');
      return;
    }

    setRestoring(true);
    setRestoreError('');

    try {
      await adminService.restoreDatabase(restoreFile, true);
      setRestoreDialogOpen(false);
      setRestoreConfirmed(false);
      setRestoreFile(null);
      setRestoring(false);
      authStore.logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : '恢复数据库备份失败');
      setRestoring(false);
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
      <input
        ref={restoreFileInputRef}
        type="file"
        accept=".sql,.dump,.backup,.tar"
        hidden
        onChange={handleRestoreFileChange}
      />

      <PageHeader
        eyebrow="管理工作台"
        title="管理员后台"
        subtitle="统一管理系统配置、用户、图片识别审计与“吾日三省吾身”原文。"
        actions={(
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="contained"
              onClick={handleExportDatabase}
              disabled={exporting}
              sx={{ minWidth: { xs: '100%', sm: 188 } }}
            >
              {exporting ? '导出中...' : '一键导出数据库备份'}
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={handlePickRestoreFile}
              disabled={restoring}
              sx={{ minWidth: { xs: '100%', sm: 188 } }}
            >
              {restoring ? '恢复中...' : '上传 dump 恢复数据库'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => void loadSummary()}
              disabled={summaryLoading}
              sx={{ minWidth: { xs: '100%', sm: 120 } }}
            >
              刷新概览
            </Button>
          </Stack>
        )}
        stats={[
          { label: '系统用户', value: summary ? String(summary.totalUsers) : '--' },
          { label: '启用用户', value: summary ? String(summary.activeUsers) : '--' },
          { label: '识别审计', value: summary ? String(summary.totalAudits) : '--' },
          { label: '最近登录', value: summary ? formatDateTime(summary.lastUserLoginAt) : '--' },
        ]}
      />

      <Paper
        elevation={0}
        sx={(theme) => ({
          mb: 2.5,
          p: { xs: 1.5, md: 2 },
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        })}
      >
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              xl: `repeat(${TAB_ITEMS.length}, minmax(0, 1fr))`,
            },
          }}
        >
        {TAB_ITEMS.map((item) => (
          <Button
            key={item.key}
            onClick={() => handleTabChange(item.key)}
            variant={activeTab === item.key ? 'contained' : 'outlined'}
            color={activeTab === item.key ? 'primary' : 'inherit'}
            sx={{
              minHeight: 92,
              px: 2,
              py: 1.8,
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              textAlign: 'left',
              textTransform: 'none',
              borderRadius: 3,
            }}
          >
            <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {item.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.6,
                  color: activeTab === item.key ? 'rgba(255,255,255,0.82)' : 'text.secondary',
                }}
              >
                {item.description}
              </Typography>
            </Stack>
          </Button>
        ))}
        </Box>
      </Paper>

      {(exportError || exportSuccess || exportTempPath || restoreError) && (
        <Stack spacing={1.5} sx={{ mb: 2.5 }}>
          {exportError && <Alert severity="error">{exportError}</Alert>}
          {exportSuccess && <Alert severity="success">{exportSuccess}</Alert>}
          {restoreError && <Alert severity="error">{restoreError}</Alert>}
          {exportTempPath && (
            <Alert severity="info">
              临时文件：<code>{exportTempPath}</code>
            </Alert>
          )}
        </Stack>
      )}

      {activeTab === 'overview' && (
        <SectionCard
          title="系统概览"
          description="优先看用户规模、数据量和最近一次活跃时间。"
        >
          {summaryError && <Alert severity="error">{summaryError}</Alert>}

          {summaryLoading && !summary ? (
            <div className="admin-page__empty">正在加载系统概览...</div>
          ) : summary ? (
            <>
              <AdminMetricGrid
                items={[
                  {
                    label: '系统用户',
                    value: String(summary.totalUsers),
                    detail: `启用 ${summary.activeUsers} / 管理员 ${summary.adminUsers}`,
                  },
                  {
                    label: '账户资金记录',
                    value: String(summary.totalAccounts),
                    detail: `银证 ${summary.totalBankFlows} / 交易 ${summary.totalTrades}`,
                  },
                  {
                    label: '识别审计',
                    value: String(summary.totalAudits),
                    detail: `最近识别 ${formatDateTime(summary.lastAuditCreatedAt)}`,
                  },
                  {
                    label: '最近登录',
                    value: formatDateTime(summary.lastUserLoginAt),
                    detail: '可用于判断当前系统活跃情况',
                  },
                ]}
              />

              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: '1fr',
                    lg: 'repeat(2, minmax(0, 1fr))',
                  },
                }}
              >
                {[
                  {
                    key: 'users' as const,
                    title: '进入用户维护',
                    description: '表格筛选、批量维护、战绩收益总览',
                  },
                  {
                    key: 'settings' as const,
                    title: '进入系统设置',
                    description: '维护同花顺心魔详情页链接前缀',
                  },
                  {
                    key: 'audits' as const,
                    title: '进入识别审计',
                    description: '查看 OCR 原图、识别文本和最终提交载荷',
                  },
                  {
                    key: 'reflection' as const,
                    title: '维护吾日三省',
                    description: '统一编辑原文，普通用户页自动变成只读回看',
                  },
                ].map((item) => (
                  <Button
                    key={item.key}
                    variant="outlined"
                    color="inherit"
                    onClick={() => handleTabChange(item.key)}
                    sx={{
                      p: 2.25,
                      borderRadius: 3,
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      textTransform: 'none',
                    }}
                  >
                    <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {item.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                        {item.description}
                      </Typography>
                    </Stack>
                  </Button>
                ))}
              </Box>
            </>
          ) : (
            <div className="admin-page__empty">当前没有可展示的系统概览数据。</div>
          )}
        </SectionCard>
      )}

      {activeTab === 'users' && (
        <ResponsiveTableShell
          title="用户维护"
          description="支持筛选、排序、多选批量处理，并直接查看每个人的战绩和收益。"
          actions={(
            <Button
              variant="outlined"
              onClick={() => void loadUsers()}
              disabled={usersLoading}
              sx={{ minWidth: { xs: '100%', sm: 112 } }}
            >
              {usersLoading ? '刷新中...' : '刷新用户'}
            </Button>
          )}
          toolbar={(
            <Stack spacing={2}>
              {usersError && <Alert severity="error">{usersError}</Alert>}
              {usersSuccess && <Alert severity="success">{usersSuccess}</Alert>}

              <AdminMetricGrid
                items={[
                  {
                    label: '筛选用户',
                    value: String(filteredUsers.length),
                    detail: `启用 ${filteredUserStats.activeCount} / 有数据 ${filteredUserStats.withDataCount}`,
                  },
                  {
                    label: '筛选资产',
                    value: formatMoney(filteredUserStats.totalAssets),
                    detail: '当前表格可见用户的最新总资产',
                  },
                  {
                    label: '筛选累计收益',
                    value: formatMoney(filteredUserStats.totalPnL),
                    detail: '汇总当前筛选结果的累计收益',
                    toneClassName: getPnLClassName(filteredUserStats.totalPnL),
                  },
                  {
                    label: '筛选净入金',
                    value: formatMoney(filteredUserStats.netBankFlow),
                    detail: `共选中 ${selectedUserIds.length} 人，筛选内命中 ${filteredSelectedCount} 人`,
                    toneClassName: getPnLClassName(filteredUserStats.netBankFlow),
                  },
                ]}
              />

              <FilterToolbar
                title="筛选条件"
                description="按用户名、角色、状态和数据覆盖情况筛选，配合排序快速定位用户。"
                actions={(
                  <Button
                    variant="outlined"
                    onClick={handleResetUserFilters}
                    disabled={usersLoading}
                    sx={{ minWidth: { xs: '100%', sm: 112 } }}
                  >
                    重置筛选
                  </Button>
                )}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: {
                      xs: '1fr',
                      md: 'repeat(2, minmax(0, 1fr))',
                      xl: 'minmax(280px, 1.4fr) repeat(3, minmax(180px, 1fr))',
                    },
                  }}
                >
                  <TextField
                    size="small"
                    label="搜索用户"
                    value={userKeyword}
                    onChange={(event) => setUserKeyword(event.target.value)}
                    placeholder="用户名、邮箱或最近日期"
                  />
                  <TextField
                    select
                    size="small"
                    label="角色"
                    value={userRoleFilter}
                    onChange={(event) => setUserRoleFilter(event.target.value as AdminUserRoleFilter)}
                  >
                    <MenuItem value="all">全部角色</MenuItem>
                    <MenuItem value="Admin">管理员</MenuItem>
                    <MenuItem value="User">普通用户</MenuItem>
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="状态"
                    value={userStatusFilter}
                    onChange={(event) => setUserStatusFilter(event.target.value as AdminUserStatusFilter)}
                  >
                    <MenuItem value="all">全部状态</MenuItem>
                    <MenuItem value="active">仅启用</MenuItem>
                    <MenuItem value="inactive">仅停用</MenuItem>
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="数据情况"
                    value={userDataFilter}
                    onChange={(event) => setUserDataFilter(event.target.value as AdminUserDataFilter)}
                  >
                    <MenuItem value="all">全部数据状态</MenuItem>
                    <MenuItem value="with-data">仅看有数据</MenuItem>
                    <MenuItem value="without-data">仅看无数据</MenuItem>
                  </TextField>
                </Box>
              </FilterToolbar>

              <Paper
                elevation={0}
                sx={(theme) => ({
                  p: { xs: 2, md: 2.25 },
                  borderRadius: 3,
                  border: `1px solid ${theme.palette.divider}`,
                  backgroundColor: theme.palette.background.default,
                })}
              >
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} useFlexGap sx={{ justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Chip label={`已选 ${selectedUserIds.length} 人`} color="primary" variant="outlined" />
                      <Chip label={`当前页 ${pagedUsers.length} 人`} variant="outlined" />
                      <Chip label={`筛选结果 ${filteredUsers.length} 人`} variant="outlined" />
                    </Stack>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleToggleCurrentPage(true)}
                        disabled={usersLoading || batchBusy || pagedUsers.length === 0}
                      >
                        当前页全选
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleSelectFiltered}
                        disabled={usersLoading || batchBusy || filteredUsers.length === 0}
                      >
                        全选筛选结果
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setSelectedUserIds([])}
                        disabled={usersLoading || batchBusy || selectedUserIds.length === 0}
                      >
                        清空选择
                      </Button>
                    </Stack>
                  </Stack>

                  <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <Button size="small" variant="contained" onClick={() => void handleBatchStatus(true)} disabled={usersLoading || batchBusy}>
                      批量启用
                    </Button>
                    <Button size="small" variant="outlined" color="warning" onClick={() => void handleBatchStatus(false)} disabled={usersLoading || batchBusy}>
                      批量停用
                    </Button>
                    <Button size="small" variant="outlined" color="secondary" onClick={() => void handleBatchRole('Admin')} disabled={usersLoading || batchBusy}>
                      设为管理员
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => void handleBatchRole('User')} disabled={usersLoading || batchBusy}>
                      设为普通用户
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </Stack>
          )}
          footer={filteredUsers.length > 0 ? (
            <TablePagination
              page={userPage}
              totalPages={userTotalPages}
              totalItems={sortedUsers.length}
              onPageChange={setUserPage}
              infoText={`共 ${sortedUsers.length} 个用户，第 ${userPage}/${userTotalPages} 页`}
            />
          ) : null}
          tableMinWidth={1760}
        >

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
                        <Checkbox
                          size="small"
                          checked={allCurrentPageSelected}
                          onChange={(event) => handleToggleCurrentPage(event.target.checked)}
                          aria-label="全选当前页"
                          sx={{ p: 0.25 }}
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
                      <SortableHeader field="totalTrades" currentField={userSortField} currentOrder={userSortOrder} onSort={handleUserSort} className="admin-page__th-record">
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
                      const passwordDraft = passwordDrafts[user.id] ?? '';
                      const isProtectedAdmin = user.isAdmin;

                      return (
                        <tr key={user.id}>
                          <td className="admin-page__checkbox-col" data-label="选择">
                            <Checkbox
                              size="small"
                              disabled={isProtectedAdmin}
                              checked={selectedUserIdSet.has(user.id)}
                              onChange={() => toggleUserSelection(user.id)}
                              aria-label={`选择 ${user.username}`}
                              sx={{ p: 0.25 }}
                            />
                          </td>
                          <td data-label="用户">
                            <div className="admin-page__table-user">
                              <Avatar
                                src={user.avatarUrl || undefined}
                                alt={`${user.username}头像`}
                                sx={{ width: 42, height: 42, fontSize: '1rem', borderRadius: 2.5 }}
                              >
                                {user.avatarUrl ? (
                                  undefined
                                ) : (
                                  getInitial(user.username)
                                )}
                              </Avatar>
                              <div className="admin-page__table-user-meta">
                                <div className="admin-page__user-title-row">
                                  <strong>{user.username}</strong>
                                  {hasUserData(user) ? (
                                    <Chip size="small" color="info" label="有数据" />
                                  ) : (
                                    <Chip size="small" variant="outlined" label="未录入" />
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
                            <Chip
                              size="small"
                              color={user.isAdmin ? 'warning' : 'default'}
                              variant={user.isAdmin ? 'filled' : 'outlined'}
                              label={user.isAdmin ? '管理员' : '普通用户'}
                            />
                          </td>
                          <td data-label="状态">
                            <Chip
                              size="small"
                              color={user.isActive ? 'success' : 'default'}
                              variant={user.isActive ? 'filled' : 'outlined'}
                              label={user.isActive ? '已启用' : '已停用'}
                            />
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
                          <td data-label="战绩" className="admin-page__td-record">
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
                              {isProtectedAdmin ? (
                                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                                  管理员账号受保护，不允许执行状态、角色或密码操作。
                                </Typography>
                              ) : (
                                <>
                                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      onClick={() => void handleUserStatus(user, !user.isActive)}
                                      disabled={isBusy}
                                    >
                                      {user.isActive ? '停用' : '启用'}
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="secondary"
                                      onClick={() => void handleUserRole(user, 'Admin')}
                                      disabled={isBusy || !user.isActive}
                                    >
                                      设为管理员
                                    </Button>
                                  </Stack>
                                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'center' } }}>
                                    <TextField
                                      size="small"
                                      type="password"
                                      autoComplete="new-password"
                                      value={passwordDraft}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setPasswordDrafts((current) => ({ ...current, [user.id]: value }));
                                      }}
                                      placeholder="输入新密码"
                                      fullWidth
                                    />
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="error"
                                      onClick={() => void handleResetPassword(user)}
                                      disabled={isBusy}
                                      sx={{ flexShrink: 0 }}
                                    >
                                      {isBusy ? '处理中...' : '重置'}
                                    </Button>
                                  </Stack>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </>
          )}
        </ResponsiveTableShell>
      )}

      {activeTab === 'settings' && (
        <SectionCard
          title="系统设置"
          description="这里接管原来的单独设置页。"
        >
          <ConfigPage embedded />
        </SectionCard>
      )}

      {activeTab === 'audits' && (
        <SectionCard
          title="图片识别审计"
          description="审计功能已经迁到后台，支持从录入页按审计 ID 直接跳进来。"
        >
          <PortfolioImportAuditPage embedded />
        </SectionCard>
      )}

      {activeTab === 'reflection' && (
        <SectionCard
          title="吾日三省吾身原文维护"
          description="这里维护的是全量原文；普通用户页面会自动按日期分组、按句拆分并只读展示。"
          actions={(
            <Button
              variant="outlined"
              onClick={() => void loadReflection()}
              disabled={reflectionLoading}
              sx={{ minWidth: { xs: '100%', sm: 112 } }}
            >
              {reflectionLoading ? '刷新中...' : '刷新原文'}
            </Button>
          )}
        >

          {reflectionError && <Alert severity="error">{reflectionError}</Alert>}
          {reflectionSuccess && <Alert severity="success">{reflectionSuccess}</Alert>}

          {reflectionLoading && !reflectionLoaded ? (
            <div className="admin-page__empty">正在加载吾日三省吾身原文...</div>
          ) : (
            <>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Chip label={`最近维护：${formatDateTime(reflectionUpdatedAt)}`} variant="outlined" />
                <Chip label={`维护人：${reflectionUpdatedBy || '未记录'}`} variant="outlined" />
                <Chip label={`日期段：${dateCount}`} variant="outlined" />
                <Chip label={`句子数：${sentenceCount}`} variant="outlined" />
              </Stack>

              <TextField
                multiline
                minRows={24}
                value={reflectionText}
                onChange={(event) => setReflectionText(event.target.value)}
                placeholder="请输入完整原文，建议保留每个日期单独一行，正文一行一句。"
                fullWidth
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  variant="contained"
                  onClick={handleSaveReflection}
                  disabled={reflectionSaving || !reflectionText.trim()}
                  sx={{ minWidth: { xs: '100%', sm: 120 } }}
                >
                  {reflectionSaving ? '保存中...' : '保存原文'}
                </Button>
              </Stack>
            </>
          )}
        </SectionCard>
      )}

      <Dialog
        open={restoreDialogOpen}
        onClose={handleCloseRestoreDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>确认恢复数据库</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            <Alert severity="warning">
              这会先重建当前应用正在连接的 PostgreSQL 数据库，再导入你上传的 dump 文件。当前业务数据会被彻底覆盖，恢复期间接口可能短暂报错。
            </Alert>

            {restoreFile ? (
              <Paper
                elevation={0}
                sx={(theme) => ({
                  p: 1.75,
                  borderRadius: 2.5,
                  border: `1px solid ${theme.palette.divider}`,
                  backgroundColor: theme.palette.background.default,
                })}
              >
                <Stack spacing={0.75}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    待恢复文件
                  </Typography>
                  <Typography variant="body2">{restoreFile.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    文件大小：{formatFileSize(restoreFile.size)}
                  </Typography>
                </Stack>
              </Paper>
            ) : null}

            <FormControlLabel
              control={(
                <Checkbox
                  checked={restoreConfirmed}
                  onChange={(event) => setRestoreConfirmed(event.target.checked)}
                  disabled={restoring}
                />
              )}
              label="我确认当前数据库会被上传的 dump 文件完整覆盖"
            />

            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              恢复完成后，建议立即刷新页面并重新登录，以免当前会话继续引用旧数据库状态。
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={handleCloseRestoreDialog} disabled={restoring}>
            取消
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleRestoreDatabase()}
            disabled={!restoreFile || !restoreConfirmed || restoring}
          >
            {restoring ? '恢复中...' : '确认恢复'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AdminPage;
