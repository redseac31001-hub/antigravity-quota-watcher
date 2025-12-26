/**
 * 国际化服务
 *
 * 提供多语言翻译支持，支持自动检测 VS Code 语言设置。
 */

import * as vscode from 'vscode';
import type { ILocalizationService, SupportedLanguage } from '../core/interfaces/ILocalizationService';
import type { TranslationKey, TranslationMap } from '../i18n/types';
import { en } from '../i18n/en';
import { zh_cn } from '../i18n/zh-cn';

/**
 * 翻译参数类型
 */
export interface TranslationParams {
  [key: string]: string | number;
}

/**
 * 国际化服务实现
 */
export class LocalizationService implements ILocalizationService {
  /** 单例实例（向后兼容） */
  private static instance: LocalizationService | null = null;

  /** 当前语言设置 */
  private language: SupportedLanguage = 'auto';

  /** 当前使用的翻译表 */
  private currentLocale: TranslationMap = en;

  /** 是否已销毁 */
  private disposed = false;

  /**
   * 构造函数
   *
   * @param initialLanguage - 初始语言设置
   */
  constructor(initialLanguage: SupportedLanguage = 'auto') {
    this.language = initialLanguage;
    this.updateLocale();
  }

  /**
   * 获取单例实例（向后兼容）
   *
   * @deprecated 使用 DI 容器获取实例
   */
  static getInstance(): LocalizationService {
    if (!LocalizationService.instance) {
      LocalizationService.instance = new LocalizationService();
    }
    return LocalizationService.instance;
  }

  /**
   * 重置单例实例（仅用于测试）
   */
  static resetInstance(): void {
    if (LocalizationService.instance) {
      LocalizationService.instance.dispose();
      LocalizationService.instance = null;
    }
  }

  /**
   * 获取翻译文本
   *
   * @param key - 翻译键
   * @param params - 替换参数
   * @returns 翻译后的文本
   */
  t(key: string, params?: TranslationParams): string {
    const translationKey = key as TranslationKey;
    let text = this.currentLocale[translationKey] || en[translationKey] || key;

    if (params) {
      for (const [param, value] of Object.entries(params)) {
        text = text.replace(`{${param}}`, String(value));
      }
    }

    return text;
  }

  /**
   * 设置语言
   *
   * @param language - 语言代码
   */
  setLanguage(language: SupportedLanguage): void {
    if (this.language !== language) {
      this.language = language;
      this.updateLocale();
    }
  }

  /**
   * 获取当前语言设置
   *
   * @returns 语言代码
   */
  getLanguage(): SupportedLanguage {
    return this.language;
  }

  /**
   * 获取实际使用的语言
   *
   * 当设置为 'auto' 时返回自动检测的语言。
   *
   * @returns 实际语言代码
   */
  getEffectiveLanguage(): 'en' | 'zh-cn' {
    if (this.language === 'auto') {
      const vscodeLang = vscode.env.language;
      return vscodeLang.toLowerCase().startsWith('zh') ? 'zh-cn' : 'en';
    }
    return this.language === 'zh-cn' ? 'zh-cn' : 'en';
  }

  /**
   * 更新当前翻译表
   */
  private updateLocale(): void {
    const effectiveLang = this.getEffectiveLanguage();
    this.currentLocale = effectiveLang === 'zh-cn' ? zh_cn : en;
  }

  /**
   * 销毁服务
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    // 如果是单例实例，清除引用
    if (LocalizationService.instance === this) {
      LocalizationService.instance = null;
    }
  }
}
