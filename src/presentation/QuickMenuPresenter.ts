/**
 * 快捷菜单展示器
 *
 * 负责显示状态栏点击后的快捷菜单。
 */

import * as vscode from 'vscode';
import type { Disposable } from 'vscode';
import type { ILocalizationService } from '../core/interfaces/ILocalizationService';
import type { IQuotaService } from '../core/interfaces/IQuotaService';
import type { EventBus } from '../core/events/EventBus';
import { EventType } from '../core/events/events';

/**
 * 菜单选项
 */
interface QuickMenuItem {
  label: string;
  description: string;
  action: string;
}

/**
 * 快捷菜单展示器
 */
export class QuickMenuPresenter implements Disposable {
  private disposed: boolean = false;

  constructor(
    private readonly localizationService: ILocalizationService,
    private readonly quotaService: IQuotaService,
    private readonly eventBus?: EventBus
  ) {}

  /**
   * 显示快捷菜单
   */
  async show(): Promise<void> {
    const options: QuickMenuItem[] = [
      {
        label: `📊 ${this.localizationService.t('menu.showPanel') || 'Show Detailed Panel'}`,
        description:
          this.localizationService.t('menu.showPanelDesc') ||
          'Open detailed quota information in a panel',
        action: 'panel',
      },
      {
        label: `🔄 ${this.localizationService.t('menu.refresh') || 'Refresh Quota'}`,
        description:
          this.localizationService.t('menu.refreshDesc') ||
          'Immediately refresh quota data',
        action: 'refresh',
      },
      {
        label: `🔍 ${this.localizationService.t('menu.detectPort') || 'Re-detect Port'}`,
        description:
          this.localizationService.t('menu.detectPortDesc') ||
          'Re-detect Antigravity service port',
        action: 'detect',
      },
      {
        label: `📋 ${this.localizationService.t('menu.copyQuota') || 'Copy Quota Info'}`,
        description:
          this.localizationService.t('menu.copyQuotaDesc') ||
          'Copy current quota information to clipboard',
        action: 'copy',
      },
      {
        label: `⚙️ ${this.localizationService.t('menu.settings') || 'Open Settings'}`,
        description:
          this.localizationService.t('menu.settingsDesc') ||
          'Configure extension settings',
        action: 'settings',
      },
      {
        label: `📖 ${this.localizationService.t('menu.docs') || 'View Documentation'}`,
        description:
          this.localizationService.t('menu.docsDesc') || 'Open README on GitHub',
        action: 'docs',
      },
      {
        label: `🐛 ${this.localizationService.t('menu.reportIssue') || 'Report Issue'}`,
        description:
          this.localizationService.t('menu.reportIssueDesc') ||
          'Report a bug or request a feature',
        action: 'issue',
      },
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder:
        this.localizationService.t('menu.placeholder') || 'Select an action',
      matchOnDescription: true,
    });

    if (!selected) {
      return;
    }

    await this.handleAction(selected.action);
  }

  /**
   * 处理菜单动作
   */
  private async handleAction(action: string): Promise<void> {
    switch (action) {
      case 'panel':
        await vscode.commands.executeCommand(
          'antigravity-quota-watcher.showDetailedPanel'
        );
        break;

      case 'refresh':
        // 发布刷新请求事件
        this.eventBus?.emit(EventType.UI_REFRESH_REQUEST, undefined);
        await vscode.commands.executeCommand(
          'antigravity-quota-watcher.quickRefreshQuota'
        );
        break;

      case 'detect':
        await vscode.commands.executeCommand(
          'antigravity-quota-watcher.detectPort'
        );
        break;

      case 'copy':
        await this.copyQuotaToClipboard();
        break;

      case 'settings':
        await vscode.commands.executeCommand(
          'workbench.action.openSettings',
          'antigravity-quota-watcher'
        );
        break;

      case 'docs':
        await vscode.env.openExternal(
          vscode.Uri.parse(
            'https://github.com/redseac31001-hub/antigravity-quota-watcher#readme'
          )
        );
        break;

      case 'issue':
        await vscode.env.openExternal(
          vscode.Uri.parse(
            'https://github.com/redseac31001-hub/antigravity-quota-watcher/issues/new'
          )
        );
        break;
    }
  }

  /**
   * 复制配额信息到剪贴板
   */
  private async copyQuotaToClipboard(): Promise<void> {
    try {
      const snapshot = await this.quotaService.fetchQuotaData();

      if (!snapshot || !snapshot.models || snapshot.models.length === 0) {
        vscode.window.showWarningMessage(
          this.localizationService.t('menu.noQuotaData') ||
            'No quota data available'
        );
        return;
      }

      // 格式化配额信息
      const lines: string[] = [
        '=== Antigravity Quota Status ===',
        `Timestamp: ${new Date().toLocaleString()}`,
        '',
      ];

      // 添加计划信息
      if (snapshot.planName) {
        lines.push(`Plan: ${snapshot.planName}`);
        lines.push('');
      }

      // 添加 Prompt Credits 信息
      if (snapshot.promptCredits) {
        lines.push('Prompt Credits:');
        lines.push(
          `  Available: ${snapshot.promptCredits.available} / ${snapshot.promptCredits.monthly}`
        );
        lines.push(
          `  Remaining: ${snapshot.promptCredits.remainingPercentage.toFixed(1)}%`
        );
        lines.push('');
      }

      // 添加模型配额
      lines.push('Model Quotas:');
      for (const model of snapshot.models) {
        const percentage = model.remainingPercentage ?? 0;
        const status = model.isExhausted
          ? 'EXHAUSTED'
          : `${percentage.toFixed(1)}%`;
        lines.push(`  ${model.label}: ${status}`);
        if (model.timeUntilResetFormatted) {
          lines.push(`    Reset: ${model.timeUntilResetFormatted}`);
        }
      }

      // 复制到剪贴板
      await vscode.env.clipboard.writeText(lines.join('\n'));

      vscode.window.showInformationMessage(
        this.localizationService.t('menu.quotaCopied') ||
          'Quota information copied to clipboard'
      );
    } catch (error) {
      console.error('[QuickMenuPresenter] 复制配额失败:', error);
      vscode.window.showErrorMessage(
        this.localizationService.t('menu.copyFailed') ||
          'Failed to copy quota information'
      );
    }
  }

  /**
   * 销毁展示器
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
  }
}
