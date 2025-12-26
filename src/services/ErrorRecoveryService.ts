/**
 * 错误恢复服务
 *
 * 负责处理错误并执行恢复策略，通过事件总线监听错误事件。
 */

import * as vscode from 'vscode';
import type {
  IErrorRecoveryService,
  RecoveryContext,
  ErrorStatistics,
} from '../core/interfaces/IErrorRecoveryService';
import type { EventBus } from '../core/events/EventBus';
import { EventType, ErrorType } from '../core/events/events';

/**
 * 错误记录
 */
interface ErrorRecord {
  type: ErrorType;
  message: string;
  timestamp: number;
}

/**
 * 错误恢复服务实现
 */
export class ErrorRecoveryService implements IErrorRecoveryService {
  private errorHistory: ErrorRecord[] = [];
  private readonly MAX_HISTORY_SIZE = 20;
  private readonly ERROR_PATTERN_WINDOW = 5 * 60 * 1000; // 5 分钟
  private autoFixAttempted = false;

  private disposed: boolean = false;
  private eventSubscriptions: vscode.Disposable[] = [];
  private recoveryContext?: RecoveryContext;

  constructor(private readonly eventBus?: EventBus) {
    this.subscribeToEvents();
  }

  /**
   * 订阅事件
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) {
      return;
    }

    // 订阅配额获取错误事件
    const unsubQuotaError = this.eventBus.on(
      EventType.QUOTA_FETCH_ERROR,
      async (error) => {
        if (this.recoveryContext) {
          await this.handleError(error, this.recoveryContext);
        } else {
          this.recordError(error);
        }
      }
    );
    this.eventSubscriptions.push(unsubQuotaError);

    // 订阅端口检测错误事件
    const unsubPortError = this.eventBus.on(
      EventType.PORT_DETECTION_FAILED,
      async (error) => {
        if (this.recoveryContext) {
          await this.handleError(error, this.recoveryContext);
        } else {
          this.recordError(error);
        }
      }
    );
    this.eventSubscriptions.push(unsubPortError);
  }

  /**
   * 设置恢复上下文
   *
   * @param context - 恢复上下文
   */
  setRecoveryContext(context: RecoveryContext): void {
    this.recoveryContext = context;
  }

  /**
   * 处理错误
   */
  async handleError(error: Error, context: RecoveryContext): Promise<void> {
    this.recordError(error);

    const recentErrors = this.getRecentErrors(this.ERROR_PATTERN_WINDOW);

    // 如果短时间内多次错误，提供帮助
    if (recentErrors.length >= 3 && !this.autoFixAttempted) {
      await this.showErrorRecoveryDialog(error, context);
    } else if (recentErrors.length === 1) {
      // 首次错误，仅记录日志
      console.error('[ErrorRecoveryService] 配额监控错误:', error.message);
    }
  }

  /**
   * 重置错误状态
   */
  reset(): void {
    this.errorHistory = [];
    this.autoFixAttempted = false;
  }

  /**
   * 获取错误统计信息
   */
  getStatistics(): ErrorStatistics {
    const recentErrors = this.getRecentErrors(this.ERROR_PATTERN_WINDOW);
    const errorTypes = new Map<ErrorType, number>();

    for (const errorRecord of this.errorHistory) {
      const count = errorTypes.get(errorRecord.type) || 0;
      errorTypes.set(errorRecord.type, count + 1);
    }

    return {
      totalErrors: this.errorHistory.length,
      recentErrors: recentErrors.length,
      errorTypes,
    };
  }

  /**
   * 销毁服务
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
  }

  /**
   * 记录错误
   */
  private recordError(error: Error): void {
    const errorType = this.categorizeError(error);
    this.errorHistory.push({
      type: errorType,
      message: error.message,
      timestamp: Date.now(),
    });

    // 保持历史记录在合理范围内
    if (this.errorHistory.length > this.MAX_HISTORY_SIZE) {
      this.errorHistory.shift();
    }
  }

  /**
   * 获取时间窗口内的错误
   */
  private getRecentErrors(timeWindowMs: number): ErrorRecord[] {
    const now = Date.now();
    return this.errorHistory.filter((e) => now - e.timestamp < timeWindowMs);
  }

