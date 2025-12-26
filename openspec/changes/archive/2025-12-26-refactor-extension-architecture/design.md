# Design: Refactor Extension Architecture (重构扩展架构技术设计)

## Context (背景)

**项目**：antigravity-quota-watcher VS Code 扩展
**当前状态**：16个源文件，3300+行代码
**核心问题**：extension.ts (664行) 承担过多职责，服务间紧耦合

**约束条件**：
- VS Code 扩展打包体积敏感（避免引入大型库）
- 需要保持与现有 API 的兼容性
- 必须支持 Windows 和 Unix 平台

**利益相关者**：
- 开发者（需要可维护、可测试的代码）
- 用户（需要稳定的功能）

---

## Goals / Non-Goals (目标 / 非目标)

### Goals (目标)
- 将 `extension.ts` 从 664 行减少到 <50 行
- 实现服务间松耦合，支持单元测试
- 建立清晰的模块层次结构
- 引入依赖注入模式
- 引入事件驱动通信

### Non-Goals (非目标)
- 不引入 inversify 等重量级 DI 框架（体积约 50KB）
- 不引入 RxJS（体积约 200KB）
- 不改变现有用户配置项
- 不改变命令 ID 和快捷键

---

## Decisions (决策)

### Decision 1: 自实现轻量级 DI 容器

**决策**：实现约 120 行的轻量级 DI 容器，而非使用 inversify

**理由**：
1. VS Code 扩展打包体积敏感，inversify 约 50KB
2. 项目规模较小（~16 个服务），不需要复杂的 AOP 功能
3. 自实现容器易于理解和调试
4. 避免引入运行时反射依赖

**替代方案**：
- inversify：功能强大但体积大
- tsyringe：需要 reflect-metadata，增加复杂度
- 手动工厂模式：缺乏统一管理

### Decision 2: 自实现事件总线

**决策**：实现约 100 行的强类型事件总线，而非使用 RxJS

**理由**：
1. 项目不需要复杂的流操作（map/filter/merge）
2. 事件模式简单（发布/订阅/一次性）
3. RxJS 约 200KB，体积过大
4. 强类型事件定义在编译期检查

**替代方案**：
- RxJS：功能全面但过重
- EventEmitter3：轻量但缺乏类型安全
- Node.js EventEmitter：内置但类型弱

### Decision 3: 分离表现层

**决策**：创建独立的 `presentation/` 层，分离 UI 逻辑

**理由**：
1. 方便未来支持多种 UI（如 TreeView、Webview）
2. 便于单元测试（可 mock StatusBarService）
3. 遵循 MVP/MVVM 模式
4. 状态栏逻辑与业务逻辑解耦

---

## Architecture (架构)

### 模块层次图

```
┌─────────────────────────────────────────────────────────────┐
│                    extension.ts (瘦入口)                     │
│                        ~30 行                                │
└─────────────────────────┬───────────────────────────────────┘
                          │ 初始化
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                extension/ (扩展层)                           │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐   │
│  │ Lifecycle    │ │ Command      │ │ Config            │   │
│  │ Manager      │ │ Registry     │ │ Coordinator       │   │
│  └──────────────┘ └──────────────┘ └───────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              ServiceOrchestrator                      │   │
│  │  (服务编排、错误处理、自动重检测)                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ 依赖
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               core/ (核心层)                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐   │
│  │  Container   │ │  EventBus    │ │   Interfaces      │   │
│  │  (DI容器)    │ │  (事件总线)  │ │   (服务接口)      │   │
│  └──────────────┘ └──────────────┘ └───────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ 注入
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌──────────────┐
│ services/   │  │presentation/│  │  platform/   │
│ (服务层)    │  │ (表现层)    │  │  (平台层)    │
│             │  │             │  │              │
│ Quota       │  │ StatusBar   │  │ Process      │
│ Config      │  │ Presenter   │  │ Detector     │
│ ErrorRecov  │  │ QuotaPanel  │  │ (Win/Unix)   │
│ i18n        │  │ QuickMenu   │  │              │
└─────────────┘  └─────────────┘  └──────────────┘
```

### 目录结构

