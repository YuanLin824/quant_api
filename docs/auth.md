# 认证接口

[← 返回目录](./index.md)

> 所有认证接口需要 JWT 认证，请在请求头中携带 `Authorization: Bearer <access_token>`

## 用户注册

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

## 用户登录

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

## 刷新令牌

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

## 用户登出

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

## 获取用户信息

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
