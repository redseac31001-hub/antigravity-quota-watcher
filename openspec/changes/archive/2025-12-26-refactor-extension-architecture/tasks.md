# Tasks: Refactor Extension Architecture (重构扩展架构任务清单)

## 1. Phase 1: Core Infrastructure (阶段1：核心基础设施) ✅ COMPLETED

- [x] 1.1 Create `src/core/` directory structure (创建 core 目录结构)
- [x] 1.2 Implement `Container.ts` with singleton/transient lifecycle support (实现 DI 容器)
- [x] 1.3 Implement `types.ts` with service identifiers (实现服务标识符)
- [x] 1.4 Implement `EventBus.ts` with typed events and error isolation (实现事件总线)
- [x] 1.5 Implement `events.ts` with all event type definitions (实现事件类型定义)
- [x] 1.6 Define `IQuotaService` interface (定义配额服务接口)
- [x] 1.7 Define `IStatusBarService` interface (定义状态栏服务接口)
- [x] 1.8 Define `IConfigService` interface (定义配置服务接口)
- [x] 1.9 Define `IPortDetectionService` interface (定义端口检测服务接口)
- [x] 1.10 Define `IErrorRecoveryService` interface (定义错误恢复服务接口)
- [x] 1.11 Define `ILocalizationService` interface (定义国际化服务接口)
- [x] 1.12 Migrate `src/types.ts` to `src/core/types.ts` (迁移类型定义文件)
- [x] 1.13 Write unit tests for Container (编写容器单元测试)
- [x] 1.14 Write unit tests for EventBus (编写事件总线单元测试)

## 2. Phase 2: Service Layer Refactoring (阶段2：服务层重构) ✅ COMPLETED

- [x] 2.1 Refactor `ConfigService` to implement `IConfigService` (重构配置服务)
- [x] 2.2 Refactor `LocalizationService` to implement `ILocalizationService` (重构国际化服务)
- [x] 2.3 Refactor `QuotaService` to implement `IQuotaService` and use EventBus (重构配额服务)
  - [x] 2.3.1 Remove callback methods (onQuotaUpdate, onError, onStatus)
  - [x] 2.3.2 Emit events via EventBus instead
  - [x] 2.3.3 Accept dependencies via constructor injection
- [x] 2.4 Refactor `StatusBarService` to implement `IStatusBarService` (重构状态栏服务)
- [x] 2.5 Rename and refactor `ErrorRecoveryManager` to `ErrorRecoveryService` (重命名错误恢复服务)
- [x] 2.6 Refactor `PortDetectionService` to implement interface (重构端口检测服务)
- [x] 2.7 Move service files to `src/services/` directory (移动服务文件到 services 目录)

## 3. Phase 3: Presentation Layer Separation (阶段3：表现层分离) ✅ COMPLETED

- [x] 3.1 Create `src/presentation/` directory (创建 presentation 目录)
- [x] 3.2 Implement `StatusBarPresenter.ts` (实现状态栏展示器)
- [x] 3.3 Extract `QuickMenuPresenter.ts` from extension.ts (提取快捷菜单展示器)
- [x] 3.4 Migrate `quotaPanel.ts` to `presentation/QuotaPanel.ts` (迁移配额面板)
- [x] 3.5 Update imports and wire presenters through DI (更新导入并通过 DI 连接)

## 4. Phase 4: Extension Layer Refactoring (阶段4：扩展层重构) ✅ COMPLETED

- [x] 4.1 Create `src/extension/` directory (创建 extension 目录)
- [x] 4.2 Implement `CommandRegistry.ts` (实现命令注册器)
  - [x] 4.2.1 Register showQuota command
  - [x] 4.2.2 Register showDetailedPanel command
  - [x] 4.2.3 Register quickRefreshQuota command
  - [x] 4.2.4 Register refreshQuota command
  - [x] 4.2.5 Register retryLoginCheck command
  - [x] 4.2.6 Register detectPort command
- [x] 4.3 Implement `ServiceOrchestrator.ts` (实现服务编排器)
  - [x] 4.3.1 Port detection flow
  - [x] 4.3.2 Error handling and auto-redetect
  - [x] 4.3.3 Event subscriptions
  - [x] 4.3.4 Configuration change handling
- [x] 4.4 Implement `bootstrap.ts` for container building (实现容器构建)
- [x] 4.5 Rewrite `extension.ts` as thin entry point (<50 lines) (重写扩展入口)
- [x] 4.6 Verify TypeScript compilation passes (验证 TypeScript 编译通过)

## 5. Phase 5: Cleanup & Finalization (阶段5：清理与完成) ✅ COMPLETED

- [x] 5.1 Delete unused legacy files (删除未使用的旧文件)
  - [x] `src/statusBar.ts`
  - [x] `src/quotaService.ts`
  - [x] `src/quotaPanel.ts`
  - [x] `src/errorRecoveryManager.ts`
  - [x] `src/configService.ts`
  - [x] `src/portDetectionService.ts`
  - [x] `src/i18n/localizationService.ts`
- [x] 5.2 Verify no TODO/FIXME/HACK comments remain (验证无遗留注释)
- [x] 5.3 Verify documentation comments are complete (验证文档注释完整)
- [x] 5.4 Verify no circular dependencies (验证无循环依赖)
- [x] 5.5 Final TypeScript compilation check (最终编译检查)
- [x] 5.6 Manual testing passed (手动测试通过) - User confirmed F5 runtime stable

## Dependencies (依赖关系)

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
           ↓
         (可并行)
           ↓
        Phase 3
```

- Phase 2 depends on Phase 1 (services need core infrastructure)
- Phase 3 depends on Phase 2 (presenters need refactored services)
- Phase 3 can partially parallel with late Phase 2 tasks
- Phase 4 depends on Phase 2 and Phase 3
- Phase 5 depends on Phase 4

## Validation Criteria (验证标准)

| Phase | Criteria |
|-------|----------|
| 1 | Container resolves services, EventBus publishes/subscribes |
| 2 | All services implement interfaces, communicate via events |
| 3 | UI displays correctly, presenters work independently |
| 4 | extension.ts < 50 lines, all commands functional |
| 5 | Core module test coverage > 80%, docs updated |

## Rollback Markers (回滚标记)

Create Git tags after each phase:
- `refactor/phase-1-infrastructure`
- `refactor/phase-2-services`
- `refactor/phase-3-presentation`
- `refactor/phase-4-extension`
- `refactor/phase-5-tests`
