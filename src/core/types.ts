/**
 * 核心类型定义
 *
 * 重新导出原有类型并添加核心层所需的新类型。
 */

// 重新导出原有类型（保持向后兼容）
export type {
  ModelConfig,
  UserStatusResponse,
  PromptCreditsInfo,
  ModelQuotaInfo,
  QuotaSnapshot,
  ApiMethodPreference,
  Config,
} from '../types';

export { QuotaLevel } from '../types';

// 从事件模块重新导出相关类型
export type {
  PortDetectionResult,
  UIStatus,
  ErrorContext,
  RetryInfo,
} from './events';

export { EventType, ErrorType } from './events';
