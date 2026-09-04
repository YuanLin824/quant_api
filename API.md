# API 文档

量化交易系统 API 接口文档。

## 基础信息

- **基础路径**: `/api`
- **默认端口**: `3001`
- **响应格式**: JSON

## 通用响应格式

所有接口返回统一的响应格式：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

### 错误响应

```json
{
  "code": 400,
  "message": "错误信息",
  "data": null
}
```

---

## 健康检查

### 检查服务状态

检查服务的运行状态、版本号、运行时长及内存使用情况。

**请求**

```
GET /api/health
```

**响应**

```json
{
  "code": 200,
  "message": "服务运行正常",
  "data": {
    "version": "0.0.1",
    "uptime": "12345s",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "memory": {
      "rss": "12MB",
      "heapUsed": "8MB"
    }
  }
}
```

---

## 认证接口

### 用户注册

注册新用户，注册成功后自动登录并返回令牌。

**请求**

```
POST /api/auth/register
```

**限流**: 每小时最多 5 次

**请求体**

| 参数     | 类型   | 必填 | 说明                                                      |
| -------- | ------ | ---- | --------------------------------------------------------- |
| username | string | 是   | 用户名，3-32 位，仅允许字母、数字、下划线                 |
| password | string | 是   | 密码，8-64 位，必须包含大写字母、小写字母、数字和特殊字符 |

**请求示例**

```json
{
  "username": "testuser",
  "password": "Password@123"
}
```

**响应**

```json
{
  "code": 201,
  "message": "注册成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "testuser"
  }
}
```

**错误响应**

- `400` - 请求参数校验失败
- `409` - 用户名已存在

---

### 用户登录

用户登录获取访问令牌。

**请求**

```
POST /api/auth/login
```

**限流**: 每 10 分钟最多 10 次

**请求体**

| 参数     | 类型   | 必填 | 说明   |
| -------- | ------ | ---- | ------ |
| username | string | 是   | 用户名 |
| password | string | 是   | 密码   |

**请求示例**

```json
{
  "username": "testuser",
  "password": "Password@123"
}
```

**响应**

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "testuser"
  }
}
```

**错误响应**

- `401` - 用户名或密码错误
- `403` - 账号已被禁用
- `429` - 登录失败次数过多，账号已被临时锁定

---

### 刷新令牌

使用刷新令牌获取新的访问令牌和刷新令牌（令牌轮换机制）。

**请求**

```
POST /api/auth/refresh
Authorization: Bearer <refresh_token>
```

**限流**: 每 10 分钟最多 20 次

**请求头**

| 参数          | 类型   | 必填 | 说明                   |
| ------------- | ------ | ---- | ---------------------- |
| Authorization | string | 是   | Bearer + refresh_token |

**响应**

```json
{
  "code": 200,
  "message": "刷新成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "testuser"
  }
}
```

**错误响应**

- `401` - 登录状态已失效，请重新登录

---

### 用户登出

登出当前设备，吊销刷新令牌。

**请求**

```
POST /api/auth/logout
```

**限流**: 不限流

**请求体**

| 参数         | 类型   | 必填 | 说明     |
| ------------ | ------ | ---- | -------- |
| refreshToken | string | 是   | 刷新令牌 |

**请求示例**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应**

```json
{
  "code": 200,
  "message": "登出成功",
  "data": null
}
```

---

### 获取用户信息

获取当前登录用户的详细信息。

**请求**

```
GET /api/auth/profile
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "username": "testuser",
    "createAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**错误响应**

- `401` - 未授权或 token 已过期
- `403` - 账号已被禁用

---

## Stock API 接口

> 所有股票接口需要 JWT 认证，请在请求头中携带 `Authorization: Bearer <access_token>`

### 获取单只股票行情

获取指定股票的实时行情数据。

**请求**

```
GET /api/stock-api/quote/:market/:code
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**路径参数**

| 参数   | 类型   | 必填 | 说明                                                        |
| ------ | ------ | ---- | ----------------------------------------------------------- |
| market | string | 是   | 市场类型: `SH`(上海) / `SZ`(深圳) / `HK`(港股) / `US`(美股) |
| code   | string | 是   | 股票代码                                                    |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "code": "SH600519",
    "name": "贵州茅台",
    "now": 1800.0,
    "percent": 0.0115,
    "low": 1780.0,
    "high": 1810.0,
    "yesterday": 1779.5,
    "source": "tencent"
  }
}
```

**示例**

```bash
# 获取A股贵州茅台行情
curl http://localhost:3001/api/stock-api/quote/SH/600519 \
  -H "Authorization: Bearer <access_token>"

# 获取港股腾讯行情
curl http://localhost:3001/api/stock-api/quote/HK/00700 \
  -H "Authorization: Bearer <access_token>"

# 获取美股苹果行情
curl http://localhost:3001/api/stock-api/quote/US/AAPL \
  -H "Authorization: Bearer <access_token>"
```

---

### 批量获取股票行情

批量获取多只股票的实时行情数据。

**请求**

```
POST /api/stock-api/quotes
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**请求体**

| 参数  | 类型     | 必填 | 说明             |
| ----- | -------- | ---- | ---------------- |
| codes | string[] | 是   | 完整股票代码数组 |

**请求示例**

```json
{
  "codes": ["SH600519", "SZ000651", "HK00700"]
}
```

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "code": "SH600519",
      "name": "贵州茅台",
      "now": 1800.0,
      "percent": 0.0115,
      "low": 1780.0,
      "high": 1810.0,
      "yesterday": 1779.5,
      "source": "tencent"
    }
  ]
}
```

