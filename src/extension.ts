/**
 * Antigravity Quota Watcher - 扩展入口
 *
 * 这是扩展的主入口文件。遵循依赖注入模式，
 * 将所有业务逻辑委托给 DI 容器中的服务。
 */

import * as vscode from 'vscode';
import type { Container } from './core';
import { TYPES } from './core';
import { buildContainer } from './extension/bootstrap';
import type { ServiceOrchestrator } from './extension/ServiceOrchestrator';
import type { CommandRegistry } from './extension/CommandRegistry';
import type { StatusBarPresenter } from './presentation';

/** DI 容器实例 */
let container: Container | undefined;

/**
 * 扩展激活
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Antigravity Quota Watcher 激活中...');

  // 1. 构建 DI 容器
  container = buildContainer(context);

  // 2. 解析并初始化关键服务
  const orchestrator = container.resolve<ServiceOrchestrator>(TYPES.ServiceOrchestrator);
  const commandRegistry = container.resolve<CommandRegistry>(TYPES.CommandRegistry);
  // 触发 StatusBarPresenter 初始化（它会在构造时自动订阅事件）
  container.resolve<StatusBarPresenter>(TYPES.StatusBarPresenter);

  // 3. 注册命令到 VS Code
  context.subscriptions.push(...commandRegistry.getDisposables());

  // 4. 注册容器销毁
  context.subscriptions.push({ dispose: () => container?.dispose() });

  // 5. 初始化服务编排器
  await orchestrator.initialize();

  console.log('Antigravity Quota Watcher 激活完成');
}

/**
 * 扩展停用
 */
export function deactivate(): void {
  console.log('Antigravity Quota Watcher 停用');
  container?.dispose();
  container = undefined;
}
