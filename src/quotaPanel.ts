/**
 * Quota Detail Panel - Interactive Webview Panel
 */

import * as vscode from 'vscode';
import { QuotaSnapshot, ModelQuotaInfo } from './types';

export class QuotaPanel {
  public static currentPanel: QuotaPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(extensionUri: vscode.Uri, snapshot: QuotaSnapshot | null) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (QuotaPanel.currentPanel) {
      QuotaPanel.currentPanel._panel.reveal(column);
      QuotaPanel.currentPanel.updateContent(snapshot);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'antigravityQuotaDetail',
      '📊 Antigravity Quota Details',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    QuotaPanel.currentPanel = new QuotaPanel(panel, extensionUri);
    QuotaPanel.currentPanel.updateContent(snapshot);
  }

  public updateContent(snapshot: QuotaSnapshot | null) {
    this._panel.webview.html = this._getHtmlForWebview(snapshot);
  }

  public dispose() {
    QuotaPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = '📊 Antigravity Quota Details';
  }

  private _getHtmlForWebview(snapshot: QuotaSnapshot | null): string {
    if (!snapshot || !snapshot.models || snapshot.models.length === 0) {
      return this._getErrorHtml('No quota data available. Please refresh.');
    }

    const modelRows = snapshot.models
      .map(model => this._generateModelRow(model))
      .join('');

    const planSection = snapshot.planName
      ? `<div class="info-card">
          <h3>📦 Plan Information</h3>
          <p><strong>Plan:</strong> ${this._escapeHtml(snapshot.planName)}</p>
        </div>`
      : '';

    const creditsSection = snapshot.promptCredits
      ? `<div class="info-card">
          <h3>💳 Prompt Credits</h3>
          <p><strong>Available:</strong> ${snapshot.promptCredits.available} / ${snapshot.promptCredits.monthly}</p>
          <p><strong>Remaining:</strong> ${snapshot.promptCredits.remainingPercentage.toFixed(1)}%</p>
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
  <h1>📊 Antigravity Quota Status</h1>
  
  ${planSection}
  ${creditsSection}
  
  <div class="models-section">
    <h3>🤖 Model Quotas</h3>
    ${modelRows}
  </div>
  
  <div class="timestamp">
    Last updated: ${new Date().toLocaleString()}
  </div>
</body>
</html>`;
  }

  private _generateModelRow(model: ModelQuotaInfo): string {
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
    
    const displayPercentage = isExhausted ? 'Exhausted' : `${percentage.toFixed(1)}%`;
    
    return `
    <div class="model-card">
      <div class="model-header">
        <div class="model-name">
          <span class="status-indicator">${statusIcon}</span>
          <span>${this._escapeHtml(model.label)}</span>
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
          <span class="detail-label">Model ID</span>
          <span class="detail-value">${this._escapeHtml(model.modelId || 'N/A')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Reset Time</span>
          <span class="detail-value">${model.resetTime ? model.resetTime.toLocaleString() : 'N/A'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Time Until Reset</span>
          <span class="detail-value">${model.timeUntilResetFormatted || 'N/A'}</span>
        </div>
      </div>
    </div>`;
  }

  private _getErrorHtml(message: string): string {
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
    <h2>⚠️ Error</h2>
    <p>${this._escapeHtml(message)}</p>
  </div>
</body>
</html>`;
  }

  private _escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
