/**
 * 端口检测服务接口
 */

import type { Disposable } from 'vscode';
import type { PortDetectionResult } from '../events';

/**
 * 端口检测服务接口
 *
 * 负责检测 Antigravity 进程的端口和 CSRF 令牌。
 */
export interface IPortDetectionService extends Disposable {
  /**
   * 检测端口
   *
   * @returns 检测结果或 null（检测失败时）
   */
  detectPort(): Promise<PortDetectionResult | null>;
}

// 重新导出 PortDetectionResult 类型
export type { PortDetectionResult };
