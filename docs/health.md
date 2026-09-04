# 健康检查

[← 返回目录](./index.md)

## 检查服务状态

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

**示例**

```bash
curl http://localhost:3001/api/health
```
