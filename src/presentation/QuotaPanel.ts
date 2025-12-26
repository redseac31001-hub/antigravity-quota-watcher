/**
 * 配额详情面板
 *
 * 使用 Webview 展示详细的配额信息。
 */

import * as vscode from 'vscode';
import type { Disposable } from 'vscode';
import type { QuotaSnapshot, ModelQuotaInfo } from '../core/types';
import type { ILocalizationService } from '../core/interfaces/ILocalizationService';
import type { EventBus } from '../core/events/EventBus';
import { EventType } from '../core/events/events';

/**
 * 配额面板
 */
export class QuotaPanel implements Disposable {
  public static currentPanel: QuotaPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private eventSubscriptions: vscode.Disposable[] = [];
  private disposed: boolean = false;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly localizationService: ILocalizationService,
    private readonly eventBus?: EventBus
  ) {
    this.panel = panel;

    // 设置初始内容
    this.update();

    // 监听面板关闭
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // 订阅事件
    this.subscribeToEvents();
  }

  /**
   * 创建或显示面板
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    snapshot: QuotaSnapshot | null,
    localizationService: ILocalizationService,
    eventBus?: EventBus
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // 如果已有面板，显示并更新
    if (QuotaPanel.currentPanel) {
      QuotaPanel.currentPanel.panel.reveal(column);
      QuotaPanel.currentPanel.updateContent(snapshot);
      return;
    }

    // 创建新面板
    const panel = vscode.window.createWebviewPanel(
      'antigravityQuotaDetail',
      '📊 Antigravity Quota Details',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    QuotaPanel.currentPanel = new QuotaPanel(
      panel,
      localizationService,
      eventBus
    );
    QuotaPanel.currentPanel.updateContent(snapshot);
  }

  /**
   * 订阅事件
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) {
      return;
    }

    // 订阅配额更新事件，自动刷新面板
    const unsubQuotaUpdate = this.eventBus.on(
      EventType.QUOTA_UPDATE,
      (snapshot) => {
        this.updateContent(snapshot);
      }
    );
    this.eventSubscriptions.push(unsubQuotaUpdate);
  }

  /**
   * 更新面板内容
   */
  public updateContent(snapshot: QuotaSnapshot | null): void {
    this.panel.webview.html = this.getHtmlForWebview(snapshot);
  }

  /**
   * 销毁面板
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    QuotaPanel.currentPanel = undefined;

    // 取消事件订阅
    for (const subscription of this.eventSubscriptions) {
      subscription.dispose();
    }
    this.eventSubscriptions = [];

    // 销毁面板
    this.panel.dispose();

    // 销毁其他资源
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * 更新面板标题
   */
  private update(): void {
    this.panel.title = '📊 Antigravity Quota Details';
  }

  /**
   * 生成 Webview HTML
   */
  private getHtmlForWebview(snapshot: QuotaSnapshot | null): string {
    if (!snapshot || !snapshot.models || snapshot.models.length === 0) {
      return this.getErrorHtml(
        this.localizationService.t('panel.noData') || 'No quota data available. Please refresh.'
      );
    }

    const modelRows = snapshot.models
      .map((model) => this.generateModelRow(model))
      .join('');

    const planSection = snapshot.planName
      ? `<div class="info-card">
          <h3>📦 ${this.localizationService.t('panel.planInfo') || 'Plan Information'}</h3>
          <p><strong>Plan:</strong> ${this.escapeHtml(snapshot.planName)}</p>
        </div>`
      : '';

    const creditsSection = snapshot.promptCredits
      ? `<div class="info-card">
          <h3>💳 ${this.localizationService.t('panel.promptCredits') || 'Prompt Credits'}</h3>
          <p><strong>${this.localizationService.t('tooltip.available') || 'Available'}:</strong> ${snapshot.promptCredits.available} / ${snapshot.promptCredits.monthly}</p>
          <p><strong>${this.localizationService.t('tooltip.remaining') || 'Remaining'}:</strong> ${snapshot.promptCredits.remainingPercentage.toFixed(1)}%</p>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${snapshot.promptCredits.remainingPercentage}%"></div>
          </div>
        </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quota Details</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.6;
    }

    h1 {
      font-size: 24px;
      margin-bottom: 20px;
      color: var(--vscode-titleBar-activeForeground);
    }

    h3 {
      font-size: 16px;
      margin-bottom: 10px;
      color: var(--vscode-foreground);
    }

    .info-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-left: 4px solid var(--vscode-activityBarBadge-background);
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 4px;
    }

    .info-card p {
      margin: 5px 0;
    }

    .models-section {
      margin-top: 20px;
    }

    .model-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 15px;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .model-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }

    .model-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .model-name {
      font-size: 18px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-indicator {
      font-size: 20px;
    }

    .model-percentage {
      font-size: 24px;
      font-weight: bold;
    }

    .percentage-good { color: #4caf50; }
    .percentage-warning { color: #ff9800; }
    .percentage-critical { color: #f44336; }
    .percentage-exhausted { color: #9e9e9e; }

    .progress-bar {
      height: 20px;
      background-color: var(--vscode-input-background);
      border-radius: 10px;
      overflow: hidden;
      margin: 10px 0;
      border: 1px solid var(--vscode-panel-border);
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4caf50, #8bc34a);
      transition: width 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 8px;
      color: white;
      font-size: 12px;
      font-weight: bold;
    }

    .progress-fill.warning {
      background: linear-gradient(90deg, #ff9800, #ffc107);
    }

    .progress-fill.critical {
      background: linear-gradient(90deg, #f44336, #e91e63);
    }

    .progress-fill.exhausted {
      background: #9e9e9e;
    }

    .model-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .detail-item {
      display: flex;
      flex-direction: column;
    }

    .detail-label {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 3px;
    }

    .detail-value {
      font-size: 14px;
      font-weight: 500;
    }

    .timestamp {
      text-align: center;
      margin-top: 30px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    .error-message {
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-errorForeground);
      padding: 20px;
      border-radius: 6px;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>📊 ${this.localizationService.t('panel.title') || 'Antigravity Quota Status'}</h1>

  ${planSection}
  ${creditsSection}

  <div class="models-section">
    <h3>🤖 ${this.localizationService.t('panel.modelQuotas') || 'Model Quotas'}</h3>
    ${modelRows}
  </div>

  <div class="timestamp">
    ${this.localizationService.t('panel.lastUpdated') || 'Last updated'}: ${new Date().toLocaleString()}
  </div>
</body>
</html>`;
  }

  /**
   * 生成模型行 HTML
   */
  private generateModelRow(model: ModelQuotaInfo): string {
    const percentage = model.remainingPercentage ?? 0;
    const isExhausted = model.isExhausted || percentage === 0;

    let statusClass = 'percentage-good';
    let progressClass = '';
    let statusIcon = '🟢';

    if (isExhausted) {
      statusClass = 'percentage-exhausted';
      progressClass = 'exhausted';
      statusIcon = '⚫';
    } else if (percentage < 30) {
      statusClass = 'percentage-critical';
      progressClass = 'critical';
      statusIcon = '🔴';
    } else if (percentage < 50) {
      statusClass = 'percentage-warning';
      progressClass = 'warning';
      statusIcon = '🟡';
    }

    const displayPercentage = isExhausted
      ? this.localizationService.t('tooltip.depleted') || 'Exhausted'
      : `${percentage.toFixed(1)}%`;

    return `
    <div class="model-card">
      <div class="model-header">
        <div class="model-name">
          <span class="status-indicator">${statusIcon}</span>
          <span>${this.escapeHtml(model.label)}</span>
        </div>
        <div class="model-percentage ${statusClass}">
          ${displayPercentage}
        </div>
      </div>

      <div class="progress-bar">
        <div class="progress-fill ${progressClass}" style="width: ${percentage}%"></div>
      </div>

      <div class="model-details">
        <div class="detail-item">
          <span class="detail-label">${this.localizationService.t('panel.modelId') || 'Model ID'}</span>
          <span class="detail-value">${this.escapeHtml(model.modelId || 'N/A')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">${this.localizationService.t('tooltip.resetTime') || 'Reset Time'}</span>
          <span class="detail-value">${model.resetTime ? model.resetTime.toLocaleString() : 'N/A'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">${this.localizationService.t('panel.timeUntilReset') || 'Time Until Reset'}</span>
          <span class="detail-value">${model.timeUntilResetFormatted || 'N/A'}</span>
        </div>
      </div>
    </div>`;
  }

  /**
   * 生成错误 HTML
   */
  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .error-message {
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-errorForeground);
      padding: 30px;
      border-radius: 8px;
      text-align: center;
      max-width: 400px;
    }
  </style>
</head>
<body>
  <div class="error-message">
    <h2>⚠️ ${this.localizationService.t('panel.error') || 'Error'}</h2>
    <p>${this.escapeHtml(message)}</p>
  </div>
</body>
</html>`;
  }

  /**
   * HTML 转义（防止 XSS）
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
