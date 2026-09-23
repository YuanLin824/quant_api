import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { hash } from 'bcryptjs'
import { Repository } from 'typeorm'
import { Users } from './entities/users.entity'

/**
 * 认证模块初始化服务
 *
 * 应用启动时自动创建默认管理员账户（QuantAdmin）
 * - 仅在用户不存在时创建，避免重复
 * - 密码使用 bcrypt 加密（12 轮）
 */
@Injectable()
export class AuthInitService implements OnModuleInit {
  private readonly logger = new Logger(AuthInitService.name)

  constructor(@InjectRepository(Users) private readonly userRepo: Repository<Users>) {}

  async onModuleInit() {
    await this.createDefaultAdmin()
  }

  /**
   * 创建默认管理员账户
   *
   * 用户名: QuantAdmin
   * 密码: Quant.Admin
   */
  private async createDefaultAdmin() {
    const username = 'QuantAdmin'

    // 检查用户是否已存在
    const existingUser = await this.userRepo.findOne({
      where: { username },
    })

    if (existingUser) {
      this.logger.log('默认管理员账户已存在，跳过创建')
      return
    }

    // 创建管理员用户
    const user = new Users()
    user.username = username
    user.password = await hash('Quant.Admin', 12)
    user.status = 1 // 启用状态

    await this.userRepo.save(user)

    this.logger.log('默认管理员账户创建成功')
    this.logger.log('用户名: QuantAdmin')
    this.logger.log('密码: Quant.Admin')
    this.logger.warn('请在生产环境及时修改默认密码！')
  }
}
