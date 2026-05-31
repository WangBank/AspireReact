const TOKEN_KEY = 'jwt_token';

let memoryToken: string | null = null;

const hasLocalStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const hasSessionStorage = () =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

const readStoredToken = (): string | null => {
  try {
    const localToken = hasLocalStorage() ? window.localStorage.getItem(TOKEN_KEY) : null;
    if (localToken) {
      return localToken;
    }
  } catch {
    // Ignore and continue to sessionStorage fallback.
  }

  try {
    return hasSessionStorage() ? window.sessionStorage.getItem(TOKEN_KEY) : null;
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
    if (hasLocalStorage()) {
      if (token) {
        window.localStorage.setItem(TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    }
  } catch {
    // 保留内存态 token，避免当前会话因为持久存储不可用而丢失鉴权。
  }

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
};

export const hydrateAuthToken = () => {
  memoryToken = readStoredToken();
  return memoryToken;
};
