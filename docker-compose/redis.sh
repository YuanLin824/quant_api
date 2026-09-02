#!/bin/sh
set -e

echo "========== Redis 初始化 =========="

echo "========== 动态创建 /etc/redis/redis.users.acl 文件 =========="
cat > /etc/redis/redis.users.acl <<EOF
user default off
user ${ROOT_USER} on >${ROOT_PASS} ~* &* +@all
user ${REDIS_USER} on >${REDIS_PASS} ~${REDIS_KEY_PREFIX}* &* +@read +@write +@connection +info
user ${REDIS_USER}_readonly on >${REDIS_PASS} ~${REDIS_KEY_PREFIX}* &* +@read +@connection +info
EOF

echo "========== 动态创建 /etc/redis/redis.conf 文件 =========="
cat > /etc/redis/redis.conf <<EOF
# 基础配置
 bind                        0.0.0.0
 port                        6379
 protected-mode              yes
 timeout                     0
 tcp-keepalive               300

# 持久化 - RDB
 save                        900 1
 save                        300 100
 save                        60 10000
 dbfilename                  dump.rdb
 dir                         /data
 stop-writes-on-bgsave-error yes
 rdbcompression              yes
 rdbchecksum                 yes

# 持久化 - AOF (推荐同时开启)
 appendonly                  yes
 appendfilename              "appendonly.aof"
 appendfsync                 everysec
 no-appendfsync-on-rewrite   no
 auto-aof-rewrite-percentage 100
 auto-aof-rewrite-min-size   64mb

# 内存管理
 maxmemory                   256mb
 maxmemory-policy            allkeys-lru

# 日志
 loglevel                    notice
 logfile                     ""

# ACL 文件 (关键)
 aclfile                     /etc/redis/redis.users.acl

# 慢查询
 slowlog-log-slower-than     10000
 slowlog-max-len             128
EOF

echo "========== 使用自定义 redis.conf 配置启动 redis 服务 =========="
exec redis-server /etc/redis/redis.conf

echo "========== Redis 初始化完成 =========="
