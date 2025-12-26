/**
 * 配额服务接口
 */

import type { Disposable } from 'vscode';
import type { QuotaSnapshot } from '../types';

/**
 * API 方法枚举
 */
export enum QuotaApiMethod {
  /** 获取命令模型配置 */
  COMMAND_MODEL_CONFIG = 'COMMAND_MODEL_CONFIG',
  /** 获取用户状态 */
  GET_USER_STATUS = 'GET_USER_STATUS',
}

/**
 * 配额服务接口
 *
 * 负责获取和管理配额数据，通过事件总线发布状态更新。
 */
export interface IQuotaService extends Disposable {
  /**
   * 开始轮询配额数据
   *
   * @param intervalMs - 轮询间隔（毫秒）
   */
  startPolling(intervalMs: number): Promise<void>;

  /**
   * 停止轮询
   */
  stopPolling(): void;

  /**
   * 获取配额数据
   *
   * @returns 配额快照或 null
   */
  fetchQuotaData(): Promise<QuotaSnapshot | null>;

  /**
   * 快速刷新配额数据
   *
   * 不受轮询周期限制的即时刷新。
   */
  quickRefresh(): Promise<void>;

  /**
   * 从错误状态恢复并重试
   *
   * @param pollingInterval - 恢复后的轮询间隔（毫秒）
   */
  retryFromError(pollingInterval: number): Promise<void>;

  /**
   * 设置连接信息
   *
   * @param port - 主端口
   * @param httpPort - HTTP 降级端口（可选）
   * @param csrfToken - CSRF 令牌（可选）
   */
  setConnectionInfo(port: number, httpPort?: number, csrfToken?: string): void;

  /**
   * 设置是否允许 HTTP 降级
   *
   * @param allow - 是否允许
   */
  setAllowHttpFallback(allow: boolean): void;

  /**
   * 设置 API 方法
   *
   * @param method - API 方法
   */
  setApiMethod(method: QuotaApiMethod): void;

  /**
   * 获取连续错误次数
   *
   * @returns 连续错误次数
   */
  getConsecutiveErrors(): number;

  /**
   * 检查是否正在轮询
   *
   * @returns 是否正在轮询
   */
  isPolling(): boolean;
}
