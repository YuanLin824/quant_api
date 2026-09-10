# 认证接口

[← 返回目录](../API.md)

> 认证要求因接口而异：注册、登录、登出无需令牌；刷新令牌使用 `Bearer <refresh_token>`；
> 其余接口使用 `Bearer <access_token>`。

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
- `403` - 账号已被禁用，或登录失败次数过多导致账号被临时锁定
- `429` - 触发接口限流（每 10 分钟 10 次）

**账号锁定机制**

- 连续登录失败 5 次后锁定 15 分钟，期间登录返回 `403`，消息含剩余秒数
- 锁定计数存于 Redis（key: `auth:fail:{username}`），首次失败时开始计时
- 登录成功后失败计数立即清零

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

- `401` - 登录状态已失效，请重新登录（旧 token 已轮换重用、已登出、jti 伪造、用户已删除）
- `403` - 账号已被禁用

> 每次刷新都会作废旧 refresh token（轮换机制），旧 token 再次使用会返回 `401`。

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

> 登出为**幂等操作**：令牌无法解析 / 已过期 / 已登出时同样返回成功，不会报错。

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

- `401` - 未授权、token 已过期，或用户不存在/已注销
- `403` - 账号已被禁用

---

## 修改密码

修改当前用户密码，修改后所有设备需重新登录。

**请求**

```
POST /api/auth/change-password
Authorization: Bearer <access_token>
```

**限流**: 每小时最多 5 次

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**请求体**

| 参数        | 类型   | 必填 | 说明                                                        |
| ----------- | ------ | ---- | ----------------------------------------------------------- |
| oldPassword | string | 是   | 旧密码                                                      |
| newPassword | string | 是   | 新密码，8-64 位，必须包含大写字母、小写字母、数字和特殊字符 |

**请求示例**

```json
{
  "oldPassword": "OldPassword@123",
  "newPassword": "NewPassword@456"
}
```

**响应**

```json
{
  "code": 200,
  "message": "密码修改成功，请重新登录",
  "data": null
}
```

**安全说明**

- 修改密码后，所有 refresh token 立即失效
- 当前设备需要重新登录
- 防止泄露的 token 在密码修改后仍可使用

**错误响应**

- `401` - 旧密码错误，或用户不存在/已注销
- `403` - 账号已被禁用

---

## 登出所有设备

强制登出当前用户的所有设备，吊销所有 refresh token。

**请求**

```
POST /api/auth/logout-all
Authorization: Bearer <access_token>
```

**限流**: 不限流

**请求头**

| 参数          | 类型   | 必填 | 说明                  |
| ------------- | ------ | ---- | --------------------- |
| Authorization | string | 是   | Bearer + access_token |

**响应**

```json
{
  "code": 200,
  "message": "已登出所有设备",
  "data": null
}
```

**使用场景**

- 发现账号被盗用时，立即登出所有设备
- 在公共设备上忘记登出时，远程强制登出
- 安全审计后，强制所有设备重新登录

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
