/**
 * 配额服务
 *
 * 负责获取和管理配额数据，通过事件总线发布状态更新。
 */

import * as https from 'https';
import * as http from 'http';
import type { IQuotaService } from '../core/interfaces/IQuotaService';
import { QuotaApiMethod } from '../core/interfaces/IQuotaService';
import type { EventBus } from '../core/events/EventBus';
import { EventType } from '../core/events/events';
import type {
  UserStatusResponse,
  QuotaSnapshot,
  PromptCreditsInfo,
  ModelQuotaInfo,
} from '../core/types';

// 重新导出 API 方法枚举
export { QuotaApiMethod } from '../core/interfaces/IQuotaService';

/**
 * 请求配置
 */
interface RequestConfig {
  path: string;
  body: object;
  timeout?: number;
}

/**
 * 执行 HTTP/HTTPS 请求
 */
async function makeRequest(
  config: RequestConfig,
  port: number,
  httpPort: number | undefined,
  csrfToken: string | undefined,
  allowHttpFallback: boolean
): Promise<any> {
  const requestBody = JSON.stringify(config.body);

  const headers: Record<string, string | number> = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestBody),
    'Connect-Protocol-Version': '1',
  };

  if (csrfToken) {
    headers['X-Codeium-Csrf-Token'] = csrfToken;
  } else {
    throw new Error('缺少 CSRF 令牌');
  }

  const doRequest = (useHttps: boolean, targetPort: number) =>
    new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: '127.0.0.1',
        port: targetPort,
        path: config.path,
        method: 'POST',
        headers,
        rejectUnauthorized: false,
        timeout: config.timeout ?? 5000,
      };

      console.log(`[QuotaService] 请求: ${useHttps ? 'https' : 'http'}://127.0.0.1:${targetPort}${config.path}`);

      const client = useHttps ? https : http;
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP 错误: ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`解析响应失败: ${error}`));
          }
        });
      });

      req.on('error', (error) => reject(error));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      req.write(requestBody);
      req.end();
    });

  // 先尝试 HTTPS，失败后可按配置回退 HTTP
  try {
    return await doRequest(true, port);
  } catch (error: any) {
    const msg = (error?.message || '').toLowerCase();
    const shouldRetryHttp = allowHttpFallback &&
      httpPort !== undefined &&
      (error.code === 'EPROTO' || msg.includes('wrong_version_number'));

    if (shouldRetryHttp) {
      console.warn('[QuotaService] HTTPS 连接失败，尝试 HTTP 降级...');
      console.warn('  错误详情:', error.code || error.message);
      return await doRequest(false, httpPort);
    }
    throw error;
  }
}

/**
 * 配额服务实现
 */
export class QuotaService implements IQuotaService {
  private readonly GET_USER_STATUS_PATH = '/exa.language_server_pb.LanguageServerService/GetUserStatus';
  private readonly COMMAND_MODEL_CONFIG_PATH = '/exa.language_server_pb.LanguageServerService/GetCommandModelConfigs';

  // 重试配置
  private readonly MAX_RETRY_COUNT = 3;
  private readonly RETRY_DELAY_MS = 5000;
  private readonly MAX_HTTP_FALLBACK_COUNT = 5;

  // 连接信息
  private port: number = 0;
  private httpPort?: number;
  private csrfToken?: string;
  private allowHttpFallback: boolean = false;
  private apiMethod: QuotaApiMethod = QuotaApiMethod.GET_USER_STATUS;

  // 状态
  private pollingInterval?: NodeJS.Timeout;
  private isFirstAttempt: boolean = true;
  private consecutiveErrors: number = 0;
  private retryCount: number = 0;
  private isRetrying: boolean = false;
  private isPollingTransition: boolean = false;
  private httpFallbackCount: number = 0;
  private disposed: boolean = false;

  constructor(private readonly eventBus?: EventBus) {}

  /**
   * 设置连接信息
   */
  setConnectionInfo(port: number, httpPort?: number, csrfToken?: string): void {
    this.port = port;
    this.httpPort = httpPort ?? port;
    this.csrfToken = csrfToken;
    this.consecutiveErrors = 0;
    this.retryCount = 0;
    this.httpFallbackCount = 0;
  }

  /**
   * 设置是否允许 HTTP 降级
   */
  setAllowHttpFallback(allow: boolean): void {
    this.allowHttpFallback = allow;
  }

  /**
   * 设置 API 方法
   */
  setApiMethod(method: QuotaApiMethod): void {
    this.apiMethod = method;
    console.log(`[QuotaService] 切换到 API: ${method}`);
  }

  /**
   * 获取连续错误次数
   */
  getConsecutiveErrors(): number {
    return this.consecutiveErrors;
  }

  /**
   * 检查是否正在轮询
   */
  isPolling(): boolean {
    return this.pollingInterval !== undefined;
  }

