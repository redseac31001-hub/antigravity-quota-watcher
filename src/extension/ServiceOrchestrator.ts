/**
 * 服务编排器
 *
 * 负责协调服务初始化、端口检测流程和错误处理。
 */

import * as vscode from 'vscode';
import type { Disposable } from 'vscode';
import type { IQuotaService } from '../core/interfaces/IQuotaService';
import type { IConfigService } from '../core/interfaces/IConfigService';
import type { IPortDetectionService } from '../core/interfaces/IPortDetectionService';
import type { IErrorRecoveryService } from '../core/interfaces/IErrorRecoveryService';
import type { IStatusBarService } from '../core/interfaces/IStatusBarService';
import type { ILocalizationService } from '../core/interfaces/ILocalizationService';
import type { EventBus } from '../core/events/EventBus';
import { EventType, type PortDetectionResult } from '../core/events/events';
import { QuotaApiMethod } from '../services/QuotaService';

/**
 * 服务编排器配置
 */
export interface ServiceOrchestratorConfig {
  quotaService: IQuotaService;
  configService: IConfigService;
  portDetectionService: IPortDetectionService;
  errorRecoveryService: IErrorRecoveryService;
  statusBarService: IStatusBarService;
  localizationService: ILocalizationService;
  eventBus: EventBus;
}

/**
 * 服务编排器
 */
export class ServiceOrchestrator implements Disposable {
  private eventSubscriptions: Disposable[] = [];
  private disposed: boolean = false;

  // 自动重新检测控制
  private lastAutoRedetectTime: number = 0;
  private readonly autoRedetectCooldown: number = 3 * 60 * 1000; // 3 分钟

  // 当前连接信息
  private currentPort: number = 0;
  private currentHttpPort: number = 0;
  private currentCsrfToken: string = '';

  constructor(private readonly config: ServiceOrchestratorConfig) {
    this.subscribeToEvents();
    this.setupErrorRecovery();
  }

  /**
   * 初始化编排器
   */
  async initialize(): Promise<void> {
    console.log('[ServiceOrchestrator] 开始初始化...');

    // 应用初始配置
    this.applyConfiguration();

    // 显示初始状态
    this.config.statusBarService.showDetecting();
    this.config.statusBarService.show();

    // 执行端口检测
    await this.detectPort();
  }

  /**
   * 执行端口检测
   */
  async detectPort(): Promise<boolean> {
    console.log('[ServiceOrchestrator] 开始端口检测...');

    // 发布检测开始事件
    this.config.eventBus.emit(EventType.PORT_DETECTION_START, undefined);

    try {
      const result = await this.config.portDetectionService.detectPort();

      if (result) {
        await this.onPortDetectionSuccess(result);
        return true;
      } else {
        await this.onPortDetectionFailed(new Error('端口检测返回空结果'));
        return false;
      }
    } catch (error: any) {
      await this.onPortDetectionFailed(error);
      return false;
    }
  }

  /**
   * 端口检测成功处理
   */
  private async onPortDetectionSuccess(result: PortDetectionResult): Promise<void> {
    console.log(`[ServiceOrchestrator] 端口检测成功: port=${result.port}`);

    this.currentPort = result.port;
    this.currentHttpPort = result.httpPort;
    this.currentCsrfToken = result.csrfToken;

    // 配置配额服务
    const config = this.config.configService.getConfig();
    this.config.quotaService.setConnectionInfo(
      result.port,
      result.httpPort,
      result.csrfToken
    );
    this.config.quotaService.setAllowHttpFallback(config.allowHttpFallback);

    // 设置 API 方法
    const apiMethod = config.apiMethod === 'COMMAND_MODEL_CONFIG'
      ? QuotaApiMethod.COMMAND_MODEL_CONFIG
      : QuotaApiMethod.GET_USER_STATUS;
    this.config.quotaService.setApiMethod(apiMethod);

    // 发布成功事件
    this.config.eventBus.emit(EventType.PORT_DETECTION_SUCCESS, result);

    // 如果启用，开始轮询
    if (config.enabled) {
      console.log('[ServiceOrchestrator] 启动配额轮询...');
      this.config.statusBarService.showFetching();

      // 延迟启动轮询，给服务一些初始化时间
      setTimeout(() => {
        this.config.quotaService.startPolling(config.pollingInterval);
      }, 2000);
    }
  }

  /**
   * 端口检测失败处理
   */
  private async onPortDetectionFailed(error: Error): Promise<void> {
    console.error('[ServiceOrchestrator] 端口检测失败:', error.message);

    // 发布失败事件
    this.config.eventBus.emit(EventType.PORT_DETECTION_FAILED, error);

    // 显示未登录状态
    this.config.statusBarService.showNotLoggedIn();

    // 显示重试对话框
    const retryAction = this.config.localizationService.t('action.retry') || 'Retry';
    const result = await vscode.window.showWarningMessage(
      this.config.localizationService.t('error.portDetectionFailed') ||
        'Failed to detect Antigravity service. Please ensure it is running.',
      retryAction
    );

    if (result === retryAction) {
      await this.detectPort();
    }
  }

