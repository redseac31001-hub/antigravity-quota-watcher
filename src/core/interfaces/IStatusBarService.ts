/**
 * 状态栏服务接口
 */

import type { Disposable } from 'vscode';
import type { QuotaSnapshot } from '../types';

/**
 * 显示样式
 */
export type DisplayStyle = 'percentage' | 'progressBar' | 'dots';

/**
 * 状态栏服务接口
 *
 * 负责管理 VS Code 状态栏的显示。
 */
export interface IStatusBarService extends Disposable {
  /**
   * 显示状态栏
   */
  show(): void;

  /**
   * 隐藏状态栏
   */
  hide(): void;

  /**
   * 更新配额显示
   *
   * @param snapshot - 配额快照
   */
  updateDisplay(snapshot: QuotaSnapshot): void;

  /**
   * 显示检测中状态
   */
  showDetecting(): void;

  /**
   * 显示初始化状态
   */
  showInitializing(): void;

  /**
   * 显示获取中状态
   */
  showFetching(): void;

  /**
   * 显示重试状态
   *
   * @param current - 当前重试次数
   * @param max - 最大重试次数
   */
  showRetrying(current: number, max: number): void;

  /**
   * 显示错误状态
   *
   * @param message - 错误消息
   */
  showError(message: string): void;

  /**
   * 显示快速刷新状态
   */
  showQuickRefreshing(): void;

  /**
   * 显示未登录状态
   */
  showNotLoggedIn(): void;

  /**
   * 清除错误状态
   */
  clearError(): void;

  /**
   * 设置阈值
   *
   * @param warning - 警告阈值（百分比）
   * @param critical - 临界阈值（百分比）
   */
  setThresholds(warning: number, critical: number): void;

  /**
   * 设置显示选项
   *
   * @param showPromptCredits - 是否显示 Prompt Credits
   * @param showPlanName - 是否显示计划名称
   * @param displayStyle - 显示样式
   */
  setDisplayOptions(
    showPromptCredits: boolean,
    showPlanName: boolean,
    displayStyle: DisplayStyle
  ): void;
}
