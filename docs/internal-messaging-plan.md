# 站内消息模块规划

## 1. 目标

为当前系统增加一套自建的站内消息能力，满足以下核心需求：

- 联系人维护：添加、备注、置顶、删除
- 单聊会话：站内发送文本和图片
- 消息历史：按会话分页加载、按关键字检索
- 在线状态：显示在线/离线/最近活跃时间
- 未读管理：会话未读数、已读回写
- 权限隔离：只允许普通用户访问自己的消息数据，管理员不进入业务消息域

本期不依赖第三方付费即时通讯服务，采用当前项目后端自建 REST + SignalR。

## 2. 技术方案

### 2.1 通信模式

- REST API：联系人、会话列表、会话详情、历史搜索、发送图片、已读状态
- SignalR：新消息推送、在线状态推送
- JWT：继续复用现有自定义 `JwtMiddleware`

说明：

- 参考项目 `/Users/wangzhen/codes/ForeverLove/chat/backend` 的实现方式后，当前项目采用同类思路。
- 该参考项目本质是 ASP.NET Core SignalR，而不是裸 `WebSocket`。

### 2.2 数据模型

- `message_conversations`
  - 直接会话主表
  - 使用 `pair_key` 确保同一对用户只存在一个单聊会话
- `message_conversation_participants`
  - 会话参与人
  - 保存每个用户自己的已读位置、静音、置顶等状态
- `user_contacts`
  - 用户自己的联系人表
  - 保存备注名、置顶等联系维度属性
- `user_messages`
  - 消息正文
  - 支持 `text` / `image` / `mixed`
- `users.last_seen_at`
  - 最近活跃时间

## 3. 当前 MVP 范围

### 已纳入

- 联系人搜索和维护
- 创建/进入单聊
- 文本消息
- 图片消息上传
- 会话未读数
- 历史消息分页
- 当前会话关键字搜索
- 在线状态和最近活跃时间
- SignalR 实时收消息

### 暂不纳入

- 群聊
- 撤回消息
- 引用回复
- 已读回执明细
- 全局跨会话搜索
- 黑名单/免打扰/归档
- 文件类型扩展（非图片）

## 4. 权限与安全

- 所有消息 API 必须登录后访问
- 管理员角色不进入用户消息页面
- 每次读取会话、搜索消息、发送消息前都校验当前用户是否属于该会话
- 图片上传限制：
  - 仅允许常见图片类型
  - 默认大小上限 8MB
- 图片存储目录：
  - `wwwroot/uploads/messages/{userId}/{yyyyMM}/`

## 5. 前端交互结构

### 页面结构

- 左栏
  - 会话列表
  - 联系人列表
- 右栏
  - 当前会话头部
  - 历史消息流
  - 会话内搜索结果
  - 文本/图片发送区

### 关键状态

- 实时连接状态：`disconnected / connecting / connected / reconnecting`
- 会话未读数
- 联系人在线状态
- 当前会话搜索结果

## 6. 后端 API 规划

- `GET /api/messages/users`
  - 搜索可发起聊天的用户
- `GET /api/messages/contacts`
  - 获取联系人
- `POST /api/messages/contacts`
  - 新增或覆盖联系人
- `PUT /api/messages/contacts/{contactUserId}`
  - 更新联系人备注/置顶
- `DELETE /api/messages/contacts/{contactUserId}`
  - 删除联系人
- `POST /api/messages/conversations/direct`
  - 创建或获取单聊会话
- `GET /api/messages/conversations`
  - 获取会话列表
- `GET /api/messages/conversations/{conversationId}`
  - 获取会话详情和分页消息
- `GET /api/messages/conversations/{conversationId}/search`
  - 搜索当前会话历史
- `POST /api/messages/conversations/{conversationId}/read`
  - 标记已读
- `POST /api/messages/conversations/{conversationId}/messages`
  - 发送文本/图片消息
- `POST /api/messages/presence/heartbeat`
  - 更新活跃状态

## 7. 实时事件规划

- `NewMessage`
  - 推送新消息
- `ConversationRead`
  - 当前用户已读状态回写
- `PresenceChanged`
  - 用户在线状态变化

## 8. 后续建议迭代

### 第二阶段

- 群聊
- 会话置顶/静音独立维护
- 全局消息搜索
- 图片预览/压缩
- 最近联系人推荐

### 第三阶段

- 撤回与删除
- 引用回复
- 消息审计
- 敏感词检查
- 图片 OCR 检测和审核标记

## 9. 验收标准

- 两个普通用户可互相添加联系人并发消息
- 支持纯文本、纯图片、图文混发
- 新消息可实时送达，无需刷新页面
- 未读数在进入会话后能正确归零
- 在线状态可随连接变化更新
- 用户无法读取或发送到非自己参与的会话
- 管理员账号无法访问普通用户消息页
