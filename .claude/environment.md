# 环境变量

## 必需的环境变量

```bash
PG_URL="postgres://user:pass@host:port/db"
REDIS_URL="redis://user:pass@host:port/db"
JWT_ACCESS_SECRET_KEY="至少32字符的密钥"
JWT_REFRESH_SECRET_KEY="至少32字符的密钥（不能与access相同）"
```

## 可选的环境变量

```bash
PORT="3001"                    # 默认 3000
API_PREFIX="/api"              # 默认 /api
JWT_ACCESS_EXPIRES_IN="15m"   # 默认 15 分钟
JWT_REFRESH_EXPIRES_IN="7d"   # 默认 7 天
AUTH_MAX_DEVICES="5"          # 默认 5 个设备
REDIS_KEY_PREFIX="quant-"     # Redis key 前缀
ALLOWED_ORIGINS="https://example.com"  # 生产环境必须配置
```
