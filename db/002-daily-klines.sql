-- 日 K 线表
--
-- 开发环境由 TypeORM 的 synchronize 自动建表，本文件供**生产环境手工执行一次**
-- （生产 `synchronize = false`，不会自动建表）。
--
-- 与 src/klines/entities/daily-kline.entity.ts 保持一致。
--
-- 复合主键 (code, trade_date) 既是业务主键、也是 upsert 的 ON CONFLICT 目标。
-- 有意不继承 BaseEntity：时序数据没有软删除语义（退市股票的历史行情要保留），
-- 数百万行下 id/status/时间戳也是不必要的开销。
--
-- 单位（上游 node-tdx-market 以「厘」= 元 × 1000 表示价格与成交额，成交量是「手」）：
--   open / high / low / close / amount —— 元（入库前已 ÷1000）
--   volume                            —— 手（1 手 = 100 股，保持上游原值）

CREATE TABLE IF NOT EXISTS daily_klines (
  code       varchar(20)   NOT NULL,
  trade_date date          NOT NULL,
  open       numeric(20,3) NOT NULL,
  high       numeric(20,3) NOT NULL,
  low        numeric(20,3) NOT NULL,
  close      numeric(20,3) NOT NULL,
  volume     bigint        NOT NULL,
  amount     numeric(20,3) NOT NULL,
  CONSTRAINT "PK_daily_klines" PRIMARY KEY (code, trade_date)
);

-- 按交易日查询（如「某天全市场」）；按代码查询已由主键最左前缀覆盖
CREATE INDEX IF NOT EXISTS idx_daily_klines_date ON daily_klines (trade_date);