  /**
   * 开始轮询
   */
  async startPolling(intervalMs: number): Promise<void> {
    if (this.isPollingTransition) {
      console.log('[QuotaService] 轮询状态切换中，跳过...');
      return;
    }

    this.isPollingTransition = true;
    try {
      console.log(`[QuotaService] 开始轮询，间隔 ${intervalMs}ms`);
      this.stopPolling();
      await this.fetchQuota();
      this.pollingInterval = setInterval(() => {
        this.fetchQuota();
      }, intervalMs);
    } finally {
      this.isPollingTransition = false;
    }
  }

  /**
   * 停止轮询
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      console.log('[QuotaService] 停止轮询');
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  /**
   * 从错误状态恢复
   */
  async retryFromError(pollingInterval: number): Promise<void> {
    console.log(`[QuotaService] 手动重试，间隔 ${pollingInterval}ms`);

    this.consecutiveErrors = 0;
    this.retryCount = 0;
    this.isRetrying = false;
    this.isFirstAttempt = true;

    this.stopPolling();
    await this.fetchQuota();

    if (this.consecutiveErrors === 0) {
      console.log('[QuotaService] 获取成功，启动轮询...');
      this.pollingInterval = setInterval(() => {
        this.fetchQuota();
      }, pollingInterval);
    } else {
      console.log('[QuotaService] 获取失败，保持停止状态');
    }
  }

  /**
   * 快速刷新
   */
  async quickRefresh(): Promise<void> {
    console.log('[QuotaService] 立即刷新...');
    await this.doFetchQuota();
  }

  /**
   * 获取配额数据
   */
  async fetchQuotaData(): Promise<QuotaSnapshot | null> {
    try {
      let snapshot: QuotaSnapshot;

      if (this.apiMethod === QuotaApiMethod.GET_USER_STATUS) {
        const response = await this.makeGetUserStatusRequest();
        const invalid = this.getInvalidCodeInfo(response);
        if (invalid) {
          console.error('[QuotaService] 响应码无效:', invalid);
          return null;
        }
        snapshot = this.parseGetUserStatusResponse(response);
      } else {
        const response = await this.makeCommandModelConfigsRequest();
        const invalid = this.getInvalidCodeInfo(response);
        if (invalid) {
          console.error('[QuotaService] 响应码无效:', invalid);
          return null;
        }
        snapshot = this.parseCommandModelConfigsResponse(response);
      }

      return snapshot;
    } catch (error: any) {
      console.error('[QuotaService] 获取配额数据失败:', error.message);
      return null;
    }
  }

  /**
   * 内部轮询获取方法
   */
  private async fetchQuota(): Promise<void> {
    if (this.isRetrying) {
      console.log('[QuotaService] 正在重试中，跳过本次轮询...');
      return;
    }
    await this.doFetchQuota();
  }

  /**
   * 实际执行配额获取
   */
  private async doFetchQuota(): Promise<void> {
    console.log(`[QuotaService] 开始获取配额，方法: ${this.apiMethod}`);

    // 发布开始获取事件
    if (this.isFirstAttempt) {
      this.eventBus?.emit(EventType.QUOTA_FETCH_START, undefined);
    }

    try {
      let snapshot: QuotaSnapshot;

      if (this.apiMethod === QuotaApiMethod.GET_USER_STATUS) {
        const response = await this.makeGetUserStatusRequest();
        const invalid = this.getInvalidCodeInfo(response);
        if (invalid) {
          console.error('[QuotaService] 响应码无效，跳过更新:', invalid);
          return;
        }
        snapshot = this.parseGetUserStatusResponse(response);
      } else {
        const response = await this.makeCommandModelConfigsRequest();
        const invalid = this.getInvalidCodeInfo(response);
        if (invalid) {
          console.error('[QuotaService] 响应码无效，跳过更新:', invalid);
          return;
        }
        snapshot = this.parseCommandModelConfigsResponse(response);
      }

      // 成功获取配额
      this.consecutiveErrors = 0;
      this.retryCount = 0;
      this.isFirstAttempt = false;

      console.log(`[QuotaService] 获取成功: models=${snapshot.models.length}`);

      // 发布成功事件
      this.eventBus?.emit(EventType.QUOTA_FETCH_SUCCESS, snapshot);
      this.eventBus?.emit(EventType.QUOTA_UPDATE, snapshot);

    } catch (error: any) {
      this.consecutiveErrors++;
      console.error(`[QuotaService] 获取失败 (第 ${this.consecutiveErrors} 次):`, error.message);

      // 如果还没达到最大重试次数
      if (this.retryCount < this.MAX_RETRY_COUNT) {
        this.retryCount++;
        this.isRetrying = true;
        console.log(`[QuotaService] ${this.RETRY_DELAY_MS / 1000} 秒后重试 (${this.retryCount}/${this.MAX_RETRY_COUNT})...`);

        // 发布重试事件
        this.eventBus?.emit(EventType.QUOTA_RETRY, {
          attempt: this.retryCount,
          maxAttempts: this.MAX_RETRY_COUNT,
        });

        setTimeout(async () => {
          this.isRetrying = false;
          await this.fetchQuota();
        }, this.RETRY_DELAY_MS);
        return;
      }

      // 达到最大重试次数
      console.error(`[QuotaService] 达到最大重试次数 (${this.MAX_RETRY_COUNT})，停止轮询`);
      this.stopPolling();

      // 发布错误事件
      this.eventBus?.emit(EventType.QUOTA_FETCH_ERROR, error as Error);
    }
  }

