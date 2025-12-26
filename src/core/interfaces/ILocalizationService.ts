/**
 * 国际化服务接口
 */

import type { Disposable } from 'vscode';

/**
 * 支持的语言
 */
export type SupportedLanguage = 'auto' | 'en' | 'zh-cn';

/**
 * 翻译参数类型
 */
export interface TranslationParams {
  [key: string]: string | number;
}

/**
 * 国际化服务接口
 *
 * 负责管理多语言翻译。
 */
export interface ILocalizationService extends Disposable {
  /**
   * 获取翻译文本
   *
   * @param key - 翻译键
   * @param params - 替换参数（可选）
   * @returns 翻译后的文本
   */
  t(key: string, params?: TranslationParams): string;

  /**
   * 设置语言
   *
   * @param language - 语言代码
   */
  setLanguage(language: SupportedLanguage): void;

  /**
   * 获取当前语言
   *
   * @returns 当前语言代码
   */
  getLanguage(): SupportedLanguage;

  /**
   * 获取实际使用的语言
   *
   * 当设置为 'auto' 时返回自动检测的语言。
   *
   * @returns 实际语言代码
   */
  getEffectiveLanguage(): 'en' | 'zh-cn';
}
