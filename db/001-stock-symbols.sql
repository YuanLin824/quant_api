-- 标的代码表
--
-- 开发环境由 TypeORM 的 synchronize 自动建表，本文件供**生产环境手工执行一次**
-- （生产 `synchronize = false`，不会自动建表）。
--
-- 与 src/symbols/entities/stock-symbol.entity.ts 保持一致。
--
-- code 直接作主键（已带市场前缀故全局唯一），既是 upsert 的 ON CONFLICT 目标。
-- 有意不继承 BaseEntity：本表是纯代码字典，带 delete_at 会让软删的行一直占住
-- 唯一索引位、后续同步命中死行——要删标的请直接硬删。
--
-- 只有 market 与 code 两列：数据源 stock-sdk 的 codes.* 返回纯字符串数组，
-- 不提供名称、每手股数、小数位等属性。需要名称等信息的场景请用
-- /api/westock/search 或 /api/tdx/stocks/:exchange。

CREATE TABLE IF NOT EXISTS stock_symbols (
  code   varchar(20) NOT NULL,
  market varchar(4)  NOT NULL,
  CONSTRAINT "PK_stock_symbols" PRIMARY KEY (code)
);

-- 按市场查询与分组统计
CREATE INDEX IF NOT EXISTS idx_stock_symbols_market ON stock_symbols (market);
