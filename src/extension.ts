/**
 * Antigravity Quota Watcher - main extension file
 */

import * as vscode from 'vscode';
import { QuotaService, QuotaApiMethod } from './quotaService';
import { StatusBarService } from './statusBar';
import { ConfigService } from './configService';
import { PortDetectionService, PortDetectionResult } from './portDetectionService';
import { Config, QuotaSnapshot } from './types';
import { LocalizationService } from './i18n/localizationService';
import { ErrorRecoveryManager } from './errorRecoveryManager';
import { QuotaPanel } from './quotaPanel';

let quotaService: QuotaService | undefined;
let statusBarService: StatusBarService | undefined;
let configService: ConfigService | undefined;
let portDetectionService: PortDetectionService | undefined;
let errorRecoveryManager: ErrorRecoveryManager | undefined;
let configChangeTimer: NodeJS.Timeout | undefined;  // 配置变更防抖定时器
const AUTO_DETECT_COOLDOWN_MS = 3 * 60 * 1000;
let lastAutoDetectTimestamp = 0;
let isAutoDetecting = false;

/**
 * Called when the extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Antigravity Quota Watcher activated');

  // Init services
  configService = new ConfigService();
  let config = configService.getConfig();

  // Initialize localization
  const localizationService = LocalizationService.getInstance();
  localizationService.setLanguage(config.language);

  // Initialize error recovery manager
  errorRecoveryManager = new ErrorRecoveryManager();

  // console.log('[Extension] Loaded config:', config);

  portDetectionService = new PortDetectionService(context);

  async function attemptAutoRedetect() {
    if (!portDetectionService || !configService) {
      return;
    }

    const now = Date.now();
    if (isAutoDetecting || now - lastAutoDetectTimestamp < AUTO_DETECT_COOLDOWN_MS) {
      return;
    }

    isAutoDetecting = true;
    lastAutoDetectTimestamp = now;

    try {
      const latestConfig = configService.getConfig();
      if (!latestConfig.enabled) {
        isAutoDetecting = false;
        return;
      }
      statusBarService?.showDetecting();
      const detectionResult = await portDetectionService.detectPort();

      if (detectionResult && detectionResult.port && detectionResult.csrfToken) {
        console.log('[Extension] Auto re-detect succeeded:', detectionResult);

        if (!quotaService) {
          quotaService = new QuotaService(
            detectionResult.port,
            detectionResult.csrfToken,
            detectionResult.httpPort,
            latestConfig.allowHttpFallback ?? false
          );
          quotaService.onQuotaUpdate((snapshot: QuotaSnapshot) => {
            statusBarService?.updateDisplay(snapshot);
          });
          quotaService.onError((error: Error) => {
            console.error('Quota fetch failed:', error);
            statusBarService?.showError('Connection failed');
            
            // Use error recovery manager
            errorRecoveryManager?.handleError(error, {
              onRedetectPort: async () => {
                await vscode.commands.executeCommand('antigravity-quota-watcher.detectPort');
              },
              onToggleApiMethod: async () => {
                const config = vscode.workspace.getConfiguration('antigravity-quota-watcher');
                const currentMethod = config.get<string>('apiMethod', 'GET_USER_STATUS');
                const newMethod = currentMethod === 'GET_USER_STATUS' ? 'COMMAND_MODEL_CONFIG' : 'GET_USER_STATUS';
                await config.update('apiMethod', newMethod, vscode.ConfigurationTarget.Global);
                console.log(`Toggled API method to: ${newMethod}`);
              }
            });
            
            attemptAutoRedetect();
          });
          quotaService.onStatus((status: 'fetching' | 'retrying', retryCount?: number) => {
            if (status === 'fetching') {
              statusBarService?.showFetching();
            } else if (status === 'retrying' && retryCount !== undefined) {
              statusBarService?.showRetrying(retryCount, 3); // MAX_RETRY_COUNT = 3
            }
          });
        }

        statusBarService?.setWarningThreshold(latestConfig.warningThreshold);
        statusBarService?.setCriticalThreshold(latestConfig.criticalThreshold);
        statusBarService?.setShowPromptCredits(latestConfig.showPromptCredits);
        statusBarService?.setShowPlanName(latestConfig.showPlanName);
        statusBarService?.setDisplayStyle(latestConfig.displayStyle);

        quotaService.setPorts(detectionResult.connectPort ?? detectionResult.port, detectionResult.httpPort);
        quotaService.setAuthInfo(undefined, detectionResult.csrfToken);
        quotaService.setAllowHttpFallback(latestConfig.allowHttpFallback ?? false);
        quotaService.setApiMethod(latestConfig.apiMethod === 'COMMAND_MODEL_CONFIG'
          ? QuotaApiMethod.COMMAND_MODEL_CONFIG
          : QuotaApiMethod.GET_USER_STATUS);
        await quotaService.startPolling(latestConfig.pollingInterval);

        statusBarService?.clearError();
      } else {
        statusBarService?.showError('Auto port detection failed');
      }
    } catch (autoDetectError) {
      console.error('[Extension] Auto re-detect failed:', autoDetectError);
    } finally {
      isAutoDetecting = false;
    }
  }

  // Init status bar
  statusBarService = new StatusBarService(
    config.warningThreshold,
    config.criticalThreshold,
    config.showPromptCredits,
    config.showPlanName,
    config.displayStyle
  );
  // 显示检测状态
  statusBarService.showDetecting();

  // Auto detect port and csrf token
  let detectedPort: number | null = null;
  let detectedCsrfToken: string | null = null;
  let detectionResult: PortDetectionResult | null = null;

  try {
    console.log('[Extension] Starting initial port detection');
    const result = await portDetectionService.detectPort();
    if (result) {
      detectionResult = result;
      detectedPort = result.port;
      detectedCsrfToken = result.csrfToken;
      console.log('[Extension] Initial port detection success:', detectionResult);
    }
  } catch (error) {
    console.error('❌ Port/CSRF detection failed', error);
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
  }

  // Ensure port and CSRF token are available
  if (!detectedPort || !detectedCsrfToken) {
    console.error('Missing port or CSRF Token, extension cannot start');
    console.error('Please ensure Antigravity language server is running');
    statusBarService.showError('Port/CSRF Detection failed, Please try restart.');
    statusBarService.show();

    // 显示用户提示,提供重试选项
    vscode.window.showWarningMessage(
      'Antigravity Quota Watcher: Unable to detect the Antigravity process.',
      'Retry',
      'Cancel'
    ).then(action => {
      if (action === 'Retry') {
        vscode.commands.executeCommand('antigravity-quota-watcher.detectPort');
      }
    });
  } else {
    // 显示初始化状态
    statusBarService.showInitializing();

    // Init quota service
    quotaService = new QuotaService(
      detectedPort,
      undefined,
      detectionResult?.httpPort,
      config.allowHttpFallback ?? false
    );
    // Set ports for HTTPS + HTTP fallback
    quotaService.setPorts(detectionResult?.connectPort ?? detectedPort, detectionResult?.httpPort);
    quotaService.setAllowHttpFallback(config.allowHttpFallback ?? false);
    // Choose endpoint based on config
    quotaService.setApiMethod(config.apiMethod === 'COMMAND_MODEL_CONFIG'
      ? QuotaApiMethod.COMMAND_MODEL_CONFIG
      : QuotaApiMethod.GET_USER_STATUS);

    // Register quota update callback
    quotaService.onQuotaUpdate((snapshot: QuotaSnapshot) => {
      statusBarService?.updateDisplay(snapshot);
    });

    // Register error callback (silent, only update status bar)
    quotaService.onError((error: Error) => {
      console.error('Quota fetch failed:', error);
      statusBarService?.showError('Connection failed');
      
      // Use error recovery manager
      errorRecoveryManager?.handleError(error, {
        onRedetectPort: async () => {
          await vscode.commands.executeCommand('antigravity-quota-watcher.detectPort');
        },
        onToggleApiMethod: async () => {
          const config = vscode.workspace.getConfiguration('antigravity-quota-watcher');
          const currentMethod = config.get<string>('apiMethod', 'GET_USER_STATUS');
          const newMethod = currentMethod === 'GET_USER_STATUS' ? 'COMMAND_MODEL_CONFIG' : 'GET_USER_STATUS';
          await config.update('apiMethod', newMethod, vscode.ConfigurationTarget.Global);
          console.log(`Toggled API method to: ${newMethod}`);
        }
      });
      
      attemptAutoRedetect();
    });

    // Register status callback
    quotaService.onStatus((status: 'fetching' | 'retrying', retryCount?: number) => {
      if (status === 'fetching') {
        statusBarService?.showFetching();
      } else if (status === 'retrying' && retryCount !== undefined) {
        statusBarService?.showRetrying(retryCount, 3); // MAX_RETRY_COUNT = 3
      }
    });

    // If enabled, start polling after a short delay
    if (config.enabled) {
      console.log('Starting quota polling after delay...');

      // 显示准备获取配额的状态
      statusBarService.showFetching();

      setTimeout(() => {
        quotaService?.setAuthInfo(undefined, detectedCsrfToken);
        quotaService?.startPolling(config.pollingInterval);
      }, 8000);

      statusBarService.show();
    }
  }

  // Command: show quota quick menu
  const showQuotaCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.showQuota',
    async () => {
      await showQuickMenu();
    }
  );

  // Command: show detailed quota panel (webview)
  const showDetailedPanelCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.showDetailedPanel',
    async () => {
      if (!quotaService) {
        vscode.window.showWarningMessage('Quota service is not initialized');
        return;
      }

      try {
        const snapshot = await quotaService.fetchQuotaData();
        QuotaPanel.createOrShow(context.extensionUri, snapshot);
      } catch (error) {
        console.error('Failed to show detailed panel:', error);
        vscode.window.showErrorMessage('Failed to load quota details');
      }
    }
  );

  // Throttle control for manual refresh
  let lastManualRefresh = 0;
  const MANUAL_REFRESH_COOLDOWN = 5000; // 5 seconds

  // Command: quick refresh quota (for success state)
  const quickRefreshQuotaCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.quickRefreshQuota',
    async () => {
      console.log('[Extension] quickRefreshQuota command invoked');
      if (!quotaService) {
        vscode.window.showWarningMessage('Quota service is not initialized');
        return;
      }

      // Throttle: prevent rapid clicking
      const now = Date.now();
      if (now - lastManualRefresh < MANUAL_REFRESH_COOLDOWN) {
        const remainingSeconds = Math.ceil((MANUAL_REFRESH_COOLDOWN - (now - lastManualRefresh)) / 1000);
        vscode.window.showInformationMessage(`⏱️ Please wait ${remainingSeconds}s before refreshing again`);
        return;
      }
      lastManualRefresh = now;

      console.log('User triggered quick quota refresh');
      // 显示刷新中状态(旋转图标)
      statusBarService?.showQuickRefreshing();
      // 立即刷新一次,不中断轮询
      await quotaService.quickRefresh();
    }
  );

  // Command: refresh quota
  const refreshQuotaCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.refreshQuota',
    async () => {
      console.log('[Extension] refreshQuota command invoked');
      if (!quotaService) {
        vscode.window.showWarningMessage('Quota service is not initialized');
        return;
      }

      vscode.window.showInformationMessage('🔄 Refreshing quota...');
      config = configService!.getConfig();
      statusBarService?.setWarningThreshold(config.warningThreshold);
      statusBarService?.setCriticalThreshold(config.criticalThreshold);
      statusBarService?.setShowPromptCredits(config.showPromptCredits);
      statusBarService?.setShowPlanName(config.showPlanName);
      statusBarService?.setDisplayStyle(config.displayStyle);
      quotaService.setAllowHttpFallback(config.allowHttpFallback ?? false);
      statusBarService?.showFetching();

      if (config.enabled) {
        quotaService.setApiMethod(config.apiMethod === 'COMMAND_MODEL_CONFIG'
          ? QuotaApiMethod.COMMAND_MODEL_CONFIG
          : QuotaApiMethod.GET_USER_STATUS);
        // 使用新的重试方法,成功后会自动恢复轮询
        await quotaService.retryFromError(config.pollingInterval);
      }
    }
  );

  // Command: retry login check
  const retryLoginCheckCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.retryLoginCheck',
    async () => {
      console.log('[Extension] retryLoginCheck command invoked');
      if (!quotaService) {
        vscode.window.showWarningMessage('Quota service is not initialized, please detect the port first');
        return;
      }

      vscode.window.showInformationMessage('🔄 Rechecking login status...');
      statusBarService?.showFetching();

      // 立即触发一次配额获取，会自动检测登录状态
      await quotaService.stopPolling();

      // 使用 setTimeout 确保有足够时间让用户登录
      setTimeout(() => {
        if (config.enabled && quotaService) {
          quotaService.startPolling(config.pollingInterval);
        }
      }, 1000);
    }
  );

  // Command: re-detect port
  const detectPortCommand = vscode.commands.registerCommand(
    'antigravity-quota-watcher.detectPort',
    async () => {
      console.log('[Extension] detectPort command invoked');
      vscode.window.showInformationMessage('🔍 Detecting port again...');

      config = configService!.getConfig();
      statusBarService?.setWarningThreshold(config.warningThreshold);
      statusBarService?.setCriticalThreshold(config.criticalThreshold);
      statusBarService?.setShowPromptCredits(config.showPromptCredits);
      statusBarService?.setShowPlanName(config.showPlanName);
      statusBarService?.setDisplayStyle(config.displayStyle);
      quotaService?.setAllowHttpFallback(config.allowHttpFallback ?? false);

      try {
        console.log('[Extension] detectPort: invoking portDetectionService');
        const result = await portDetectionService?.detectPort();

        if (result && result.port && result.csrfToken) {
          console.log('[Extension] detectPort command succeeded:', result);
          // 如果之前没有 quotaService,需要初始化
          if (!quotaService) {
            quotaService = new QuotaService(
              result.port,
              result.csrfToken,
              result.httpPort,
              config.allowHttpFallback ?? false
            );
            quotaService.setPorts(result.connectPort, result.httpPort);
            quotaService.setAllowHttpFallback(config.allowHttpFallback ?? false);

            // 注册回调
            quotaService.onQuotaUpdate((snapshot: QuotaSnapshot) => {
              statusBarService?.updateDisplay(snapshot);
            });

            quotaService.onError((error: Error) => {
              console.error('Quota fetch failed:', error);
              statusBarService?.showError('Connection failed');
              
              // Use error recovery manager
              errorRecoveryManager?.handleError(error, {
                onRedetectPort: async () => {
                  await vscode.commands.executeCommand('antigravity-quota-watcher.detectPort');
                },
                onToggleApiMethod: async () => {
                  const config = vscode.workspace.getConfiguration('antigravity-quota-watcher');
                  const currentMethod = config.get<string>('apiMethod', 'GET_USER_STATUS');
                  const newMethod = currentMethod === 'GET_USER_STATUS' ? 'COMMAND_MODEL_CONFIG' : 'GET_USER_STATUS';
                  await config.update('apiMethod', newMethod, vscode.ConfigurationTarget.Global);
                  console.log(`Toggled API method to: ${newMethod}`);
                }
              });
              
              attemptAutoRedetect();
            });

          } else {
            // 更新现有服务的端口
            quotaService.setPorts(result.connectPort, result.httpPort);
            quotaService.setAuthInfo(undefined, result.csrfToken);
            quotaService.setAllowHttpFallback(config.allowHttpFallback ?? false);
            console.log('[Extension] detectPort: updated existing QuotaService ports');
          }

          // 清除之前的错误状态
          statusBarService?.clearError();
          // Reset error recovery manager on successful detection
          errorRecoveryManager?.reset();

          quotaService.stopPolling();
          quotaService.setApiMethod(config.apiMethod === 'COMMAND_MODEL_CONFIG'
            ? QuotaApiMethod.COMMAND_MODEL_CONFIG
            : QuotaApiMethod.GET_USER_STATUS);
          quotaService.startPolling(config.pollingInterval);

          vscode.window.showInformationMessage(`✅ Detection successful! Port: ${result.port}`);
        } else {
          console.warn('[Extension] detectPort command did not return valid ports');
          vscode.window.showErrorMessage(
            '❌ Unable to detect a valid port. Please ensure:\n' +
            '1. Your Google account is signed in\n' +
            '2. The system has permission to run the detection commands'
          );
        }
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        console.error('Port detection failed:', errorMsg);
        if (error?.stack) {
          console.error('Stack:', error.stack);
        }
        vscode.window.showErrorMessage(`❌ Port detection failed: ${errorMsg}`);
      }
    }
  );

  // Listen to config changes
  const configChangeDisposable = configService.onConfigChange((newConfig) => {
    handleConfigChange(newConfig as Config);
  });

  // Add to context subscriptions
  context.subscriptions.push(
    showQuotaCommand,
    showDetailedPanelCommand,
    quickRefreshQuotaCommand,
    refreshQuotaCommand,
    retryLoginCheckCommand,
    detectPortCommand,
    configChangeDisposable,
    { dispose: () => quotaService?.dispose() },
    { dispose: () => statusBarService?.dispose() }
  );

  // Startup log
  console.log('Antigravity Quota Watcher initialized');
}

/**
 * Handle config changes with debounce to prevent race conditions
 */
