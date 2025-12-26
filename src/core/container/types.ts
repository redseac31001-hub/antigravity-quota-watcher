/**
 * 服务标识符定义
 *
 * 使用 Symbol 作为服务标识符，确保类型安全和唯一性。
 * 所有需要通过 DI 容器管理的服务都应在此定义标识符。
 */

/**
 * 服务标识符常量
 */
export const TYPES = {
  // ========== 核心服务 ==========

  /** 事件总线 */
  EventBus: Symbol.for('EventBus'),

  // ========== 业务服务 ==========

  /** 配额服务 */
  QuotaService: Symbol.for('QuotaService'),

  /** 状态栏服务 */
  StatusBarService: Symbol.for('StatusBarService'),

  /** 配置服务 */
  ConfigService: Symbol.for('ConfigService'),

  /** 端口检测服务 */
  PortDetectionService: Symbol.for('PortDetectionService'),

  /** 错误恢复服务 */
  ErrorRecoveryService: Symbol.for('ErrorRecoveryService'),

  /** 国际化服务 */
  LocalizationService: Symbol.for('LocalizationService'),

  // ========== 表现层 ==========

  /** 状态栏展示器 */
  StatusBarPresenter: Symbol.for('StatusBarPresenter'),

  /** 配额详情面板 */
  QuotaPanel: Symbol.for('QuotaPanel'),

  /** 快捷菜单展示器 */
  QuickMenuPresenter: Symbol.for('QuickMenuPresenter'),

  // ========== 平台层 ==========

  /** 平台检测器 */
  PlatformDetector: Symbol.for('PlatformDetector'),

  /** 进程端口检测器 */
  ProcessPortDetector: Symbol.for('ProcessPortDetector'),

  // ========== 扩展层 ==========

  /** 生命周期管理器 */
  LifecycleManager: Symbol.for('LifecycleManager'),

  /** 命令注册器 */
  CommandRegistry: Symbol.for('CommandRegistry'),

  /** 配置协调器 */
  ConfigCoordinator: Symbol.for('ConfigCoordinator'),

  /** 服务编排器 */
  ServiceOrchestrator: Symbol.for('ServiceOrchestrator'),

  // ========== VS Code 上下文 ==========

  /** VS Code 扩展上下文 */
  ExtensionContext: Symbol.for('ExtensionContext'),
} as const;

/**
 * 服务标识符类型
 */
export type ServiceIdentifier = typeof TYPES[keyof typeof TYPES];
