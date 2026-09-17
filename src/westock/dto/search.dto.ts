import { Transform } from 'class-transformer'
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator'
import {
  type SearchScope,
  SEARCH_KEYWORD_MAX_LENGTH,
  SEARCH_SCOPES,
  TEXT_INPUT_PATTERN,
} from '../westock.constants'

/** 证券搜索的查询参数 */
export class GetSearchQueryDto {
  /**
   * 搜索关键词
   *
   * 先 trim 再校验，否则纯空白串能通过非空检查；不允许以 `-` 开头，
   * 否则会被 CLI 当作参数开关。
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: '关键词必须是字符串' })
  @IsNotEmpty({ message: '关键词不能为空' })
  @MaxLength(SEARCH_KEYWORD_MAX_LENGTH, {
    message: `关键词最长 ${SEARCH_KEYWORD_MAX_LENGTH} 个字符`,
  })
  @Matches(TEXT_INPUT_PATTERN, { message: '关键词不能以 - 开头，也不能包含控制字符' })
  keyword!: string

  /** 搜索范围（不传则返回股票与基金） */
  @IsOptional()
  @IsIn(SEARCH_SCOPES, { message: `搜索范围必须是 ${SEARCH_SCOPES.join('/')}` })
  scope?: SearchScope
}
