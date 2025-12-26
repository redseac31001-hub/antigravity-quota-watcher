/**
 * 配置服务接口
 */

import type { Disposable } from 'vscode';
import type { Config, ApiMethodPreference } from '../types';

/**
 * 配置服务接口
 *
 * 负责读取和管理扩展配置。
 */
export interface IConfigService extends Disposable {
  /**
   * 获取完整配置
   *
   * @returns 配置对象
   */
  getConfig(): Config;

  /**
   * 获取轮询间隔
   *
   * @returns 轮询间隔（毫秒）
   */
  getPollingInterval(): number;

  /**
   * 获取警告阈值
   *
   * @returns 警告阈值（百分比）
   */
  getWarningThreshold(): number;

  /**
   * 获取临界阈值
   *
   * @returns 临界阈值（百分比）
   */
  getCriticalThreshold(): number;

  /**
   * 获取 API 方法偏好
   *
   * @returns API 方法偏好
   */
  getApiMethod(): ApiMethodPreference;

  /**
   * 检查扩展是否启用
   *
   * @returns 是否启用
   */
  isEnabled(): boolean;

  /**
   * 更新配置项
   *
   * @param key - 配置键
   * @param value - 配置值
   */
  updateConfig<K extends keyof Config>(key: K, value: Config[K]): Promise<void>;
}
