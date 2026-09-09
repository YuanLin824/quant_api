import { IsNotEmpty, IsString, Length, Matches } from 'class-validator'

/** 修改密码请求体 */
export class ChangePasswordDto {
  @IsString({ message: '旧密码必须是字符串' })
  @IsNotEmpty({ message: '旧密码不能为空' })
  oldPassword!: string

  @IsString({ message: '新密码必须是字符串' })
  @Length(8, 64, { message: '新密码长度须为 8-64 位' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=[\]{}|\\:;"'<>,./~`])/, {
    message: '新密码必须包含大写字母、小写字母、数字和特殊字符',
  })
  newPassword!: string
}