  /**
   * 订阅事件
   */
  private subscribeToEvents(): void {
    const { eventBus } = this.config;

    // 配置变更事件
    const unsubConfig = eventBus.on(EventType.CONFIG_CHANGE, (newConfig) => {
      this.onConfigChange(newConfig);
    });
    this.eventSubscriptions.push(unsubConfig);

    // UI 刷新请求事件
    const unsubRefresh = eventBus.on(EventType.UI_REFRESH_REQUEST, () => {
      this.onRefreshRequest();
    });
    this.eventSubscriptions.push(unsubRefresh);

    // 配额获取错误事件
    const unsubError = eventBus.on(EventType.QUOTA_FETCH_ERROR, (error) => {
      this.onQuotaFetchError(error);
    });
    this.eventSubscriptions.push(unsubError);

    // 配额获取成功事件 - 重置错误恢复
    const unsubSuccess = eventBus.on(EventType.QUOTA_FETCH_SUCCESS, () => {
      this.config.errorRecoveryService.reset();
    });
    this.eventSubscriptions.push(unsubSuccess);
  }

  /**
   * 设置错误恢复上下文
   */
  private setupErrorRecovery(): void {
    this.config.errorRecoveryService.setRecoveryContext({
      onRedetectPort: async () => {
        await this.detectPort();
      },
      onToggleApiMethod: async () => {
        const config = this.config.configService.getConfig();
        const newMethod = config.apiMethod === 'GET_USER_STATUS'
          ? 'COMMAND_MODEL_CONFIG'
          : 'GET_USER_STATUS';
        await this.config.configService.updateConfig('apiMethod', newMethod);
      },
    });
  }

  /**
   * 配置变更处理
   */
  private onConfigChange(newConfig: ReturnType<IConfigService['getConfig']>): void {
    console.log('[ServiceOrchestrator] 配置变更');

    // 更新配额服务
    this.config.quotaService.setAllowHttpFallback(newConfig.allowHttpFallback);

    const apiMethod = newConfig.apiMethod === 'COMMAND_MODEL_CONFIG'
      ? QuotaApiMethod.COMMAND_MODEL_CONFIG
      : QuotaApiMethod.GET_USER_STATUS;
    this.config.quotaService.setApiMethod(apiMethod);

    // 更新状态栏服务
    this.config.statusBarService.setThresholds(
      newConfig.warningThreshold,
      newConfig.criticalThreshold
    );
    this.config.statusBarService.setDisplayOptions(
      newConfig.showPromptCredits,
      newConfig.showPlanName,
      newConfig.displayStyle
    );

    // 更新国际化服务
    this.config.localizationService.setLanguage(newConfig.language);

    // 根据启用状态控制轮询
    if (newConfig.enabled) {
      if (!this.config.quotaService.isPolling()) {
        this.config.quotaService.startPolling(newConfig.pollingInterval);
      }
    } else {
      this.config.quotaService.stopPolling();
      this.config.statusBarService.hide();
    }
  }

  /**
   * 刷新请求处理
   */
  private onRefreshRequest(): void {
    console.log('[ServiceOrchestrator] 收到刷新请求');

    const config = this.config.configService.getConfig();
    this.config.statusBarService.showQuickRefreshing();
    this.config.quotaService.retryFromError(config.pollingInterval);
  }

  /**
   * 配额获取错误处理
   */
  private onQuotaFetchError(error: Error): void {
    console.error('[ServiceOrchestrator] 配额获取错误:', error.message);

    // 检查是否需要自动重新检测
    const now = Date.now();
    const consecutiveErrors = this.config.quotaService.getConsecutiveErrors();

    if (
      consecutiveErrors >= 3 &&
      now - this.lastAutoRedetectTime > this.autoRedetectCooldown
    ) {
      console.log('[ServiceOrchestrator] 触发自动端口重新检测...');
      this.lastAutoRedetectTime = now;
      this.detectPort();
    }
  }

  /**
   * 应用配置
   */
  private applyConfiguration(): void {
    const config = this.config.configService.getConfig();

    // 配置状态栏
    this.config.statusBarService.setThresholds(
      config.warningThreshold,
      config.criticalThreshold
    );
    this.config.statusBarService.setDisplayOptions(
      config.showPromptCredits,
      config.showPlanName,
      config.displayStyle
    );

    // 配置国际化
    this.config.localizationService.setLanguage(config.language);
  }

  /**
   * 获取当前端口信息（供外部使用）
   */
  getPortInfo(): { port: number; httpPort: number; csrfToken: string } {
    return {
      port: this.currentPort,
      httpPort: this.currentHttpPort,
      csrfToken: this.currentCsrfToken,
    };
  }

  /**
   * 销毁编排器
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    console.log('[ServiceOrchestrator] 销毁编排器...');

    // 停止轮询
    this.config.quotaService.stopPolling();

    // 取消事件订阅
    for (const subscription of this.eventSubscriptions) {
      subscription.dispose();
    }
    this.eventSubscriptions = [];
  }
}
