import { IsString, Length, Matches } from 'class-validator'

/** 注册请求体 */
export class RegisterDto {
  @IsString({ message: '用户名必须是字符串' })
  @Length(3, 32, { message: '用户名长度须为 3-32 位' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '用户名仅允许字母、数字、下划线' })
  username!: string

  @IsString({ message: '密码必须是字符串' })
  @Length(8, 64, { message: '密码长度须为 8-64 位' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=[\]{}|\\:;"'<>,./~`])/, {
    message: '密码必须包含大写字母、小写字母、数字和特殊字符',
  })
  password!: string
}
