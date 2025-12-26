/**
 * 核心模块导出
 *
 * 提供依赖注入容器、事件总线和服务接口的统一导出。
 */

// 容器
export { Container, Lifecycle, TYPES } from './container';
export type { ServiceFactory, ServiceIdentifier } from './container';

// 事件
export { EventBus, EventType, ErrorType } from './events';
export type {
  EventHandler,
  ErrorHandler,
  SubscriptionOptions,
  EventPayloads,
  EventPayload,
  PortDetectionResult,
  UIStatus,
  ErrorContext,
  RetryInfo,
} from './events';

// 接口
export { QuotaApiMethod } from './interfaces';
export type {
  IQuotaService,
  IStatusBarService,
  IConfigService,
  IPortDetectionService,
  IErrorRecoveryService,
  ILocalizationService,
  DisplayStyle,
  RecoveryContext,
  ErrorStatistics,
  SupportedLanguage,
} from './interfaces';

// 类型
export type {
  ModelConfig,
  UserStatusResponse,
  PromptCreditsInfo,
  ModelQuotaInfo,
  QuotaSnapshot,
  ApiMethodPreference,
  Config,
} from './types';
export { QuotaLevel } from './types';
