/**
 * Error Recovery Manager
 * Handles intelligent error recovery and provides user guidance
 */

import * as vscode from 'vscode';

interface ErrorRecord {
  type: string;
  message: string;
  timestamp: number;
}

export class ErrorRecoveryManager {
  private errorHistory: ErrorRecord[] = [];
  private readonly MAX_HISTORY_SIZE = 20;
  private readonly ERROR_PATTERN_WINDOW = 5 * 60 * 1000; // 5 minutes
  private autoFixAttempted = false;

  /**
   * Record an error occurrence
   */
  recordError(error: Error): void {
    this.errorHistory.push({
      type: error.name || 'Error',
      message: error.message,
      timestamp: Date.now()
    });

    // Keep history size manageable
    if (this.errorHistory.length > this.MAX_HISTORY_SIZE) {
      this.errorHistory.shift();
    }
  }

  /**
   * Get recent errors within time window
   */
  private getRecentErrors(timeWindowMs: number): ErrorRecord[] {
    const now = Date.now();
    return this.errorHistory.filter(e => now - e.timestamp < timeWindowMs);
  }

  /**
   * Analyze error pattern and provide recovery options
   */
  async handleError(error: Error, context: {
    onRedetectPort?: () => Promise<void>;
    onTogglePowerShell?: () => Promise<void>;
    onToggleApiMethod?: () => Promise<void>;
  }): Promise<void> {
    this.recordError(error);

    const recentErrors = this.getRecentErrors(this.ERROR_PATTERN_WINDOW);
    
    // If multiple errors in short time, offer help
    if (recentErrors.length >= 3 && !this.autoFixAttempted) {
      await this.showErrorRecoveryDialog(error, context);
    } else if (recentErrors.length === 1) {
      // First error, just show simple message
      console.error('Quota monitoring error:', error.message);
    }
  }

  /**
   * Show comprehensive error recovery dialog
   */
  private async showErrorRecoveryDialog(
    error: Error,
    context: {
      onRedetectPort?: () => Promise<void>;
      onTogglePowerShell?: () => Promise<void>;
      onToggleApiMethod?: () => Promise<void>;
    }
  ): Promise<void> {
    const errorType = this.categorizeError(error);
    const solutions = this.getSolutions(errorType);

    const message = [
      '❌ **Antigravity Quota Watcher is experiencing issues**',
      '',
      `Error: ${error.message}`,
      '',
      '**Common solutions:**',
      ...solutions.map(s => `• ${s}`)
    ].join('\n');

    const actions = ['Auto-fix', 'View Logs', 'Open Settings', 'Report Issue', 'Dismiss'];
    
    const choice = await vscode.window.showErrorMessage(
      message,
      { modal: true },
      ...actions
    );

    switch (choice) {
      case 'Auto-fix':
        await this.attemptAutoFix(errorType, context);
        break;
      case 'View Logs':
        vscode.commands.executeCommand('workbench.action.output.show');
        break;
      case 'Open Settings':
        vscode.commands.executeCommand('workbench.action.openSettings', 'antigravity-quota-watcher');
        break;
      case 'Report Issue':
        vscode.env.openExternal(vscode.Uri.parse(
          'https://github.com/redseac31001-hub/antigravity-quota-watcher/issues/new?template=bug_report.md'
        ));
        break;
    }
  }

  /**
   * Categorize error type for targeted recovery
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
   * Get suggested solutions based on error type
   */
  private getSolutions(errorType: ErrorType): string[] {
    switch (errorType) {
      case ErrorType.CONNECTION_REFUSED:
        return [
          'Ensure Antigravity is running',
          'Restart Antigravity',
          'Re-detect service port'
        ];
      case ErrorType.PROTOCOL_ERROR:
        return [
          'Enable "Allow HTTP Fallback" in settings',
          'Check firewall settings',
          'Restart Antigravity'
        ];
      case ErrorType.PORT_DETECTION:
        return [
          'Re-detect port',
          'Toggle PowerShell mode (Windows only)',
          'Manually restart Antigravity'
        ];
      case ErrorType.AUTH_ERROR:
        return [
          'Re-detect port to refresh CSRF token',
          'Restart Antigravity',
          'Check extension permissions'
        ];
      case ErrorType.TIMEOUT:
        return [
          'Check network connection',
          'Increase polling interval in settings',
          'Restart Antigravity'
        ];
      default:
        return [
          'Re-detect port',
          'Restart Antigravity',
          'Check output logs for details'
        ];
    }
  }

  /**
   * Attempt automatic fix based on error type
   */
  private async attemptAutoFix(
    errorType: ErrorType,
    context: {
      onRedetectPort?: () => Promise<void>;
      onTogglePowerShell?: () => Promise<void>;
      onToggleApiMethod?: () => Promise<void>;
    }
  ): Promise<void> {
    this.autoFixAttempted = true;

    try {
      vscode.window.showInformationMessage('🔧 Attempting automatic fix...');

      switch (errorType) {
        case ErrorType.CONNECTION_REFUSED:
        case ErrorType.PORT_DETECTION:
        case ErrorType.AUTH_ERROR:
          // Step 1: Re-detect port
          if (context.onRedetectPort) {
            await context.onRedetectPort();
            await this.delay(2000);
          }
          break;

        case ErrorType.PROTOCOL_ERROR:
          // Step 1: Try toggling API method
          if (context.onToggleApiMethod) {
            await context.onToggleApiMethod();
            await this.delay(1000);
          }
          // Step 2: Re-detect port
          if (context.onRedetectPort) {
            await context.onRedetectPort();
          }
          break;

        default:
          // Generic fix: just re-detect
          if (context.onRedetectPort) {
            await context.onRedetectPort();
          }
          break;
      }

      vscode.window.showInformationMessage('✅ Auto-fix completed. Monitoring resumed.');
      
      // Reset flag after some time
      setTimeout(() => {
        this.autoFixAttempted = false;
      }, 10 * 60 * 1000); // 10 minutes
    } catch (fixError) {
      console.error('Auto-fix failed:', fixError);
      vscode.window.showErrorMessage('❌ Auto-fix failed. Please try manual steps.');
    }
  }

  /**
   * Reset error history (e.g., after successful recovery)
   */
  reset(): void {
    this.errorHistory = [];
    this.autoFixAttempted = false;
  }

  /**
   * Get error statistics for debugging
   */
  getStatistics(): {
    totalErrors: number;
    recentErrors: number;
    errorTypes: Map<string, number>;
  } {
    const recentErrors = this.getRecentErrors(this.ERROR_PATTERN_WINDOW);
    const errorTypes = new Map<string, number>();

    for (const error of this.errorHistory) {
      const count = errorTypes.get(error.type) || 0;
      errorTypes.set(error.type, count + 1);
    }

    return {
      totalErrors: this.errorHistory.length,
      recentErrors: recentErrors.length,
      errorTypes
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

enum ErrorType {
  CONNECTION_REFUSED = 'connection_refused',
  PROTOCOL_ERROR = 'protocol_error',
  TIMEOUT = 'timeout',
  PORT_DETECTION = 'port_detection',
  AUTH_ERROR = 'auth_error',
  UNKNOWN = 'unknown'
}