  /**
   * 发起 GetUserStatus 请求
   */
  private async makeGetUserStatusRequest(): Promise<any> {
    return makeRequest(
      {
        path: this.GET_USER_STATUS_PATH,
        body: {
          metadata: {
            ideName: 'antigravity',
            extensionName: 'antigravity',
            locale: 'en',
          },
        },
      },
      this.port,
      this.httpPort,
      this.csrfToken,
      this.allowHttpFallback
    );
  }

  /**
   * 发起 GetCommandModelConfigs 请求
   */
  private async makeCommandModelConfigsRequest(): Promise<any> {
    return makeRequest(
      {
        path: this.COMMAND_MODEL_CONFIG_PATH,
        body: {
          metadata: {
            ideName: 'antigravity',
            extensionName: 'antigravity',
            locale: 'en',
          },
        },
      },
      this.port,
      this.httpPort,
      this.csrfToken,
      this.allowHttpFallback
    );
  }

  /**
   * 解析 CommandModelConfigs 响应
   */
  private parseCommandModelConfigsResponse(response: any): QuotaSnapshot {
    const modelConfigs = response?.clientModelConfigs || [];
    const models: ModelQuotaInfo[] = modelConfigs
      .filter((config: any) => config.quotaInfo)
      .map((config: any) => this.parseModelQuota(config));

    return {
      timestamp: new Date(),
      promptCredits: undefined,
      models,
      planName: undefined,
    };
  }

  /**
   * 解析 GetUserStatus 响应
   */
  private parseGetUserStatusResponse(response: UserStatusResponse): QuotaSnapshot {
    if (!response || !response.userStatus) {
      throw new Error('API 响应格式无效：缺少 userStatus');
    }

    const userStatus = response.userStatus;
    const planStatus = userStatus.planStatus;
    const modelConfigs = userStatus.cascadeModelConfigData?.clientModelConfigs || [];

    const monthlyCreditsRaw = planStatus?.planInfo?.monthlyPromptCredits;
    const availableCreditsRaw = planStatus?.availablePromptCredits;

    const monthlyCredits = monthlyCreditsRaw !== undefined ? Number(monthlyCreditsRaw) : undefined;
    const availableCredits = availableCreditsRaw !== undefined ? Number(availableCreditsRaw) : undefined;

    const promptCredits: PromptCreditsInfo | undefined =
      planStatus && monthlyCredits !== undefined && monthlyCredits > 0 && availableCredits !== undefined
        ? {
            available: availableCredits,
            monthly: monthlyCredits,
            usedPercentage: ((monthlyCredits - availableCredits) / monthlyCredits) * 100,
            remainingPercentage: (availableCredits / monthlyCredits) * 100,
          }
        : undefined;

    const models: ModelQuotaInfo[] = modelConfigs
      .filter((config) => config.quotaInfo)
      .map((config) => this.parseModelQuota(config));

    return {
      timestamp: new Date(),
      promptCredits,
      models,
      planName: planStatus?.planInfo?.planName,
    };
  }

  /**
   * 解析模型配额
   */
  private parseModelQuota(config: any): ModelQuotaInfo {
    const quotaInfo = config.quotaInfo;
    const remainingFraction = quotaInfo?.remainingFraction;
    const resetTime = new Date(quotaInfo.resetTime);
    const timeUntilReset = resetTime.getTime() - Date.now();

    return {
      label: config.label,
      modelId: config.modelOrAlias.model,
      remainingFraction,
      remainingPercentage: remainingFraction !== undefined ? remainingFraction * 100 : undefined,
      isExhausted: remainingFraction === undefined || remainingFraction === 0,
      resetTime,
      timeUntilReset,
      timeUntilResetFormatted: this.formatTimeUntilReset(timeUntilReset),
    };
  }

  /**
   * 格式化重置时间
   */
  private formatTimeUntilReset(ms: number): string {
    if (ms <= 0) {
      return '已过期';
    }

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}天${hours % 24}小时后`;
    } else if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟后`;
    } else if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒后`;
    }
    return `${seconds}秒后`;
  }

  /**
   * 检查响应码是否无效
   */
  private getInvalidCodeInfo(response: any): { code: any; message?: any } | null {
    const code = response?.code;
    if (code === undefined || code === null) {
      return null;
    }

    const okValues = [0, '0', 'OK', 'Ok', 'ok', 'success', 'SUCCESS'];
    if (okValues.includes(code)) {
      return null;
    }

    return { code, message: response?.message };
  }

  /**
   * 销毁服务
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stopPolling();
  }
}
