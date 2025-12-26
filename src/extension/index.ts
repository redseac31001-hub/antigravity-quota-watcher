/**
 * 扩展层模块导出
 *
 * 统一导出所有扩展层组件。
 */

// 容器构建
export { buildContainer } from './bootstrap';

// 服务编排器
export { ServiceOrchestrator } from './ServiceOrchestrator';
export type { ServiceOrchestratorConfig } from './ServiceOrchestrator';

// 命令注册器
export { CommandRegistry } from './CommandRegistry';
export type { CommandRegistryConfig } from './CommandRegistry';
