# Change: Refactor Extension Architecture (重构扩展架构)

## 🇬🇧 Technical Specification (English)

### Why

The current VS Code extension architecture has grown organically and now suffers from several structural issues that impede maintainability, testability, and future extensibility:

1. **God Object Anti-Pattern**: `extension.ts` (664 lines) handles lifecycle management, service instantiation, command registration, configuration handling, and error recovery—violating the Single Responsibility Principle.

2. **Tight Coupling**: Services are directly instantiated and bound via closures, making it impossible to substitute mock implementations for testing.

3. **Scattered Configuration**: Configuration change handling is distributed across `ConfigService`, individual services, and `extension.ts` with manual debouncing.

4. **Callback Spaghetti**: Services communicate through callback functions registered in `extension.ts`, leading to duplicated error handling code (appears 3 times).

### What Changes

- **BREAKING**: Complete restructuring of `src/` directory layout
- **BREAKING**: All service constructors will change to accept dependencies via injection
- Introduce lightweight Dependency Injection container (~120 lines)
- Introduce Event Bus for decoupled inter-service communication (~100 lines)
- Define interfaces for all services (IQuotaService, IStatusBarService, etc.)
- Split `extension.ts` into focused modules:
  - `LifecycleManager` - extension activation/deactivation
  - `CommandRegistry` - command registration and handlers
  - `ConfigCoordinator` - configuration change handling with debouncing
  - `ServiceOrchestrator` - service initialization and error recovery
- Reduce `extension.ts` from 664 lines to <50 lines (thin entry point)

### Impact

- Affected specs: core-infrastructure, service-layer, presentation-layer, extension-layer
- Affected code:
  - `src/extension.ts` → Split into multiple modules
  - `src/quotaService.ts` → Implement IQuotaService, emit events instead of callbacks
  - `src/statusBar.ts` → Split into StatusBarService + StatusBarPresenter
  - `src/configService.ts` → Implement IConfigService
  - `src/errorRecoveryManager.ts` → Rename to ErrorRecoveryService
  - `src/types.ts` → Move to `src/core/types.ts`
- Risk: High complexity refactoring; requires careful staged migration

---

## 🇨🇳 管理摘要 (Chinese Summary)

### 背景

当前扩展架构存在以下问题：
- **extension.ts 过大**：664行代码承担了生命周期管理、服务实例化、命令注册、配置处理等多重职责
- **服务间耦合严重**：服务直接实例化，通过闭包访问，无法进行单元测试
- **配置管理分散**：配置变更处理分布在多个文件中，防抖逻辑与业务逻辑混杂

### 方案

引入现代化架构模式重构整个扩展：

1. **依赖注入容器**：解耦服务实例化，提升可测试性
2. **事件总线**：服务间通过事件通信，降低耦合度
3. **接口抽象**：定义清晰的服务接口，便于 mock 和扩展
4. **模块拆分**：将 extension.ts 拆分为专注的小模块

### 影响

- **代码组织**：新建 `core/`、`services/`、`presentation/`、`extension/` 目录
- **破坏性变更**：所有服务构造函数签名改变，目录结构重组
- **风险缓解**：分5阶段实施，每阶段完成后验证功能正常