```
src/
├── core/
│   ├── container/
│   │   ├── Container.ts           # DI 容器实现
│   │   ├── types.ts               # 服务标识符 (Symbol)
│   │   └── index.ts               # 导出
│   ├── events/
│   │   ├── EventBus.ts            # 事件总线实现
│   │   ├── events.ts              # 事件类型定义
│   │   └── index.ts               # 导出
│   ├── interfaces/
│   │   ├── IQuotaService.ts       # 配额服务接口
│   │   ├── IStatusBarService.ts   # 状态栏服务接口
│   │   ├── IConfigService.ts      # 配置服务接口
│   │   ├── IPortDetectionService.ts # 端口检测服务接口
│   │   ├── IErrorRecoveryService.ts # 错误恢复服务接口
│   │   ├── ILocalizationService.ts  # 国际化服务接口
│   │   └── index.ts               # 导出
│   ├── types.ts                   # 全局类型定义 (迁移自 src/types.ts)
│   └── index.ts                   # core 模块导出
│
├── services/
│   ├── QuotaService.ts            # 配额服务实现
│   ├── StatusBarService.ts        # 状态栏服务实现
│   ├── ConfigService.ts           # 配置服务实现
│   ├── PortDetectionService.ts    # 端口检测服务实现
│   ├── ErrorRecoveryService.ts    # 错误恢复服务实现 (原 errorRecoveryManager)
│   ├── LocalizationService.ts     # 国际化服务实现
│   └── index.ts                   # 导出
│
├── presentation/
│   ├── StatusBarPresenter.ts      # 状态栏 UI 控制器
│   ├── QuotaPanel.ts              # Webview 面板 (迁移自 src/quotaPanel.ts)
│   ├── QuickMenuPresenter.ts      # 快捷菜单 (提取自 extension.ts)
│   └── index.ts                   # 导出
│
├── platform/
│   ├── PlatformDetector.ts        # 平台检测 (保持)
│   ├── ProcessPortDetector.ts     # 进程端口检测 (保持)
│   ├── WindowsProcessDetector.ts  # Windows 实现 (保持)
│   ├── UnixProcessDetector.ts     # Unix 实现 (保持)
│   └── index.ts                   # 导出
│
├── extension/
│   ├── LifecycleManager.ts        # 扩展生命周期管理
│   ├── CommandRegistry.ts         # 命令注册器
│   ├── ConfigCoordinator.ts       # 配置协调器 (含防抖)
│   ├── ServiceOrchestrator.ts     # 服务编排器 (含错误处理)
│   ├── bootstrap.ts               # 容器构建
│   └── index.ts                   # 导出
│
├── i18n/
│   ├── en.ts                      # 英文 (保持)
│   ├── zh-cn.ts                   # 中文 (保持)
│   └── types.ts                   # 类型定义 (保持)
│
└── extension.ts                   # 瘦入口 (~30行)
```

---

## Key Implementations (关键实现)

### DI 容器核心代码

```typescript
// src/core/container/Container.ts
export enum Lifecycle { Singleton = 'singleton', Transient = 'transient' }

interface Registration<T> {
  factory: (c: Container) => T;
  lifecycle: Lifecycle;
  instance?: T;
}

export class Container {
  private services = new Map<symbol, Registration<any>>();
  private resolving = new Set<symbol>();

  register<T>(id: symbol, factory: (c: Container) => T, lifecycle = Lifecycle.Singleton): void {
    this.services.set(id, { factory, lifecycle });
  }

  resolve<T>(id: symbol): T {
    const reg = this.services.get(id);
    if (!reg) throw new Error(`未注册: ${id.toString()}`);

    // 循环依赖检测
    if (this.resolving.has(id)) {
      throw new Error(`循环依赖: ${id.toString()}`);
    }

    if (reg.lifecycle === Lifecycle.Singleton && reg.instance) {
      return reg.instance;
    }

    this.resolving.add(id);
    try {
      const instance = reg.factory(this);
      if (reg.lifecycle === Lifecycle.Singleton) reg.instance = instance;
      return instance;
    } finally {
      this.resolving.delete(id);
    }
  }

  dispose(): void {
    for (const [, reg] of this.services) {
      if (reg.instance?.dispose) reg.instance.dispose();
    }
    this.services.clear();
  }
}
```

### 事件总线核心代码

```typescript
// src/core/events/EventBus.ts
type Handler<T> = (payload: T) => void | Promise<void>;

export class EventBus implements vscode.Disposable {
  private handlers = new Map<EventType, Set<Handler<any>>>();

  on<E extends EventType>(event: E, handler: Handler<EventPayloads[E]>): vscode.Disposable {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return { dispose: () => this.handlers.get(event)?.delete(handler) };
  }

  emit<E extends EventType>(event: E, payload: EventPayloads[E]): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) result.catch(e => console.error(e));
      } catch (e) { console.error(e); }
    }
  }

  dispose(): void { this.handlers.clear(); }
}
```

### 事件类型定义

```typescript
// src/core/events/events.ts
export enum EventType {
  QUOTA_UPDATE = 'quota:update',
  QUOTA_FETCH_ERROR = 'quota:fetch:error',
  QUOTA_RETRY = 'quota:retry',
  PORT_DETECT_SUCCESS = 'port:detect:success',
  PORT_DETECT_ERROR = 'port:detect:error',
  CONFIG_CHANGE = 'config:change',
  UI_STATUS_UPDATE = 'ui:status:update',
  UI_REFRESH_REQUEST = 'ui:refresh:request',
}

export interface EventPayloads {
  [EventType.QUOTA_UPDATE]: QuotaSnapshot;
  [EventType.QUOTA_FETCH_ERROR]: Error;
  [EventType.QUOTA_RETRY]: { attempt: number; max: number };
  [EventType.PORT_DETECT_SUCCESS]: PortDetectionResult;
  [EventType.PORT_DETECT_ERROR]: Error;
  [EventType.CONFIG_CHANGE]: Config;
  [EventType.UI_STATUS_UPDATE]: UIStatus;
  [EventType.UI_REFRESH_REQUEST]: void;
}
```

### 瘦入口示例

