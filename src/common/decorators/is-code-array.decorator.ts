import { applyDecorators } from '@nestjs/common'
import { IsArray, IsNotEmpty, IsString } from 'class-validator'

/**
 * 非空字符串数组校验
 *
 * 收口「数组 + 元素为字符串 + 元素非空」三件套。
 * label 用于拼装错误消息，保持各接口中文文案一致。
 */
export function IsCodeArray(label: string) {
  return applyDecorators(
    IsArray({ message: `${label}必须是数组` }),
    IsString({ each: true, message: `${label}必须是字符串` }),
    IsNotEmpty({ each: true, message: `${label}不能为空` })
  )
}