function handleConfigChange(config: Config): void {
  // 防抖：300ms 内的多次变更只执行最后一次
  if (configChangeTimer) {
    clearTimeout(configChangeTimer);
  }

  configChangeTimer = setTimeout(() => {
    console.log('Config updated (debounced)', config);

    quotaService?.setApiMethod(config.apiMethod === 'COMMAND_MODEL_CONFIG'
      ? QuotaApiMethod.COMMAND_MODEL_CONFIG
      : QuotaApiMethod.GET_USER_STATUS);
    statusBarService?.setWarningThreshold(config.warningThreshold);
    statusBarService?.setCriticalThreshold(config.criticalThreshold);
    statusBarService?.setShowPromptCredits(config.showPromptCredits);
    statusBarService?.setShowPlanName(config.showPlanName);
    statusBarService?.setDisplayStyle(config.displayStyle);
    quotaService?.setAllowHttpFallback(config.allowHttpFallback ?? false);

    // Update language
    const localizationService = LocalizationService.getInstance();
    if (localizationService.getLanguage() !== config.language) {
      localizationService.setLanguage(config.language);
    }

    if (config.enabled) {
      quotaService?.startPolling(config.pollingInterval);
      statusBarService?.show();
    } else {
      quotaService?.stopPolling();
      statusBarService?.hide();
    }

    vscode.window.showInformationMessage('Antigravity Quota Watcher config updated');
  }, 300);
}

