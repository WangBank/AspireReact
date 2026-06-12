import type { QuickLoginTokenPayload } from '../services/AuthService';

const RECENT_QUICK_LOGINS_KEY = 'recent_quick_logins';
const MAX_RECENT_QUICK_LOGINS = 5;

export interface RecentQuickLoginAccount {
  username: string;
  role: string;
  isAdmin: boolean;
  avatarUrl: string | null;
  selector: string;
  validator: string;
  expiresAt: string;
  lastUsedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isValidRecentQuickLogin = (value: unknown): value is RecentQuickLoginAccount => {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.username === 'string'
    && typeof value.role === 'string'
    && typeof value.isAdmin === 'boolean'
    && (typeof value.avatarUrl === 'string' || value.avatarUrl === null)
    && typeof value.selector === 'string'
    && typeof value.validator === 'string'
    && typeof value.expiresAt === 'string'
    && typeof value.lastUsedAt === 'string';
};

const isExpired = (entry: Pick<RecentQuickLoginAccount, 'expiresAt'>): boolean => {
  const expiresAt = Date.parse(entry.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= Date.now();
};

const persistRecentQuickLogins = (entries: RecentQuickLoginAccount[]) => {
  try {
    window.localStorage.setItem(RECENT_QUICK_LOGINS_KEY, JSON.stringify(entries));
  } catch {
    // 忽略本地存储不可用。
  }
};

export const readRecentQuickLogins = (): RecentQuickLoginAccount[] => {
  try {
    const raw = window.localStorage.getItem(RECENT_QUICK_LOGINS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const validEntries = parsed
      .filter(isValidRecentQuickLogin)
      .filter((entry) => !isExpired(entry))
      .sort((left, right) => Date.parse(right.lastUsedAt) - Date.parse(left.lastUsedAt))
      .slice(0, MAX_RECENT_QUICK_LOGINS);

    persistRecentQuickLogins(validEntries);
    return validEntries;
  } catch {
    return [];
  }
};

export const upsertRecentQuickLogin = (
  account: Omit<RecentQuickLoginAccount, 'lastUsedAt' | 'selector' | 'validator' | 'expiresAt'>
    & { quickLogin: QuickLoginTokenPayload }
): RecentQuickLoginAccount[] => {
  const nextEntry: RecentQuickLoginAccount = {
    username: account.username,
    role: account.role,
    isAdmin: account.isAdmin,
    avatarUrl: account.avatarUrl,
    selector: account.quickLogin.selector,
    validator: account.quickLogin.validator,
    expiresAt: account.quickLogin.expiresAt,
    lastUsedAt: new Date().toISOString(),
  };

  const entries = [
    nextEntry,
    ...readRecentQuickLogins().filter((entry) => entry.username !== account.username),
  ].slice(0, MAX_RECENT_QUICK_LOGINS);

  persistRecentQuickLogins(entries);
  return entries;
};

export const removeRecentQuickLogin = (username: string): RecentQuickLoginAccount[] => {
  const entries = readRecentQuickLogins().filter((entry) => entry.username !== username);
  persistRecentQuickLogins(entries);
  return entries;
};
