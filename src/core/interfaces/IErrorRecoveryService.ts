/**
 * 错误恢复服务接口
 */

import type { Disposable } from 'vscode';
import type { ErrorType } from '../events';

/**
 * 恢复上下文
 *
 * 提供错误恢复所需的回调函数。
 */
export interface RecoveryContext {
  /** 重新检测端口的回调 */
  onRedetectPort?: () => Promise<void>;
  /** 切换 API 方法的回调 */
  onToggleApiMethod?: () => Promise<void>;
}

/**
 * 错误统计信息
 */
export interface ErrorStatistics {
  /** 总错误数 */
  totalErrors: number;
  /** 最近时间窗口内的错误数 */
  recentErrors: number;
  /** 按错误类型分类的计数 */
  errorTypes: Map<ErrorType, number>;
}

/**
 * 错误恢复服务接口
 *
 * 负责处理错误并执行恢复策略。
 */
export interface IErrorRecoveryService extends Disposable {
  /**
   * 设置恢复上下文
   *
   * @param context - 恢复上下文
   */
  setRecoveryContext(context: RecoveryContext): void;

  /**
   * 处理错误
   *
   * @param error - 错误对象
   * @param context - 恢复上下文
   */
  handleError(error: Error, context: RecoveryContext): Promise<void>;

  /**
   * 重置错误状态
   */
  reset(): void;

  /**
   * 获取错误统计信息
   *
   * @returns 错误统计
   */
  getStatistics(): ErrorStatistics;
}
