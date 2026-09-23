import { IsNotEmpty, IsString } from 'class-validator'

/** refresh 与 logout 共用：均只需一个 refreshToken */
export class RefreshTokenDto {
  @IsString({ message: 'refreshToken 必须是字符串' })
  @IsNotEmpty({ message: 'refreshToken 不能为空' })
  refreshToken!: string
}
