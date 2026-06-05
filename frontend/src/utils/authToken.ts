const TOKEN_KEY = 'jwt_token';

let memoryToken: string | null = null;

const hasSessionStorage = () =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

const hasLocalStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const clearLegacyLocalToken = () => {
  try {
    if (hasLocalStorage()) {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // 忽略旧版本地缓存清理失败。
  }
};

const readStoredToken = (): string | null => {
  try {
    const sessionToken = hasSessionStorage() ? window.sessionStorage.getItem(TOKEN_KEY) : null;
    if (sessionToken) {
      return sessionToken;
    }
  } catch {
    // Ignore and continue to legacy localStorage fallback.
  }

  try {
    const legacyLocalToken = hasLocalStorage() ? window.localStorage.getItem(TOKEN_KEY) : null;
    if (!legacyLocalToken) {
      return null;
    }

    if (hasSessionStorage()) {
      window.sessionStorage.setItem(TOKEN_KEY, legacyLocalToken);
    }

    clearLegacyLocalToken();
    return legacyLocalToken;
  } catch {
    return null;
  }
};

export const getAuthToken = (): string | null => {
  if (memoryToken) {
    return memoryToken;
  }

  const storedToken = readStoredToken();
  if (storedToken) {
    memoryToken = storedToken;
  }

  return storedToken;
};

export const setAuthToken = (token: string | null) => {
  memoryToken = token;

  try {
    if (hasSessionStorage()) {
      if (token) {
        window.sessionStorage.setItem(TOKEN_KEY, token);
      } else {
        window.sessionStorage.removeItem(TOKEN_KEY);
      }
    }
  } catch {
    // 保留内存态 token，避免当前会话因为会话存储不可用而丢失鉴权。
  }

  clearLegacyLocalToken();
};

export const hydrateAuthToken = () => {
  memoryToken = readStoredToken();
  return memoryToken;
};
