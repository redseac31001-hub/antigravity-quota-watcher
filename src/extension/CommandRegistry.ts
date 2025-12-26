/**
 * 命令注册器
 *
 * 负责注册所有扩展命令并映射到对应的处理逻辑。
 */

import * as vscode from 'vscode';
import type { Disposable } from 'vscode';
import type { IQuotaService } from '../core/interfaces/IQuotaService';
import type { ILocalizationService } from '../core/interfaces/ILocalizationService';
import type { EventBus } from '../core/events/EventBus';
import { EventType } from '../core/events/events';
import { QuotaPanel } from '../presentation/QuotaPanel';
import { QuickMenuPresenter } from '../presentation/QuickMenuPresenter';

/**
 * 命令注册器配置
 */
export interface CommandRegistryConfig {
  extensionUri: vscode.Uri;
  quotaService: IQuotaService;
  localizationService: ILocalizationService;
  eventBus: EventBus;
  onRedetectPort: () => Promise<void>;
}

/**
 * 命令注册器
 */
export class CommandRegistry implements Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private disposed: boolean = false;
  private quickMenuPresenter: QuickMenuPresenter;

  // 快速刷新冷却控制
  private lastQuickRefreshTime: number = 0;
  private readonly quickRefreshCooldown: number = 5000; // 5 秒冷却

  constructor(private readonly config: CommandRegistryConfig) {
    this.quickMenuPresenter = new QuickMenuPresenter(
      config.localizationService,
      config.quotaService,
      config.eventBus
    );

    this.registerCommands();
  }

  /**
   * 注册所有命令
   */
  private registerCommands(): void {
    // 显示快捷菜单
    this.registerCommand(
      'antigravity-quota-watcher.showQuota',
      async () => {
        await this.quickMenuPresenter.show();
      }
    );

    // 显示详细面板
    this.registerCommand(
      'antigravity-quota-watcher.showDetailedPanel',
      async () => {
        try {
          const snapshot = await this.config.quotaService.fetchQuotaData();
          QuotaPanel.createOrShow(
            this.config.extensionUri,
            snapshot,
            this.config.localizationService,
            this.config.eventBus
          );
        } catch (error) {
          console.error('[CommandRegistry] 显示详细面板失败:', error);
          vscode.window.showErrorMessage(
            this.config.localizationService.t('error.showPanelFailed') ||
              'Failed to show detailed panel'
          );
        }
      }
    );

    // 快速刷新配额
    this.registerCommand(
      'antigravity-quota-watcher.quickRefreshQuota',
      async () => {
        const now = Date.now();
        if (now - this.lastQuickRefreshTime < this.quickRefreshCooldown) {
          const remaining = Math.ceil(
            (this.quickRefreshCooldown - (now - this.lastQuickRefreshTime)) / 1000
          );
          vscode.window.showInformationMessage(
            this.config.localizationService.t('status.cooldown', { seconds: remaining }) ||
              `Please wait ${remaining} seconds before refreshing again`
          );
          return;
        }

        this.lastQuickRefreshTime = now;

        // 发布刷新请求事件
        this.config.eventBus.emit(EventType.UI_REFRESH_REQUEST, undefined);

        try {
          await this.config.quotaService.quickRefresh();
        } catch (error) {
          console.error('[CommandRegistry] 快速刷新失败:', error);
        }
      }
    );

    // 刷新配额（从错误状态恢复）
    this.registerCommand(
      'antigravity-quota-watcher.refreshQuota',
      async () => {
        this.config.eventBus.emit(EventType.UI_REFRESH_REQUEST, undefined);
      }
    );

    // 重试登录检查
    this.registerCommand(
      'antigravity-quota-watcher.retryLoginCheck',
      async () => {
        await this.config.onRedetectPort();
      }
    );

    // 检测端口
    this.registerCommand(
      'antigravity-quota-watcher.detectPort',
      async () => {
        await this.config.onRedetectPort();
      }
    );
  }

  /**
   * 注册单个命令
   */
  private registerCommand(
    commandId: string,
    handler: () => Promise<void>
  ): void {
    const disposable = vscode.commands.registerCommand(commandId, handler);
    this.disposables.push(disposable);
  }

  /**
   * 获取所有注册的 Disposables
   */
  getDisposables(): vscode.Disposable[] {
    return this.disposables;
  }

  /**
   * 销毁注册器
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.quickMenuPresenter.dispose();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