  /**
   * 显示错误恢复对话框
   */
  private async showErrorRecoveryDialog(
    error: Error,
    context: RecoveryContext
  ): Promise<void> {
    const errorType = this.categorizeError(error);
    const solutions = this.getSolutions(errorType);

    const message = [
      '❌ **Antigravity Quota Watcher 遇到问题**',
      '',
      `错误: ${error.message}`,
      '',
      '**常见解决方案:**',
      ...solutions.map((s) => `• ${s}`),
    ].join('\n');

    const actions = [
      '自动修复',
      '查看日志',
      '打开设置',
      '报告问题',
      '关闭',
    ];

    const choice = await vscode.window.showErrorMessage(
      message,
      { modal: true },
      ...actions
    );

    switch (choice) {
      case '自动修复':
        await this.attemptAutoFix(errorType, context);
        break;
      case '查看日志':
        vscode.commands.executeCommand('workbench.action.output.show');
        break;
      case '打开设置':
        vscode.commands.executeCommand(
          'workbench.action.openSettings',
          'antigravity-quota-watcher'
        );
        break;
      case '报告问题':
        vscode.env.openExternal(
          vscode.Uri.parse(
            'https://github.com/redseac31001-hub/antigravity-quota-watcher/issues/new?template=bug_report.md'
          )
        );
        break;
    }
  }

  /**
   * 分类错误类型
   */
  private categorizeError(error: Error): ErrorType {
    const msg = error.message.toLowerCase();

    if (msg.includes('econnrefused') || msg.includes('connection refused')) {
      return ErrorType.CONNECTION_REFUSED;
    } else if (msg.includes('eproto') || msg.includes('wrong_version')) {
      return ErrorType.PROTOCOL_ERROR;
    } else if (msg.includes('timeout') || msg.includes('etimedout')) {
      return ErrorType.TIMEOUT;
    } else if (msg.includes('port') || msg.includes('not found')) {
      return ErrorType.PORT_DETECTION;
    } else if (msg.includes('unauthorized') || msg.includes('forbidden')) {
      return ErrorType.AUTH_ERROR;
    } else {
      return ErrorType.UNKNOWN;
    }
  }

  /**
   * 根据错误类型获取建议解决方案
   */
  private getSolutions(errorType: ErrorType): string[] {
    switch (errorType) {
      case ErrorType.CONNECTION_REFUSED:
        return [
          '确保 Antigravity 正在运行',
          '重启 Antigravity',
          '重新检测服务端口',
        ];
      case ErrorType.PROTOCOL_ERROR:
        return [
          '在设置中启用 "Allow HTTP Fallback"',
          '检查防火墙设置',
          '重启 Antigravity',
        ];
      case ErrorType.PORT_DETECTION:
        return [
          '重新检测端口',
          '切换 PowerShell 模式（仅限 Windows）',
          '手动重启 Antigravity',
        ];
      case ErrorType.AUTH_ERROR:
        return [
          '重新检测端口以刷新 CSRF 令牌',
          '重启 Antigravity',
          '检查扩展权限',
        ];
      case ErrorType.TIMEOUT:
        return [
          '检查网络连接',
          '在设置中增加轮询间隔',
          '重启 Antigravity',
        ];
      default:
        return [
          '重新检测端口',
          '重启 Antigravity',
          '查看输出日志获取详情',
        ];
    }
  }

  /**
   * 尝试自动修复
   */
  private async attemptAutoFix(
    errorType: ErrorType,
    context: RecoveryContext
  ): Promise<void> {
    this.autoFixAttempted = true;

    try {
      vscode.window.showInformationMessage('🔧 正在尝试自动修复...');

      switch (errorType) {
        case ErrorType.CONNECTION_REFUSED:
        case ErrorType.PORT_DETECTION:
        case ErrorType.AUTH_ERROR:
          // 步骤 1: 重新检测端口
          if (context.onRedetectPort) {
            await context.onRedetectPort();
            await this.delay(2000);
          }
          break;

        case ErrorType.PROTOCOL_ERROR:
          // 步骤 1: 尝试切换 API 方法
          if (context.onToggleApiMethod) {
            await context.onToggleApiMethod();
            await this.delay(1000);
          }
          // 步骤 2: 重新检测端口
          if (context.onRedetectPort) {
            await context.onRedetectPort();
          }
          break;

        default:
          // 通用修复: 仅重新检测
          if (context.onRedetectPort) {
            await context.onRedetectPort();
          }
          break;
      }

      vscode.window.showInformationMessage('✅ 自动修复完成，已恢复监控。');

      // 一段时间后重置标志
      setTimeout(() => {
        this.autoFixAttempted = false;
      }, 10 * 60 * 1000); // 10 分钟
    } catch (fixError) {
      console.error('[ErrorRecoveryService] 自动修复失败:', fixError);
      vscode.window.showErrorMessage('❌ 自动修复失败，请尝试手动操作。');
    }
  }

  /**
   * 延时
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
