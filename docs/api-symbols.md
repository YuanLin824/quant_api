# 标的代码表

[← 返回目录](../API.md)

> 三个接口均需 `Authorization: Bearer <access_token>`。
>
> 限流在全局默认（每 60 秒 60 次）之上：查询未单独配置、走全局默认；
> 手动同步是重操作（真实调用上游 API、耗时 10～25 秒），收紧到每小时 5 次。

## 查询标的代码表

分页查询标的代码表，支持按资产类型过滤与关键词模糊搜索。默认只返回在市标的。

**请求**

```
GET /api/stock-symbols
```

**限流**: 全局默认（每 60 秒 60 次）

**查询参数**

| 参数            | 类型    | 必填 | 说明                                                          |
| --------------- | ------- | ---- | ------------------------------------------------------------- |
| assetType       | string  | 否   | 资产类型过滤：`a-share`（个股）或 `a-share-index`（指数板块） |
| keyword         | string  | 否   | 关键词，对 `thscode` 或 `name` 模糊匹配，最长 32 位           |
| includeDelisted | boolean | 否   | 是否包含已退市标的，默认 `false`                              |
| page            | integer | 否   | 页码，从 1 开始，默认 `1`                                     |
| pageSize        | integer | 否   | 每页条数，默认 `20`，上限 `100`                               |

**请求示例**

```
GET /api/stock-symbols?assetType=a-share&keyword=茅台&page=1&pageSize=20
Authorization: Bearer <access_token>
```

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "total": 5578,
    "page": 1,
    "pageSize": 20,
    "items": [
      {
        "thscode": "600519.SH",
        "ticker": "600519",
        "name": "贵州茅台",
        "exchange": "SH",
        "assetType": "a-share",
        "currency": "CNY",
        "listDate": null,
        "endDate": null,
        "lastTradeDate": null,
        "lastDeliveryDate": null,
        "syncAt": "2026-09-27T15:16:21.000Z",
        "delistedAt": null
      }
    ]
  }
}
```

> `delistedAt` 非 `null` 表示该标的已从上游代码表消失（退市 / 被剔除），值为其消失的那次同步时间。
> 默认查询不返回这类标的，需显式传 `includeDelisted=true`。
>
> 字段为 `null` 表示上游未返回该值，透传不补零：实测个股（`a-share`）的 `listDate` 全部为空，
> 指数/板块（`a-share-index`）才有值；`endDate` / `lastTradeDate` / `lastDeliveryDate` 是期货期权字段，
> 当前同步的两类标的一律为 `null`。

**错误响应**

- `400` - 请求参数校验失败（如 `pageSize` 超过 100、`assetType` 不在支持范围、`page` 非整数）
- `401` - 未携带令牌或令牌无效

---

## 查询同步状态

返回标的代码表的同步概要，供前端在「同步」按钮旁展示（上次同步时间、条数分布、是否正在同步）。

**请求**

```
GET /api/stock-symbols/sync-status
```

**限流**: 全局默认（每 60 秒 60 次）

**请求示例**

```
GET /api/stock-symbols/sync-status
Authorization: Bearer <access_token>
```

**响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "lastSyncAt": "2026-09-27T15:24:07.148Z",
    "total": 7009,
    "activeTotal": 7009,
    "syncing": false,
    "byAssetType": [
      { "assetType": "a-share", "total": 5578, "active": 5578 },
      { "assetType": "a-share-index", "total": 1431, "active": 1431 }
    ]
  }
}
```

| 字段          | 类型           | 说明                                                    |
| ------------- | -------------- | ------------------------------------------------------- |
| `lastSyncAt`  | string \| null | 最后一次同步完成的时间；表为空时为 `null`               |
| `total`       | integer        | 标的表总行数（含已退市）                                |
| `activeTotal` | integer        | 仍在市的标的数（`active ≤ total`）                      |
| `syncing`     | boolean        | 当前是否有同步正在进行（定时任务或手动触发）            |
| `byAssetType` | array          | 按资产类型的分布，元素为 `{ assetType, total, active }` |

> `syncing` 为 `true` 时，此时调用手动同步会立即返回 `skipped: true`（不会重复拉取上游）。
> 表为空且尚未同步过时，`lastSyncAt` 为 `null`、各计数为 `0`。

**错误响应**

- `401` - 未携带令牌或令牌无效

---

## 手动触发同步

立即从同花顺拉取标的代码表并增量落库，等价于定时任务的即时执行。

**请求**

```
POST /api/stock-symbols/sync
```

**限流**: 每小时最多 5 次

**请求示例**

```
POST /api/stock-symbols/sync
Authorization: Bearer <access_token>
```

**响应**

```json
{
  "code": 200,
  "message": "同步完成",
  "data": {
    "fetched": 7009,
    "deactivated": 0,
    "skipped": false,
    "costMs": 12397
  }
}
```

| 字段          | 类型    | 说明                           |
| ------------- | ------- | ------------------------------ |
| `fetched`     | integer | 上游返回且在同步范围内的标的数 |
| `deactivated` | integer | 本轮被标记为「已消失」的标的数 |
| `skipped`     | boolean | 是否因已有同步在进行而整体跳过 |
| `costMs`      | integer | 耗时（毫秒）                   |

> ⚠️ 本接口会**真实调用上游同花顺**，实测耗时 10～25 秒，请求会一直等待到同步结束。
>
> 若已有同步正在进行（定时任务触发，或上一次手动触发尚未结束），返回的 `skipped` 为 `true`、
> `message` 为「已有同步正在进行中」，此时**不会重复拉取上游**。

**错误响应**

- `401` - 未携带令牌或令牌无效
- `429` - 触发接口限流（每小时 5 次）
- `502` / `503` / `504` - 上游同花顺异常，具体见 [API.md 错误码说明](../API.md#错误码说明)