---

### 获取K线数据

获取指定股票的K线数据。

**请求**

```
GET /api/stock-api/kline/:market/:code
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**路径参数**

| 参数   | 类型   | 必填 | 说明                                |
| ------ | ------ | ---- | ----------------------------------- |
| market | string | 是   | 市场类型: `SH` / `SZ` / `HK` / `US` |
| code   | string | 是   | 股票代码                            |

**查询参数**

| 参数   | 类型   | 必填 | 说明                                                         |
| ------ | ------ | ---- | ------------------------------------------------------------ |
| period | string | 否   | K线周期: `day`(日K) / `week`(周K) / `month`(月K)，默认 `day` |
| count  | number | 否   | 返回数量，默认 120                                           |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "date": "2024-01-01",
      "open": 1785.0,
      "close": 1800.0,
      "high": 1810.0,
      "low": 1780.0,
      "volume": 12345678,
      "source": "tencent"
    }
  ]
}
```

**示例**

```bash
# 获取A股贵州茅台日K线
curl http://localhost:3001/api/stock-api/kline/SH/600519?period=day&count=30 \
  -H "Authorization: Bearer <access_token>"

# 获取港股腾讯周K线
curl http://localhost:3001/api/stock-api/kline/HK/00700?period=week \
  -H "Authorization: Bearer <access_token>"
```

---

### 搜索股票

根据关键词搜索股票。

**请求**

```
GET /api/stock-api/search
Authorization: Bearer <access_token>
```

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**查询参数**

| 参数    | 类型   | 必填 | 说明       |
| ------- | ------ | ---- | ---------- |
| keyword | string | 是   | 搜索关键词 |

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "code": "SH600519",
      "name": "贵州茅台",
      "now": 1800.0,
      "percent": 0.0115,
      "low": 1780.0,
      "high": 1810.0,
      "yesterday": 1779.5,
      "source": "tencent"
    }
  ]
}
```

**示例**

```bash
# 搜索茅台
curl http://localhost:3001/api/stock-api/search?keyword=茅台 \
  -H "Authorization: Bearer <access_token>"

# 搜索格力
curl http://localhost:3001/api/stock-api/search?keyword=格力电器 \
  -H "Authorization: Bearer <access_token>"
```

---

## 认证机制

### JWT 双密钥方案

系统使用 JWT 双密钥方案进行身份验证：

- **Access Token**: 用于接口认证，有效期较短（默认 15 分钟）
- **Refresh Token**: 用于刷新访问令牌，有效期较长（默认 7 天）

### 令牌轮换

每次刷新令牌时，旧的 Refresh Token 会被吊销，同时签发新的 Access Token 和 Refresh Token。这提高了安全性，防止 Refresh Token 被盗用。

### 多设备控制

- 默认最多支持 5 个设备同时登录
- 超过设备限制时，会自动踢出最早登录的设备
- 登出操作只吊销当前设备的 Refresh Token

### 安全特性

1. **密码加密**: 使用 bcrypt 算法加密存储
2. **登录失败限制**: 连续 5 次密码错误后，账号将被锁定 15 分钟
3. **防时序攻击**: 密码比对使用恒定时间算法
4. **请求限流**: 所有接口都有访问频率限制
5. **安全头**: 使用 Helmet 设置安全 HTTP 头

---

## 默认管理员账户

系统启动时会自动创建默认管理员账户：

- **用户名**: `QuantAdmin`
- **密码**: `Quant.Admin`

> ⚠️ **安全提示**: 请在生产环境及时修改默认密码！

### 使用默认账户登录

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"QuantAdmin","password":"Quant.Admin"}'
```

---

## 环境变量配置

### 必需的环境变量

```bash
# 数据库连接
PG_URL="postgres://user:pass@host:port/db"
REDIS_URL="redis://user:pass@host:port/db"

# JWT 密钥（至少 32 字符，且两者不能相同）
JWT_ACCESS_SECRET_KEY="your-access-secret-key"
JWT_REFRESH_SECRET_KEY="your-refresh-secret-key"
```

### 可选的环境变量

```bash
# 服务配置
PORT="3001"
API_PREFIX="/api"

# JWT 配置
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# 认证配置
AUTH_MAX_DEVICES="5"

# Redis 配置
REDIS_KEY_PREFIX="quant-"

# CORS 配置（生产环境必须）
ALLOWED_ORIGINS="https://example.com"
```

---

## 错误码说明

| HTTP 状态码 | 说明                   |
| ----------- | ---------------------- |
| 200         | 请求成功               |
| 201         | 创建成功（注册）       |
| 400         | 请求参数错误           |
| 401         | 未授权或 token 已过期  |
| 403         | 禁止访问（账号被禁用） |
| 409         | 冲突（用户名已存在）   |
| 429         | 请求过于频繁           |

---

## 开发环境

### 启动服务

```bash
# 启动数据库
docker compose up -d

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置必要的环境变量

# 启动开发服务器
npm run start:dev
```

### 测试接口

```bash
# 健康检查
curl http://localhost:3001/api/health

# 注册用户
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Password@123"}'

# 用户登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Password@123"}'

# 获取用户信息（需要替换 <access_token>）
curl http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer <access_token>"

# 获取股票行情
curl http://localhost:3001/api/stock-api/quote/SH/600519
curl http://localhost:3001/api/stock-api/quote/HK/00700
curl http://localhost:3001/api/stock-api/quote/US/AAPL

# 搜索股票
curl http://localhost:3001/api/stock-api/search?keyword=茅台
```
