/**
 * 容器构建器
 *
 * 负责构建和配置 DI 容器，注册所有服务和依赖关系。
 */

import * as vscode from 'vscode';
import { Container, Lifecycle, TYPES } from '../core';
import { EventBus } from '../core/events/EventBus';
import {
  ConfigService,
  LocalizationService,
  QuotaService,
  StatusBarService,
  ErrorRecoveryService,
  PortDetectionService,
} from '../services';
import { StatusBarPresenter } from '../presentation';
import { ServiceOrchestrator } from './ServiceOrchestrator';
import { CommandRegistry } from './CommandRegistry';

/**
 * 构建 DI 容器
 *
 * 按依赖顺序注册所有服务：
 * 1. 核心服务（EventBus）
 * 2. 业务服务（ConfigService, LocalizationService, etc.）
 * 3. 表现层（StatusBarPresenter）
 * 4. 扩展层（ServiceOrchestrator, CommandRegistry）
 *
 * @param context - VS Code 扩展上下文
 * @returns 配置完成的 DI 容器
 */
export function buildContainer(context: vscode.ExtensionContext): Container {
  const container = new Container();

  // ========== 注册 VS Code 上下文 ==========
  container.register(
    TYPES.ExtensionContext,
    () => context,
    Lifecycle.Singleton
  );

  // ========== 注册核心服务 ==========

  // 事件总线（单例）
  container.register(
    TYPES.EventBus,
    () => new EventBus(),
    Lifecycle.Singleton
  );

  // ========== 注册业务服务 ==========

  // 配置服务
  container.register(
    TYPES.ConfigService,
    (c) => new ConfigService(c.resolve<EventBus>(TYPES.EventBus)),
    Lifecycle.Singleton
  );

  // 国际化服务
  container.register(
    TYPES.LocalizationService,
    () => new LocalizationService('auto'),
    Lifecycle.Singleton
  );

  // 配额服务
  container.register(
    TYPES.QuotaService,
    (c) => new QuotaService(c.resolve<EventBus>(TYPES.EventBus)),
    Lifecycle.Singleton
  );

  // 状态栏服务
  container.register(
    TYPES.StatusBarService,
    (c) => new StatusBarService(c.resolve<LocalizationService>(TYPES.LocalizationService)),
    Lifecycle.Singleton
  );

  // 错误恢复服务
  container.register(
    TYPES.ErrorRecoveryService,
    (c) => new ErrorRecoveryService(c.resolve<EventBus>(TYPES.EventBus)),
    Lifecycle.Singleton
  );

  // 端口检测服务
  container.register(
    TYPES.PortDetectionService,
    (c) => new PortDetectionService(c.resolve<EventBus>(TYPES.EventBus)),
    Lifecycle.Singleton
  );

  // ========== 注册表现层 ==========

  // 状态栏展示器
  container.register(
    TYPES.StatusBarPresenter,
    (c) =>
      new StatusBarPresenter(
        c.resolve<StatusBarService>(TYPES.StatusBarService),
        c.resolve<EventBus>(TYPES.EventBus)
      ),
    Lifecycle.Singleton
  );

  // ========== 注册扩展层 ==========

  // 服务编排器
  container.register(
    TYPES.ServiceOrchestrator,
    (c) =>
      new ServiceOrchestrator({
        quotaService: c.resolve<QuotaService>(TYPES.QuotaService),
        configService: c.resolve<ConfigService>(TYPES.ConfigService),
        portDetectionService: c.resolve<PortDetectionService>(TYPES.PortDetectionService),
        errorRecoveryService: c.resolve<ErrorRecoveryService>(TYPES.ErrorRecoveryService),
        statusBarService: c.resolve<StatusBarService>(TYPES.StatusBarService),
        localizationService: c.resolve<LocalizationService>(TYPES.LocalizationService),
        eventBus: c.resolve<EventBus>(TYPES.EventBus),
      }),
    Lifecycle.Singleton
  );

  // 命令注册器
  container.register(
    TYPES.CommandRegistry,
    (c) => {
      const orchestrator = c.resolve<ServiceOrchestrator>(TYPES.ServiceOrchestrator);
      return new CommandRegistry({
        extensionUri: context.extensionUri,
        quotaService: c.resolve<QuotaService>(TYPES.QuotaService),
        localizationService: c.resolve<LocalizationService>(TYPES.LocalizationService),
        eventBus: c.resolve<EventBus>(TYPES.EventBus),
        onRedetectPort: async () => {
          await orchestrator.detectPort();
        },
      });
    },
    Lifecycle.Singleton
  );

  console.log('[Bootstrap] DI 容器构建完成');
  console.log('[Bootstrap] 已注册服务:', container.getRegisteredServices().length);

  return container;
}
