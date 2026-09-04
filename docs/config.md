# 系统配置

[← 返回目录](./index.md)

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
curl -X POST http://localhost:3001/api/stock-sdk/quotes/cn \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"codes": ["600519"]}'

# 搜索股票
curl http://localhost:3001/api/stock-sdk/search?keyword=茅台 \
  -H "Authorization: Bearer <access_token>"
```
