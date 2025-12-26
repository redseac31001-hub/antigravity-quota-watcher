/**
 * 状态栏服务
 *
 * 负责管理 VS Code 状态栏的 UI 显示。
 * 纯 UI 操作组件，不包含事件订阅逻辑（由 StatusBarPresenter 处理）。
 */

import * as vscode from 'vscode';
import type {
  IStatusBarService,
  DisplayStyle,
} from '../core/interfaces/IStatusBarService';
import type { ILocalizationService } from '../core/interfaces/ILocalizationService';
import type { ModelQuotaInfo, QuotaSnapshot } from '../core/types';

/**
 * 状态栏服务实现
 */
export class StatusBarService implements IStatusBarService {
  private readonly statusBarItem: vscode.StatusBarItem;
  private warningThreshold: number = 50;
  private criticalThreshold: number = 30;
  private showPromptCredits: boolean = false;
  private showPlanName: boolean = false;
  private displayStyle: DisplayStyle = 'progressBar';

  private isQuickRefreshing: boolean = false;
  private refreshStartTime: number = 0;
  private readonly minRefreshDuration: number = 1000;

  private disposed: boolean = false;

  constructor(private readonly localizationService: ILocalizationService) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'antigravity-quota-watcher.showQuota';
  }

  /**
   * 显示状态栏
   */
  show(): void {
    this.statusBarItem.show();
  }

  /**
   * 隐藏状态栏
   */
  hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * 更新配额显示
   */
  updateDisplay(snapshot: QuotaSnapshot): void {
    // 确保快速刷新动画有最小持续时间
    if (this.isQuickRefreshing && this.refreshStartTime > 0) {
      const elapsed = Date.now() - this.refreshStartTime;
      if (elapsed < this.minRefreshDuration) {
        const remaining = this.minRefreshDuration - elapsed;
        setTimeout(() => {
          this.updateDisplay(snapshot);
        }, remaining);
        return;
      }
    }

    // 清除刷新状态
    this.isQuickRefreshing = false;
    this.refreshStartTime = 0;
    // 允许快速刷新命令
    this.statusBarItem.command = 'antigravity-quota-watcher.quickRefreshQuota';

    const parts: string[] = [];

    if (this.showPlanName && snapshot.planName) {
      const planNameFormatted = this.formatPlanName(snapshot.planName);
      parts.push(`Plan: ${planNameFormatted}`);
    }

    if (this.showPromptCredits && snapshot.promptCredits) {
      const { available, monthly, remainingPercentage } = snapshot.promptCredits;
      const indicator = this.getStatusIndicator(remainingPercentage);
      const creditsPart = `${indicator} 💳 ${available}/${this.formatNumber(monthly)} (${remainingPercentage.toFixed(0)}%)`;
      parts.push(creditsPart);
    }

    const modelsToShow = this.selectModelsToDisplay(snapshot.models);

    for (const model of modelsToShow) {
      const emoji = this.getModelEmoji(model.label);
      const shortName = this.getShortModelName(model.label);
      const indicator = this.getStatusIndicator(model.remainingPercentage ?? 0);

      if (model.isExhausted) {
        if (this.displayStyle === 'percentage') {
          parts.push(`${indicator} ${emoji} ${shortName}: 0%`);
        } else if (this.displayStyle === 'dots') {
          parts.push(`${indicator} ${emoji} ${shortName} ${this.getDotsBar(0)}`);
        } else {
          parts.push(`${indicator} ${emoji} ${shortName} ${this.getProgressBar(0)}`);
        }
      } else if (model.remainingPercentage !== undefined) {
        if (this.displayStyle === 'percentage') {
          parts.push(`${indicator} ${emoji} ${shortName}: ${model.remainingPercentage.toFixed(0)}%`);
        } else if (this.displayStyle === 'dots') {
          parts.push(`${indicator} ${emoji} ${shortName} ${this.getDotsBar(model.remainingPercentage)}`);
        } else {
          parts.push(`${indicator} ${emoji} ${shortName} ${this.getProgressBar(model.remainingPercentage)}`);
        }
      }
    }

    if (parts.length === 0) {
      this.statusBarItem.text = this.localizationService.t('status.error');
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = this.localizationService.t('tooltip.error');
    } else {
      const displayText = parts.join('  ');
      this.statusBarItem.text = displayText;
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.color = undefined;
      this.updateTooltip(snapshot);
    }

    this.statusBarItem.show();
  }

  /**
   * 显示检测中状态
   */
  showDetecting(): void {
    this.statusBarItem.text = this.localizationService.t('status.detecting');
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = this.localizationService.t('status.detecting');
    this.statusBarItem.show();
  }

  /**
   * 显示初始化状态
   */
  showInitializing(): void {
    this.statusBarItem.text = this.localizationService.t('status.initializing');
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = this.localizationService.t('status.initializing');
    this.statusBarItem.show();
  }

  /**
   * 显示获取中状态
   */
  showFetching(): void {
    this.statusBarItem.text = this.localizationService.t('status.fetching');
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = this.localizationService.t('status.fetching');
    this.statusBarItem.show();
  }

  /**
   * 显示重试状态
   */
  showRetrying(current: number, max: number): void {
    this.statusBarItem.text = this.localizationService.t('status.retrying', {
      current,
      max,
    });
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.warningBackground'
    );
    this.statusBarItem.tooltip = this.localizationService.t('status.retrying', {
      current,
      max,
    });
    this.statusBarItem.show();
  }

  /**
   * 显示错误状态
   */
  showError(_message: string): void {
    this.statusBarItem.text = this.localizationService.t('status.error');
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.errorBackground'
    );
    this.statusBarItem.tooltip = `${this.localizationService.t('status.error')}\n\n${this.localizationService.t('tooltip.clickToRetry')}`;
    this.statusBarItem.command = 'antigravity-quota-watcher.refreshQuota';
    this.statusBarItem.show();
  }

  /**
   * 显示快速刷新状态
   */
  showQuickRefreshing(): void {
    if (this.isQuickRefreshing) {
      return;
    }
    this.isQuickRefreshing = true;
    this.refreshStartTime = Date.now();

    const currentText = this.statusBarItem.text;
    if (!currentText.startsWith('$(sync~spin)')) {
      this.statusBarItem.text = this.localizationService.t('status.refreshing');
    }
    this.statusBarItem.tooltip = this.localizationService.t('status.refreshing');
    this.statusBarItem.show();
  }

  /**
   * 显示未登录状态
   */
  showNotLoggedIn(): void {
    this.statusBarItem.text = this.localizationService.t('status.notLoggedIn');
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.color = new vscode.ThemeColor(
      'statusBarItem.warningForeground'
    );
    this.statusBarItem.tooltip = `${this.localizationService.t('tooltip.notLoggedIn')}\n\n${this.localizationService.t('tooltip.clickToRecheck')}`;
    this.statusBarItem.command = 'antigravity-quota-watcher.retryLoginCheck';
    this.statusBarItem.show();
  }

  /**
   * 清除错误状态
   */
  clearError(): void {
    this.statusBarItem.text = this.localizationService.t('status.fetching');
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = this.localizationService.t('status.fetching');
    this.statusBarItem.command = 'antigravity-quota-watcher.showQuota';
    this.statusBarItem.show();
  }

  /**
   * 设置阈值
   */
  setThresholds(warning: number, critical: number): void {
    this.warningThreshold = warning;
    this.criticalThreshold = critical;
  }

  /**
   * 设置显示选项
   */
  setDisplayOptions(
    showPromptCredits: boolean,
    showPlanName: boolean,
    displayStyle: DisplayStyle
  ): void {
    this.showPromptCredits = showPromptCredits;
    this.showPlanName = showPlanName;
    this.displayStyle = displayStyle;
  }

  /**
   * 销毁服务
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.statusBarItem.dispose();
  }

  /**
   * 根据剩余百分比返回状态指示符号
   */
  private getStatusIndicator(percentage: number): string {
    if (percentage <= 0) {
      return '⛔';
    } else if (percentage <= this.criticalThreshold) {
      return '🔴';
    } else if (percentage <= this.warningThreshold) {
      return '🟡';
    }
    return '🟢';
  }

  /**
   * 更新 tooltip
   */
  private updateTooltip(snapshot: QuotaSnapshot): void {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;

    // 标题
    md.appendMarkdown(`### ${this.localizationService.t('tooltip.title')}\n\n`);
    md.appendMarkdown(`---\n\n`);

    // 计划信息
    if (this.showPlanName && snapshot.planName) {
      md.appendMarkdown(`📦 **Plan:** ${snapshot.planName}\n\n`);
    }

    // Prompt Credits 区域
    if (this.showPromptCredits && snapshot.promptCredits) {
      md.appendMarkdown(`${this.localizationService.t('tooltip.credits')}\n`);
      md.appendMarkdown(
        `- ${this.localizationService.t('tooltip.available')}: \`${snapshot.promptCredits.available} / ${snapshot.promptCredits.monthly}\`\n`
      );
      md.appendMarkdown(
        `- ${this.localizationService.t('tooltip.remaining')}: **${snapshot.promptCredits.remainingPercentage.toFixed(1)}%**\n\n`
      );
    }

    // 模型配额表格
    const sortedModels = [...snapshot.models].sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    if (sortedModels.length > 0) {
      md.appendMarkdown(
        `**${this.localizationService.t('tooltip.model')} Quotas:**\n\n`
      );
      md.appendMarkdown(
        `| ${this.localizationService.t('tooltip.model')} | Progress | ${this.localizationService.t('tooltip.status')} | ${this.localizationService.t('tooltip.resetTime')} |\n`
      );
      md.appendMarkdown(`| :--- | :---: | :---: | :--- |\n`);

      for (const model of sortedModels) {
        const emoji = this.getModelEmoji(model.label);
        const name = model.label;
        const indicator = this.getStatusIndicator(model.remainingPercentage ?? 0);

        let status = '';
        let progressBar = '';
        if (model.isExhausted) {
          status = this.localizationService.t('tooltip.depleted');
          progressBar = this.createAsciiProgressBar(0);
        } else if (model.remainingPercentage !== undefined) {
          status = `${model.remainingPercentage.toFixed(1)}%`;
          progressBar = this.createAsciiProgressBar(model.remainingPercentage);
        }

        md.appendMarkdown(
          `| ${indicator} ${emoji} ${name} | ${progressBar} | ${status} | ${model.timeUntilResetFormatted} |\n`
        );
      }
    }

    // 底部提示
    md.appendMarkdown(`\n---\n\n`);
    md.appendMarkdown(`💡 **Tip:** Click to open quick menu\n`);

    this.statusBarItem.tooltip = md;
  }

  /**
   * 创建 ASCII 进度条
   */
  private createAsciiProgressBar(percentage: number, width: number = 10): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `\`[${'█'.repeat(filled)}${'░'.repeat(empty)}]\``;
  }

  /**
   * 选择要显示的模型
   */
  private selectModelsToDisplay(models: ModelQuotaInfo[]): ModelQuotaInfo[] {
    const result: ModelQuotaInfo[] = [];

    const proLow = models.find((model) => this.isProLow(model.label));
    if (proLow) {
      result.push(proLow);
    }

    const claude = models.find((model) =>
      this.isClaudeWithoutThinking(model.label)
    );
    if (claude && claude !== proLow) {
      result.push(claude);
    }

    for (const model of models) {
      if (result.length >= 2) break;
      if (!result.includes(model)) {
        result.push(model);
      }
    }

    return result.slice(0, 2);
  }

  private isProLow(label: string): boolean {
    const lower = label.toLowerCase();
    return lower.includes('pro') && lower.includes('low');
  }

  private isClaudeWithoutThinking(label: string): boolean {
    const lower = label.toLowerCase();
    return lower.includes('claude') && !lower.includes('thinking');
  }

  private formatNumber(num: number): string {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}k`;
    }
    return num.toString();
  }

  private getModelEmoji(label: string): string {
    const lower = label.toLowerCase();
    if (lower.includes('claude')) {
      return '🤖';
    }
    if (lower.includes('gemini') && lower.includes('flash')) {
      return '⚡';
    }
    if (lower.includes('gemini')) {
      return '🔷';
    }
    if (lower.includes('gpt')) {
      return '🧠';
    }
    return '✨';
  }

  private getShortModelName(label: string): string {
    if (label.includes('Claude')) {
      return 'Claude';
    }
    if (label.includes('Flash')) {
      return 'Flash';
    }
    if (label.includes('Pro (High)') || label.includes('Pro (Low)') || label.includes('Pro')) {
      return 'Gemini';
    }
    if (label.includes('GPT')) {
      return 'GPT';
    }

    return label.split(' ')[0];
  }

  private getProgressBar(percentage: number): string {
    const p = Math.max(0, Math.min(100, percentage));
    const totalBlocks = 8;
    const filledBlocks = Math.round((p / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;

    const filledChar = '█';
    const emptyChar = '░';

    return `${filledChar.repeat(filledBlocks)}${emptyChar.repeat(emptyBlocks)}`;
  }

  private getDotsBar(percentage: number): string {
    const p = Math.max(0, Math.min(100, percentage));
    const totalDots = 5;
    const filledDots = Math.round((p / 100) * totalDots);
    const emptyDots = totalDots - filledDots;

    const filledChar = '●';
    const emptyChar = '○';

    return `${filledChar.repeat(filledDots)}${emptyDots > 0 ? emptyChar.repeat(emptyDots) : ''}`;
  }

  private formatPlanName(rawName: string): string {
    return rawName;
  }
}
