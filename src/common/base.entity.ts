import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

/**
 * PostgreSQL 实体基类
 *
 * 所有业务实体继承此类，获得统一的基础字段：
 * - id: UUID 主键，数据库自动生成
 * - status: 软开关（0=禁用, 1=启用），用于业务停用而非删除
 * - createAt: 创建时间，由数据库自动填充
 * - updateAt: 更新时间，由数据库自动填充
 * - deleteAt: 软删除时间，非 NULL 表示已删除，TypeORM 查询自动过滤
 *
 * 软删除策略：使用 TypeORM @DeleteDateColumn，调用 repository.softDelete()
 * 时自动设置 deleteAt，查询时自动添加 WHERE delete_at IS NULL。
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid', { comment: '主键ID' })
  id!: string

  @Column({ name: 'status', type: 'smallint', default: 1, comment: '状态' })
  status!: number

  @CreateDateColumn({ name: 'create_at', type: 'timestamptz', comment: '创建时间' })
  createAt!: Date

  @UpdateDateColumn({ name: 'update_at', type: 'timestamptz', comment: '更新时间' })
  updateAt!: Date

  @DeleteDateColumn({
    name: 'delete_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
    comment: '软删除时间',
  })
  deleteAt!: Date
}