/**
 * Show quick menu for quick actions
 */
async function showQuickMenu(): Promise<void> {
  const options = [
    {
      label: '📊 Show Detailed Panel',
      description: 'Open interactive quota details panel',
      action: 'panel'
    },
    {
      label: '🔄 Refresh Now',
      description: 'Immediately refresh quota data',
      action: 'refresh'
    },
    {
      label: '🔍 Re-detect Port',
      description: 'Re-detect Antigravity service port',
      action: 'detect'
    },
    {
      label: '📋 Copy Quota Info',
      description: 'Copy current quota information to clipboard',
      action: 'copy'
    },
    {
      label: '⚙️ Open Settings',
      description: 'Configure extension settings',
      action: 'settings'
    },
    {
      label: '📖 View Documentation',
      description: 'Open README on GitHub',
      action: 'docs'
    },
    {
      label: '🐛 Report Issue',
      description: 'Report a bug or request a feature',
      action: 'issue'
    }
  ];

  const selected = await vscode.window.showQuickPick(options, {
    placeHolder: 'Select an action',
    matchOnDescription: true
  });

  if (!selected) {
    return;
  }

  switch (selected.action) {
    case 'panel':
      await vscode.commands.executeCommand('antigravity-quota-watcher.showDetailedPanel');
      break;
    case 'refresh':
      await vscode.commands.executeCommand('antigravity-quota-watcher.quickRefreshQuota');
      break;
    case 'detect':
      await vscode.commands.executeCommand('antigravity-quota-watcher.detectPort');
      break;
    case 'copy':
      await copyQuotaToClipboard();
      break;
    case 'settings':
      await vscode.commands.executeCommand('workbench.action.openSettings', 'antigravity-quota-watcher');
      break;
    case 'docs':
      await vscode.env.openExternal(vscode.Uri.parse('https://github.com/redseac31001-hub/antigravity-quota-watcher#readme'));
      break;
    case 'issue':
      await vscode.env.openExternal(vscode.Uri.parse('https://github.com/redseac31001-hub/antigravity-quota-watcher/issues/new'));
      break;
  }
}