```typescript
// src/extension.ts (~30行)
import * as vscode from 'vscode';
import { buildContainer } from './extension/bootstrap';
import { TYPES } from './core/container/types';
import type { ILifecycleManager } from './extension/LifecycleManager';

let container: Container | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Antigravity Quota Watcher 激活中...');
  container = buildContainer(context);
  const lifecycle = container.resolve<ILifecycleManager>(TYPES.LifecycleManager);
  await lifecycle.activate(context);
  console.log('Antigravity Quota Watcher 已激活');
}

export function deactivate(): void {
  console.log('Antigravity Quota Watcher 停用中...');
  container?.dispose();
  container = undefined;
}
```

---

## Risks / Trade-offs (风险 / 权衡)

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 重构期间功能回归 | 高 | 分阶段实施，每阶段后手动测试验证 |
| 事件总线引入新 bug | 中 | 使用强类型事件定义，编译期检查 |
| 循环依赖 | 中 | 容器在解析时检测并抛出错误 |
| 内存泄漏 | 中 | 所有服务实现 Disposable 接口 |
| 性能下降 | 低 | 事件总线使用同步发布 |
| 学习曲线 | 低 | 自实现代码简单易懂（~200行） |

---

## Migration Plan (迁移计划)

### 阶段 1：基础设施搭建

1. 创建 `src/core/container/` 目录
2. 实现 `Container.ts` 和 `types.ts`
3. 创建 `src/core/events/` 目录
4. 实现 `EventBus.ts` 和 `events.ts`
5. 定义所有服务接口于 `src/core/interfaces/`
6. 迁移 `src/types.ts` 到 `src/core/types.ts`

**验证**：容器可以注册/解析服务，事件总线可以发布/订阅

### 阶段 2：服务层重构

1. 重构 `ConfigService` 实现 `IConfigService`
2. 重构 `LocalizationService` 实现 `ILocalizationService`
3. 重构 `QuotaService` 实现 `IQuotaService`，移除回调
4. 重构 `StatusBarService` 实现 `IStatusBarService`
5. 重构 `ErrorRecoveryManager` 为 `ErrorRecoveryService`
6. 重构 `PortDetectionService` 实现 `IPortDetectionService`

**验证**：所有服务通过接口访问，通过事件总线通信

### 阶段 3：表现层分离

1. 创建 `src/presentation/` 目录
2. 实现 `StatusBarPresenter.ts`
3. 提取 `QuickMenuPresenter.ts` 从 extension.ts
4. 迁移 `quotaPanel.ts` 到 `presentation/QuotaPanel.ts`

**验证**：UI 展示正常工作

### 阶段 4：扩展层重构

1. 创建 `src/extension/` 目录
2. 实现 `LifecycleManager.ts`
3. 实现 `CommandRegistry.ts`
4. 实现 `ConfigCoordinator.ts`
5. 实现 `ServiceOrchestrator.ts`
6. 实现 `bootstrap.ts`（容器构建）
7. 重写 `extension.ts` 为瘦入口

**验证**：extension.ts < 50 行，所有功能正常

### 阶段 5：测试与文档

1. 为 `Container` 编写单元测试
2. 为 `EventBus` 编写单元测试
3. 更新 `openspec/project.md`
4. 更新 `ARCHITECTURE_ANALYSIS.md`

**验证**：核心模块测试覆盖率 > 80%

---

## Open Questions (开放问题)

1. **测试框架选择**：是否需要引入 Jest/Mocha 进行单元测试？当前项目无测试框架。
2. **平台层是否需要接口化**：ProcessPortDetector 已使用策略模式，是否需要进一步抽象？
3. **是否保留 i18n 文件位置**：当前在 `src/i18n/`，是否需要移动到 `src/services/i18n/`？

---

## Appendix: Service Identifier Mapping (附录：服务标识符映射)

```typescript
// src/core/container/types.ts
export const TYPES = {
  // 核心
  EventBus: Symbol.for('EventBus'),

  // 服务
  QuotaService: Symbol.for('QuotaService'),
  StatusBarService: Symbol.for('StatusBarService'),
  ConfigService: Symbol.for('ConfigService'),
  PortDetectionService: Symbol.for('PortDetectionService'),
  ErrorRecoveryService: Symbol.for('ErrorRecoveryService'),
  LocalizationService: Symbol.for('LocalizationService'),

  // 表现层
  StatusBarPresenter: Symbol.for('StatusBarPresenter'),
  QuotaPanel: Symbol.for('QuotaPanel'),
  QuickMenuPresenter: Symbol.for('QuickMenuPresenter'),

  // 平台
  PlatformDetector: Symbol.for('PlatformDetector'),
  ProcessPortDetector: Symbol.for('ProcessPortDetector'),

  // 扩展
  LifecycleManager: Symbol.for('LifecycleManager'),
  CommandRegistry: Symbol.for('CommandRegistry'),
  ConfigCoordinator: Symbol.for('ConfigCoordinator'),
  ServiceOrchestrator: Symbol.for('ServiceOrchestrator'),

  // VS Code
  ExtensionContext: Symbol.for('ExtensionContext'),
};
```
