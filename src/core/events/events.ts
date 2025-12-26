/**
 * 事件类型定义
 *
 * 定义所有事件类型及其对应的载荷类型。
 * 使用强类型确保事件发布和订阅的类型安全。
 */

import type { QuotaSnapshot, Config } from '../types';

/**
 * 端口检测结果
 */
export interface PortDetectionResult {
  /** 主端口（Connect/API） */
  port: number;
  /** Connect 端口 */
  connectPort: number;
  /** HTTP 降级端口 */
  httpPort: number;
  /** CSRF 令牌 */
  csrfToken: string;
  /** 检测来源 */
  source: 'process';
  /** 置信度 */
  confidence: 'high';
}

/**
 * UI 状态
 */
export interface UIStatus {
  /** 当前状态 */
  state: 'detecting' | 'initializing' | 'fetching' | 'retrying' | 'success' | 'error' | 'refreshing' | 'not-logged-in';
  /** 状态消息 */
  message?: string;
  /** 重试信息 */
  retryInfo?: {
    current: number;
    max: number;
  };
}

/**
 * 事件类型枚举
 */
export enum EventType {
  // ========== 配额相关 ==========

  /** 配额数据更新 */
  QUOTA_UPDATE = 'quota:update',

  /** 开始获取配额 */
  QUOTA_FETCH_START = 'quota:fetch:start',

  /** 配额获取成功 */
  QUOTA_FETCH_SUCCESS = 'quota:fetch:success',

  /** 配额获取失败 */
  QUOTA_FETCH_ERROR = 'quota:fetch:error',

  /** 配额获取重试 */
  QUOTA_RETRY = 'quota:retry',

  // ========== 端口检测 ==========

  /** 开始端口检测 */
  PORT_DETECT_START = 'port:detect:start',
  /** 开始端口检测（别名） */
  PORT_DETECTION_START = 'port:detect:start',

  /** 端口检测成功 */
  PORT_DETECT_SUCCESS = 'port:detect:success',
  /** 端口检测成功（别名） */
  PORT_DETECTION_SUCCESS = 'port:detect:success',

  /** 端口检测失败 */
  PORT_DETECT_ERROR = 'port:detect:error',
  /** 端口检测失败（别名） */
  PORT_DETECTION_FAILED = 'port:detect:error',

  // ========== 配置相关 ==========

  /** 配置变更 */
  CONFIG_CHANGE = 'config:change',

  /** 语言设置变更 */
  CONFIG_LANGUAGE_CHANGE = 'config:language:change',

  // ========== 错误恢复 ==========

  /** 发生错误 */
  ERROR_OCCURRED = 'error:occurred',

  /** 开始错误恢复 */
  ERROR_RECOVERY_START = 'error:recovery:start',

  /** 错误恢复成功 */
  ERROR_RECOVERY_SUCCESS = 'error:recovery:success',

  /** 错误恢复失败 */
  ERROR_RECOVERY_FAILED = 'error:recovery:failed',

  // ========== UI 状态 ==========

  /** UI 状态更新 */
  UI_STATUS_UPDATE = 'ui:status:update',

  /** 请求刷新 */
  UI_REFRESH_REQUEST = 'ui:refresh:request',
}

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  /** 错误对象 */
  error: Error;
  /** 错误发生的上下文描述 */
  context: string;
  /** 错误类型分类 */
  errorType?: ErrorType;
}

/**
 * 错误类型分类
 */
export enum ErrorType {
  /** 连接被拒绝 */
  CONNECTION_REFUSED = 'connection_refused',
  /** 协议错误 */
  PROTOCOL_ERROR = 'protocol_error',
  /** 超时 */
  TIMEOUT = 'timeout',
  /** 端口检测失败 */
  PORT_DETECTION = 'port_detection',
  /** 认证错误 */
  AUTH_ERROR = 'auth_error',
  /** 未知错误 */
  UNKNOWN = 'unknown',
}

/**
 * 重试信息
 */
export interface RetryInfo {
  /** 当前重试次数 */
  attempt: number;
  /** 最大重试次数 */
  maxAttempts: number;
}

/**
 * 事件载荷类型映射
 *
 * 定义每种事件类型对应的载荷类型。
 * 使用 void 表示无载荷的事件。
 */
export interface EventPayloads {
  // 配额事件
  [EventType.QUOTA_UPDATE]: QuotaSnapshot;
  [EventType.QUOTA_FETCH_START]: void;
  [EventType.QUOTA_FETCH_SUCCESS]: QuotaSnapshot;
  [EventType.QUOTA_FETCH_ERROR]: Error;
  [EventType.QUOTA_RETRY]: RetryInfo;

  // 端口检测事件
  [EventType.PORT_DETECT_START]: void;
  [EventType.PORT_DETECT_SUCCESS]: PortDetectionResult;
  [EventType.PORT_DETECT_ERROR]: Error;

  // 配置事件
  [EventType.CONFIG_CHANGE]: Config;
  [EventType.CONFIG_LANGUAGE_CHANGE]: string;

  // 错误恢复事件
  [EventType.ERROR_OCCURRED]: ErrorContext;
  [EventType.ERROR_RECOVERY_START]: { errorType: ErrorType };
  [EventType.ERROR_RECOVERY_SUCCESS]: void;
  [EventType.ERROR_RECOVERY_FAILED]: Error;

  // UI 事件
  [EventType.UI_STATUS_UPDATE]: UIStatus;
  [EventType.UI_REFRESH_REQUEST]: void;
}

/**
 * 事件载荷类型辅助
 */
export type EventPayload<E extends EventType> = EventPayloads[E];
