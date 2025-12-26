/**
 * 配置管理服务
 *
 * 负责读取和管理扩展配置，通过事件总线发布配置变更。
 */

import * as vscode from 'vscode';
import type { IConfigService } from '../core/interfaces/IConfigService';
import type { Config, ApiMethodPreference } from '../core/types';
import type { EventBus } from '../core/events/EventBus';
import { EventType } from '../core/events/events';

/**
 * 配置服务实现
 */
export class ConfigService implements IConfigService {
  private readonly configKey = 'antigravity-quota-watcher';
  private disposed = false;
  private configChangeDisposable?: vscode.Disposable;

  constructor(private readonly eventBus?: EventBus) {
    // 如果提供了事件总线，自动订阅配置变更
    if (eventBus) {
      this.configChangeDisposable = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(this.configKey)) {
          const config = this.getConfig();
          this.eventBus?.emit(EventType.CONFIG_CHANGE, config);
        }
      });
    }
  }

  /**
   * 获取完整配置
   */
  getConfig(): Config {
    const config = vscode.workspace.getConfiguration(this.configKey);

    // 验证显示样式
    const validDisplayStyles: Array<Config['displayStyle']> = ['percentage', 'progressBar', 'dots'];
    const displayStyleRaw = config.get<string>('displayStyle', 'percentage');
    const displayStyle = validDisplayStyles.includes(displayStyleRaw as Config['displayStyle'])
      ? (displayStyleRaw as Config['displayStyle'])
      : 'percentage';

    // 验证 API 方法
    const validApiMethods: Array<ApiMethodPreference> = ['GET_USER_STATUS', 'COMMAND_MODEL_CONFIG'];
    const apiMethodRaw = config.get<string>('apiMethod', 'GET_USER_STATUS');
    const apiMethod = validApiMethods.includes(apiMethodRaw as ApiMethodPreference)
      ? (apiMethodRaw as ApiMethodPreference)
      : 'GET_USER_STATUS';

    // 验证语言设置
    const validLanguages: Array<Config['language']> = ['auto', 'en', 'zh-cn'];
    const languageRaw = config.get<string>('language', 'auto');
    const language = validLanguages.includes(languageRaw as Config['language'])
      ? (languageRaw as Config['language'])
      : 'auto';

    return {
      enabled: config.get<boolean>('enabled', true),
      pollingInterval: Math.max(10, config.get<number>('pollingInterval', 60)) * 1000,
      warningThreshold: config.get<number>('warningThreshold', 50),
      criticalThreshold: config.get<number>('criticalThreshold', 30),
      apiMethod,
      showPromptCredits: config.get<boolean>('showPromptCredits', false),
      showPlanName: config.get<boolean>('showPlanName', false),
      displayStyle,
      language,
      allowHttpFallback: config.get<boolean>('allowHttpFallback', false),
    };
  }

  /**
   * 获取轮询间隔（毫秒）
   */
  getPollingInterval(): number {
    return this.getConfig().pollingInterval;
  }

  /**
   * 获取警告阈值
   */
  getWarningThreshold(): number {
    return this.getConfig().warningThreshold;
  }

  /**
   * 获取临界阈值
   */
  getCriticalThreshold(): number {
    return this.getConfig().criticalThreshold;
  }

  /**
   * 获取 API 方法偏好
   */
  getApiMethod(): ApiMethodPreference {
    return this.getConfig().apiMethod;
  }

  /**
   * 检查扩展是否启用
   */
  isEnabled(): boolean {
    return this.getConfig().enabled;
  }

  /**
   * 更新配置项
   */
  async updateConfig<K extends keyof Config>(key: K, value: Config[K]): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.configKey);
    await config.update(key, value, vscode.ConfigurationTarget.Global);
  }

  /**
   * 销毁服务
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.configChangeDisposable?.dispose();
  }
}
