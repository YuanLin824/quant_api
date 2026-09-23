import { Column, Entity } from 'typeorm'
import { BaseEntity } from '../../common/base.entity'

/**
 * 用户实体
 *
 * password 字段设置 select: false —— 常规查询（findOne/find）不会返回该列，
 * 避免密码哈希泄露到响应体；登录校验时通过显式 select 选回。
 */
@Entity({ name: 'users' })
export class Users extends BaseEntity {
  @Column({
    name: 'username',
    type: 'varchar',
    length: 32,
    unique: true,
    comment: '用户名（唯一）',
  })
  username!: string

  @Column({
    name: 'password',
    type: 'varchar',
    length: 60,
    select: false,
    comment: '密码哈希（bcrypt，60 字符）',
  })
  password!: string
}