/**
 * Copy current quota information to clipboard
 */
async function copyQuotaToClipboard(): Promise<void> {
  if (!quotaService) {
    vscode.window.showWarningMessage('Quota service is not initialized');
    return;
  }

  try {
    // Get current quota snapshot (we need to expose this from quotaService)
    const snapshot = await quotaService.fetchQuotaData();
    
    if (!snapshot || !snapshot.models || snapshot.models.length === 0) {
      vscode.window.showWarningMessage('No quota data available');
      return;
    }

    // Format quota information as text
    const lines: string[] = [
      '=== Antigravity Quota Status ===',
      `Timestamp: ${new Date().toLocaleString()}`,
      ''
    ];

    if (snapshot.planName) {
      lines.push(`Plan: ${snapshot.planName}`);
      lines.push('');
    }

    if (snapshot.promptCredits) {
      lines.push('Prompt Credits:');
      lines.push(`  Available: ${snapshot.promptCredits.available} / ${snapshot.promptCredits.monthly}`);
      lines.push(`  Remaining: ${snapshot.promptCredits.remainingPercentage.toFixed(1)}%`);
      lines.push('');
    }

    lines.push('Model Quotas:');
    for (const model of snapshot.models) {
      const percentage = model.remainingPercentage ?? 0;
      const status = model.isExhausted ? 'Exhausted' : `${percentage.toFixed(1)}%`;
      lines.push(`  ${model.label}: ${status}`);
      lines.push(`    Reset in: ${model.timeUntilResetFormatted}`);
    }

    const text = lines.join('\n');
    await vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage('✅ Quota information copied to clipboard');
  } catch (error) {
    console.error('Failed to copy quota info:', error);
    vscode.window.showErrorMessage('❌ Failed to copy quota information');
  }
}

/**
 * Called when the extension is deactivated
 */
export function deactivate() {
  console.log('Antigravity Quota Watcher deactivated');
  quotaService?.dispose();
  statusBarService?.dispose();
}
