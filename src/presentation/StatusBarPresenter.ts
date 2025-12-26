/**
 * 状态栏展示器
 *
 * 负责订阅事件总线并协调状态栏的显示更新。
 * 是事件系统与 StatusBarService 之间的桥梁。
 */

import type { Disposable } from 'vscode';
import type { IStatusBarService } from '../core/interfaces/IStatusBarService';
import type { EventBus } from '../core/events/EventBus';
import { EventType } from '../core/events/events';

/**
 * 状态栏展示器
 */
export class StatusBarPresenter implements Disposable {
  private eventSubscriptions: Disposable[] = [];
  private disposed: boolean = false;

  constructor(
    private readonly statusBarService: IStatusBarService,
    private readonly eventBus: EventBus
  ) {
    this.subscribeToEvents();
    this.initialize();
  }

  /**
   * 初始化展示器
   */
  private initialize(): void {
    // 初始状态显示检测中
    this.statusBarService.showDetecting();
    this.statusBarService.show();
  }

  /**
   * 订阅事件
   */
  private subscribeToEvents(): void {
    // 配额更新事件
    const unsubQuotaUpdate = this.eventBus.on(
      EventType.QUOTA_UPDATE,
      (snapshot) => {
        this.statusBarService.updateDisplay(snapshot);
      }
    );
    this.eventSubscriptions.push(unsubQuotaUpdate);

    // 配额获取开始事件
    const unsubFetchStart = this.eventBus.on(
      EventType.QUOTA_FETCH_START,
      () => {
        this.statusBarService.showFetching();
      }
    );
    this.eventSubscriptions.push(unsubFetchStart);

    // 配额获取成功事件
    const unsubFetchSuccess = this.eventBus.on(
      EventType.QUOTA_FETCH_SUCCESS,
      (snapshot) => {
        this.statusBarService.updateDisplay(snapshot);
      }
    );
    this.eventSubscriptions.push(unsubFetchSuccess);

    // 重试事件
    const unsubRetry = this.eventBus.on(
      EventType.QUOTA_RETRY,
      ({ attempt, maxAttempts }) => {
        this.statusBarService.showRetrying(attempt, maxAttempts);
      }
    );
    this.eventSubscriptions.push(unsubRetry);

    // 错误事件
    const unsubError = this.eventBus.on(
      EventType.QUOTA_FETCH_ERROR,
      (error) => {
        this.statusBarService.showError(error.message);
      }
    );
    this.eventSubscriptions.push(unsubError);

    // 端口检测开始事件
    const unsubPortStart = this.eventBus.on(
      EventType.PORT_DETECTION_START,
      () => {
        this.statusBarService.showDetecting();
      }
    );
    this.eventSubscriptions.push(unsubPortStart);

    // 端口检测成功事件
    const unsubPortSuccess = this.eventBus.on(
      EventType.PORT_DETECTION_SUCCESS,
      () => {
        this.statusBarService.showFetching();
      }
    );
    this.eventSubscriptions.push(unsubPortSuccess);

    // 端口检测失败事件
    const unsubPortFailed = this.eventBus.on(
      EventType.PORT_DETECTION_FAILED,
      () => {
        this.statusBarService.showNotLoggedIn();
      }
    );
    this.eventSubscriptions.push(unsubPortFailed);

    // 配置变更事件
    const unsubConfig = this.eventBus.on(
      EventType.CONFIG_CHANGE,
      (config) => {
        this.statusBarService.setThresholds(
          config.warningThreshold,
          config.criticalThreshold
        );
        this.statusBarService.setDisplayOptions(
          config.showPromptCredits,
          config.showPlanName,
          config.displayStyle
        );
      }
    );
    this.eventSubscriptions.push(unsubConfig);

    // UI 刷新请求事件
    const unsubRefreshRequest = this.eventBus.on(
      EventType.UI_REFRESH_REQUEST,
      () => {
        this.statusBarService.showQuickRefreshing();
      }
    );
    this.eventSubscriptions.push(unsubRefreshRequest);
  }

  /**
   * 显示状态栏
   */
  show(): void {
    this.statusBarService.show();
  }

  /**
   * 隐藏状态栏
   */
  hide(): void {
    this.statusBarService.hide();
  }

  /**
   * 销毁展示器
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    // 取消所有事件订阅
    for (const subscription of this.eventSubscriptions) {
      subscription.dispose();
    }
    this.eventSubscriptions = [];

    // 销毁服务
    this.statusBarService.dispose();
  }
}
