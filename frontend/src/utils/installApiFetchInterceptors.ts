import { networkActivity } from './networkActivity';

const FETCH_PATCH_FLAG = '__lies_api_fetch_patched__';
const API_GET_DEBOUNCE_MS = 180;

interface DebouncedGetEntry {
  timeoutId: number;
  execute: () => void;
  promise: Promise<Response>;
}

const isRequestObject = (value: RequestInfo | URL): value is Request =>
  typeof Request !== 'undefined' && value instanceof Request;

const resolveRequestUrl = (input: RequestInfo | URL) => {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
};

const resolveRequestMethod = (input: RequestInfo | URL, init?: RequestInit) => {
  const method = init?.method
    ?? (isRequestObject(input) ? input.method : undefined)
    ?? 'GET';

  return method.toUpperCase();
};

const isApiRequest = (url: string) => {
  try {
    const normalizedUrl = new URL(url, window.location.origin);
    return normalizedUrl.pathname.startsWith('/api/');
  } catch {
    return false;
  }
};

export const installApiFetchInterceptors = () => {
  const globalWindow = window as Window & { [FETCH_PATCH_FLAG]?: boolean };
  if (globalWindow[FETCH_PATCH_FLAG]) {
    return;
  }

  globalWindow[FETCH_PATCH_FLAG] = true;

  const nativeFetch = window.fetch.bind(window);
  const debouncedGets = new Map<string, DebouncedGetEntry>();
  const inflightGets = new Map<string, Promise<Response>>();

  const trackRequest = async (request: Promise<Response>) => {
    networkActivity.begin();

    try {
      return await request;
    } finally {
      networkActivity.end();
    }
  };

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = resolveRequestUrl(input);
    const method = resolveRequestMethod(input, init);

    if (!isApiRequest(url)) {
      return nativeFetch(input, init);
    }

    if (method !== 'GET') {
      return trackRequest(nativeFetch(input, init));
    }

    const normalizedUrl = new URL(url, window.location.origin).toString();
    const requestKey = `${method}:${normalizedUrl}`;
    const inflightRequest = inflightGets.get(requestKey);
    if (inflightRequest) {
      return inflightRequest.then((response) => response.clone());
    }

    const existingDebouncedRequest = debouncedGets.get(requestKey);
    if (existingDebouncedRequest) {
      window.clearTimeout(existingDebouncedRequest.timeoutId);
      existingDebouncedRequest.timeoutId = window.setTimeout(existingDebouncedRequest.execute, API_GET_DEBOUNCE_MS);
      return existingDebouncedRequest.promise.then((response) => response.clone());
    }

    let resolveResponse!: (response: Response) => void;
    let rejectResponse!: (reason?: unknown) => void;

    const sharedPromise = new Promise<Response>((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });

    const execute = () => {
      debouncedGets.delete(requestKey);

      const networkPromise = trackRequest(nativeFetch(input, init));
      inflightGets.set(requestKey, networkPromise);

      networkPromise
        .then(resolveResponse)
        .catch(rejectResponse)
        .finally(() => {
          inflightGets.delete(requestKey);
        });
    };

    const entry: DebouncedGetEntry = {
      timeoutId: window.setTimeout(execute, API_GET_DEBOUNCE_MS),
      execute,
      promise: sharedPromise,
    };

    debouncedGets.set(requestKey, entry);
    return sharedPromise.then((response) => response.clone());
  }) as typeof window.fetch;
};
