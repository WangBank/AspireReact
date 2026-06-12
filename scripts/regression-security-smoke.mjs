#!/usr/bin/env node

const baseUrl = process.argv[2] || process.env.BASE_URL || 'http://localhost:5535';

async function request(path, { method = 'GET', token, body, headers } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { response, status: response.status, headers: response.headers, json };
}

async function loginWithResponse(username, password) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });

  if (result.status !== 200 || !result.json?.success || !result.json?.data?.token) {
    throw new Error(`登录失败 ${username}: ${result.status} ${JSON.stringify(result.json)}`);
  }

  return result.json.data;
}

async function login(username, password) {
  const data = await loginWithResponse(username, password);
  return data.token;
}

async function quickLogin(payload) {
  const result = await request('/api/auth/quick-login', {
    method: 'POST',
    body: payload,
  });

  if (result.status !== 200 || !result.json?.success || !result.json?.data?.token) {
    throw new Error(`快速登录失败: ${result.status} ${JSON.stringify(result.json)}`);
  }

  return result.json.data;
}

function assert(condition, message, details = undefined) {
  if (!condition) {
    const suffix = details ? ` | ${JSON.stringify(details)}` : '';
    throw new Error(`${message}${suffix}`);
  }
}

async function main() {
  const adminLogin = await loginWithResponse('bank', 'Wq-.1997315421');
  const user1Login = await loginWithResponse('老秦和小王', '123456');
  const user2Login = await loginWithResponse('codex0529', '123456');
  const adminToken = adminLogin.token;
  const user1Token = user1Login.token;
  const user2Token = user2Login.token;
  const runId = Date.now();

  assert(user2Login.quickLogin?.selector && user2Login.quickLogin?.validator, '登录响应应包含快速登录票据', user2Login);

  const user2QuickLogin = await quickLogin(user2Login.quickLogin);
  assert(user2QuickLogin.username === 'codex0529', '快速登录应返回对应用户', user2QuickLogin);
  assert(user2QuickLogin.quickLogin?.selector && user2QuickLogin.quickLogin?.validator, '快速登录后应返回轮换后的票据', user2QuickLogin);

  const staleQuickLogin = await request('/api/auth/quick-login', {
    method: 'POST',
    body: user2Login.quickLogin,
  });
  assert(staleQuickLogin.status === 401, '旧快速登录票据轮换后应失效', staleQuickLogin.json);

  const unauthDashboard = await request('/api/dashboard');
  assert(unauthDashboard.status === 401, '未登录访问 dashboard 应返回 401', unauthDashboard.json);

  const unauthStockSearch = await request('/api/stock/search?keyword=000001');
  assert(unauthStockSearch.status === 401, '未登录访问 stock search 应返回 401', unauthStockSearch.json);

  const userAdminUsers = await request('/api/admin/users', { token: user2Token });
  assert(userAdminUsers.status === 403, '普通用户访问管理员接口应返回 403', userAdminUsers.json);

  const adminDashboard = await request('/api/dashboard', { token: adminToken });
  assert(adminDashboard.status === 403, '管理员访问业务 dashboard 应返回 403', adminDashboard.json);

  const userConfig = await request('/api/config', { token: user2Token });
  assert(userConfig.status === 403, '普通用户访问配置接口应返回 403', userConfig.json);

  const adminConfig = await request('/api/config', { token: adminToken });
  assert(adminConfig.status === 200, '管理员访问配置接口应返回 200', adminConfig.json);
  assert(typeof adminConfig.json?.data?.sensitiveWordsText === 'string', '配置接口应返回敏感词配置');

  const dashboardHeaders = await request('/api/dashboard', { token: user1Token });
  assert(dashboardHeaders.status === 200, '普通用户访问自己的 dashboard 应返回 200', dashboardHeaders.json);
  assert(
    dashboardHeaders.headers.get('cache-control')?.includes('no-store'),
    'API 应返回 no-store 缓存头',
    Object.fromEntries(dashboardHeaders.headers.entries()),
  );
  assert(
    dashboardHeaders.headers.get('x-content-type-options') === 'nosniff',
    'API 应返回 nosniff 头',
    Object.fromEntries(dashboardHeaders.headers.entries()),
  );

  const user1Accounts = await request('/api/account', { token: user1Token });
  const user2Accounts = await request('/api/account', { token: user2Token });
  assert(Array.isArray(user1Accounts.json?.data), 'user1 账户列表应返回数组');
  assert(Array.isArray(user2Accounts.json?.data), 'user2 账户列表应返回数组');

  const user1FirstAccountId = user1Accounts.json.data[0]?.id;
  assert(user1FirstAccountId, 'user1 应该至少存在一条账户记录');

  const user2ReadUser1Account = await request(`/api/account/${user1FirstAccountId}`, { token: user2Token });
  assert(user2ReadUser1Account.status === 404, '普通用户不应读取其他用户账户记录', user2ReadUser1Account.json);

  const user1Dates = new Set(user1Accounts.json.data.map((item) => String(item.date).slice(0, 10)));
  const user2Dates = new Set(user2Accounts.json.data.map((item) => String(item.date).slice(0, 10)));
  const reusableDate = [...user1Dates].find((date) => !user2Dates.has(date));
  assert(reusableDate, '需要找到一个 user1 有而 user2 没有的日期做隔离验证');

  const createAccount = await request('/api/account', {
    method: 'POST',
    token: user2Token,
    body: {
      date: reusableDate,
      totalAssets: 123456.78,
      positionValue: 80000,
      availableFunds: 43456.78,
      dailyPnL: 321.09,
      remark: 'security regression smoke',
    },
  });
  assert(createAccount.status === 201, '不同用户同日创建账户记录应成功', createAccount.json);

  const duplicateAccount = await request('/api/account', {
    method: 'POST',
    token: user2Token,
    body: {
      date: reusableDate,
      totalAssets: 1,
      positionValue: 1,
      availableFunds: 0,
      dailyPnL: 0,
      remark: 'duplicate account smoke',
    },
  });
  assert(duplicateAccount.status === 409, '同用户重复创建同日账户记录应返回 409', duplicateAccount.json);

  const cleanupAccountId = createAccount.json?.data?.id;
  if (cleanupAccountId) {
    const deleteAccount = await request(`/api/account/${cleanupAccountId}`, {
      method: 'DELETE',
      token: user2Token,
    });
    assert(deleteAccount.status === 200, '回归测试清理账户记录应成功', deleteAccount.json);
  }

  const createBankFlow = await request('/api/bankflow', {
    method: 'POST',
    token: user2Token,
    body: {
      date: reusableDate,
      flowType: '转入',
      amount: 1000.01,
      remark: `security regression flow ${runId}`,
    },
  });
  assert(createBankFlow.status === 201, '普通用户创建自己的银证流水应成功', createBankFlow.json);

  const createdBankFlowId = createBankFlow.json?.data?.id;
  assert(createdBankFlowId, '创建银证流水后应返回记录 ID', createBankFlow.json);

  const user1ReadUser2BankFlow = await request(`/api/bankflow/${createdBankFlowId}`, { token: user1Token });
  assert(user1ReadUser2BankFlow.status === 404, '普通用户不应读取其他用户银证流水', user1ReadUser2BankFlow.json);

  const user1DeleteUser2BankFlow = await request(`/api/bankflow/${createdBankFlowId}`, {
    method: 'DELETE',
    token: user1Token,
  });
  assert(user1DeleteUser2BankFlow.status === 404, '普通用户不应删除其他用户银证流水', user1DeleteUser2BankFlow.json);

  const cleanupBankFlow = await request(`/api/bankflow/${createdBankFlowId}`, {
    method: 'DELETE',
    token: user2Token,
  });
  assert(cleanupBankFlow.status === 200, '回归测试清理银证流水应成功', cleanupBankFlow.json);

  const createNote = await request('/api/note', {
    method: 'POST',
    token: user2Token,
    body: {
      date: reusableDate,
      stockCode: null,
      content: `security regression note ${runId}`,
    },
  });
  assert(createNote.status === 201, '普通用户创建自己的笔记应成功', createNote.json);

  const createdNoteId = createNote.json?.data?.id;
  assert(createdNoteId, '创建笔记后应返回记录 ID', createNote.json);

  const user1ReadUser2Note = await request(`/api/note?date=${reusableDate}`, { token: user1Token });
  assert(user1ReadUser2Note.status === 200, '普通用户查询自己的笔记列表应成功', user1ReadUser2Note.json);
  assert(
    !JSON.stringify(user1ReadUser2Note.json?.data ?? []).includes(`security regression note ${runId}`),
    '普通用户的笔记列表中不应出现其他用户的内容',
    user1ReadUser2Note.json,
  );

  const user1DeleteUser2Note = await request(`/api/note/${createdNoteId}`, {
    method: 'DELETE',
    token: user1Token,
  });
  assert(user1DeleteUser2Note.status === 404, '普通用户不应删除其他用户笔记', user1DeleteUser2Note.json);

  const cleanupNote = await request(`/api/note/${createdNoteId}`, {
    method: 'DELETE',
    token: user2Token,
  });
  assert(cleanupNote.status === 200, '回归测试清理笔记应成功', cleanupNote.json);

  const createTrade = await request('/api/stocktrade', {
    method: 'POST',
    token: user2Token,
    body: {
      tradeDate: reusableDate,
      stockCode: `T${runId}`.slice(0, 10),
      stockName: '安全回归票',
      board: '主板',
      buyPrice: 10.11,
      buyQuantity: 100,
      sellPrice: 0,
      sellQuantity: 0,
      positionPnL: 0,
      cumulativePnL: 0,
      costPrice: 10.11,
      currentPrice: 10.11,
      positionQuantity: 100,
      dailyPnL: 0,
      isLiquidated: false,
      sellReason: null,
      emotionTags: [],
      tradeTags: [],
      tradeNote: `security regression trade ${runId}`,
      tonghuashunLink: null,
    },
  });
  assert(createTrade.status === 201, '普通用户创建自己的交易记录应成功', createTrade.json);

  const createdTradeId = createTrade.json?.data?.id;
  assert(createdTradeId, '创建交易记录后应返回记录 ID', createTrade.json);

  const user1ReadUser2Trade = await request(`/api/stocktrade/${createdTradeId}`, { token: user1Token });
  assert(user1ReadUser2Trade.status === 404, '普通用户不应读取其他用户交易记录', user1ReadUser2Trade.json);

  const user1DeleteUser2Trade = await request(`/api/stocktrade/${createdTradeId}`, {
    method: 'DELETE',
    token: user1Token,
  });
  assert(user1DeleteUser2Trade.status === 404, '普通用户不应删除其他用户交易记录', user1DeleteUser2Trade.json);

  const cleanupTrade = await request(`/api/stocktrade/${createdTradeId}`, {
    method: 'DELETE',
    token: user2Token,
  });
  assert(cleanupTrade.status === 200, '回归测试清理交易记录应成功', cleanupTrade.json);

  const sensitiveNote = await request('/api/note', {
    method: 'POST',
    token: user2Token,
    body: {
      date: '2026-06-04',
      stockCode: null,
      content: '今天写一条傻逼测试，应该被敏感词拦截',
    },
  });
  assert(sensitiveNote.status === 400, '敏感词笔记应被拦截为 400', sensitiveNote.json);

  const userStockCacheStats = await request('/api/stock/cache/stats', { token: user2Token });
  assert(userStockCacheStats.status === 403, '普通用户不应访问 stock cache 管理接口', userStockCacheStats.json);

  const adminStockCacheStats = await request('/api/stock/cache/stats', { token: adminToken });
  assert(adminStockCacheStats.status === 200, '管理员应可访问 stock cache 管理接口', adminStockCacheStats.json);

  const captchaStatuses = [];
  for (let index = 0; index < 21; index += 1) {
    const result = await request('/api/auth/captcha');
    captchaStatuses.push(result.status);
  }
  assert(captchaStatuses.at(-1) === 429, 'captcha 接口应触发限流', captchaStatuses);

  console.log(JSON.stringify({
    baseUrl,
    checks: {
      unauthDashboard: unauthDashboard.status,
      unauthStockSearch: unauthStockSearch.status,
      userAdminUsers: userAdminUsers.status,
      adminDashboard: adminDashboard.status,
      userConfig: userConfig.status,
      adminConfig: adminConfig.status,
      user2ReadUser1Account: user2ReadUser1Account.status,
      createAccount: createAccount.status,
      duplicateAccount: duplicateAccount.status,
      createBankFlow: createBankFlow.status,
      user1ReadUser2BankFlow: user1ReadUser2BankFlow.status,
      user1DeleteUser2BankFlow: user1DeleteUser2BankFlow.status,
      createNote: createNote.status,
      user1DeleteUser2Note: user1DeleteUser2Note.status,
      createTrade: createTrade.status,
      user1ReadUser2Trade: user1ReadUser2Trade.status,
      user1DeleteUser2Trade: user1DeleteUser2Trade.status,
      sensitiveNote: sensitiveNote.status,
      userStockCacheStats: userStockCacheStats.status,
      adminStockCacheStats: adminStockCacheStats.status,
      captchaLimitLastStatus: captchaStatuses.at(-1),
    },
    message: 'security regression smoke passed',
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
