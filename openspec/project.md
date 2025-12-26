# Project: Antigravity Quota Watcher

## 1. 🎯 Project Goals (项目目标)
A VS Code extension to monitor Antigravity model usage quotas, port detection, and process status.
(VS Code 扩展，用于实时监测 Antigravity 模型配额、端口占用及系统进程状态。)

## 2. 🛠 Tech Stack (技术栈)
- **Core**: VS Code Extension API, TypeScript
- **Runtime**: Node.js
- **UI**: StatusBarItem, Webview (HTML/CSS)
- **OS Support**: Windows (PowerShell/WMIC), Unix/Linux (ps/lsof)

## 3. 📂 Architecture & Modules (架构与模块)
**AI Instruction:** When generating code or plans, strictly adhere to the layered architecture and responsibilities defined below. Do not create new files unless explicitly requested.
(AI 指令：生成代码或计划时，必须严格遵循以下分层架构和职责定义。除非明确要求，否则不要创建新文件。)

### 3.1 Layered Architecture (分层架构)

```
┌─────────────────────────────────────────────────────────────┐
│                    Entry (入口层)                            │
│                  src/extension.ts                           │
│            Minimal bootstrap, DI container init             │
├─────────────────────────────────────────────────────────────┤
│                Extension Layer (扩展层)                      │
│                  src/extension/                             │
│     CommandRegistry, ServiceOrchestrator, Bootstrap         │
├─────────────────────────────────────────────────────────────┤
│               Presentation Layer (表现层)                    │
│                 src/presentation/                           │
│      StatusBarPresenter, QuotaPanel, QuickMenuPresenter     │
├─────────────────────────────────────────────────────────────┤
│                 Service Layer (服务层)                       │
│                   src/services/                             │
│  QuotaService, ConfigService, StatusBarService, etc.        │
├─────────────────────────────────────────────────────────────┤
│                   Core Layer (核心层)                        │
│                     src/core/                               │
│         Container, EventBus, Interfaces, Types              │
└─────────────────────────────────────────────────────────────┘
```

**Dependency Rule (依赖规则):** Upper layers may depend on lower layers, but NOT vice versa.
(上层可以依赖下层，但下层不得依赖上层。)

### 3.2 Module Reference (模块参考)

#### Core Layer (核心层) - `src/core/`
| Module | File Path | Responsibility |
|--------|-----------|----------------|
| **Container** | `src/core/container/Container.ts` | Lightweight DI container with singleton/transient lifecycle. (轻量级依赖注入容器) |
| **TYPES** | `src/core/container/types.ts` | Service identifiers (Symbol keys). (服务标识符) |
| **EventBus** | `src/core/events/EventBus.ts` | Typed pub/sub with error isolation. (强类型发布/订阅) |
| **Events** | `src/core/events/events.ts` | Event type definitions and payloads. (事件类型定义) |
| **Interfaces** | `src/core/interfaces/*.ts` | Service contracts (IQuotaService, IConfigService, etc.). (服务接口契约) |
| **Types** | `src/core/types.ts` | Shared domain types (QuotaSnapshot, Config, etc.). (共享类型定义) |

#### Service Layer (服务层) - `src/services/`
| Module | File Path | Responsibility |
|--------|-----------|----------------|
| **QuotaService** | `src/services/QuotaService.ts` | API calls, data parsing, polling logic. Emits events via EventBus. (配额API调用、轮询) |
| **ConfigService** | `src/services/ConfigService.ts` | Configuration reading, emits CONFIG_CHANGE events. (配置管理) |
| **StatusBarService** | `src/services/StatusBarService.ts` | Pure UI manipulation (no event subscription). (状态栏UI操作) |
| **PortDetectionService** | `src/services/PortDetectionService.ts` | Port/CSRF detection flow. (端口检测流程) |
| **ErrorRecoveryService** | `src/services/ErrorRecoveryService.ts` | Error catching and auto-recovery strategies. (错误恢复策略) |
| **LocalizationService** | `src/services/LocalizationService.ts` | i18n support with language switching. (国际化支持) |

#### Presentation Layer (表现层) - `src/presentation/`
| Module | File Path | Responsibility |
|--------|-----------|----------------|
| **StatusBarPresenter** | `src/presentation/StatusBarPresenter.ts` | Subscribes to EventBus, coordinates StatusBarService. (状态栏事件协调) |
| **QuotaPanel** | `src/presentation/QuotaPanel.ts` | Webview rendering, HTML generation. (配额详情面板) |
| **QuickMenuPresenter** | `src/presentation/QuickMenuPresenter.ts` | QuickPick menu for user actions. (快捷菜单) |

#### Extension Layer (扩展层) - `src/extension/`
| Module | File Path | Responsibility |
|--------|-----------|----------------|
| **Bootstrap** | `src/extension/bootstrap.ts` | Builds DI container, registers all services. (构建DI容器) |
| **CommandRegistry** | `src/extension/CommandRegistry.ts` | Registers VS Code commands, routes to handlers. (命令注册) |
| **ServiceOrchestrator** | `src/extension/ServiceOrchestrator.ts` | Coordinates initialization, port detection, error recovery. (服务编排) |

#### Entry (入口) - `src/extension.ts`
| Module | File Path | Responsibility |
|--------|-----------|----------------|
| **Extension** | `src/extension.ts` | Minimal entry point (<50 lines). Builds container and delegates to orchestrator. (精简入口) |

#### Platform Layer (平台层) - `src/`
| Module | File Path | Responsibility |
|--------|-----------|----------------|
| **ProcessPortDetector** | `src/processPortDetector.ts` | Cross-platform abstract layer. (跨平台抽象层) |
| **WindowsProcessDetector** | `src/windowsProcessDetector.ts` | PowerShell/WMIC implementation. (Windows实现) |
| **UnixProcessDetector** | `src/unixProcessDetector.ts` | ps/lsof implementation. (Unix实现) |
| **PlatformDetector** | `src/platformDetector.ts` | OS detection utilities. (操作系统检测) |

#### i18n Layer (国际化) - `src/i18n/`
| Module | File Path | Responsibility |
|--------|-----------|----------------|
| **en** | `src/i18n/en.ts` | English translations. (英文翻译) |
| **zh-cn** | `src/i18n/zh-cn.ts` | Simplified Chinese translations. (简体中文翻译) |
| **types** | `src/i18n/types.ts` | Translation key types. (翻译键类型) |

## 4. 📝 Workflow & Bilingual Output Rules (双语工作流规范)
**CRITICAL INSTRUCTION FOR AI AGENT:**
To support both the AI engine (English) and the human team (Chinese), all `Proposals` and `Tasks` must follow this bilingual format:

### A. For Proposals (`openspec new proposal`)
When asked to fill a proposal, structure it as:
1.  **🇬🇧 Technical Specification (English)**:
    - Describe the change in technical English.
    - List specific files to modify (referencing Section 3).
    - Provide pseudocode if necessary.
2.  **🇨🇳 管理摘要 (Chinese Summary)**:
    - **背景**: Why are we doing this?
    - **方案**: How will we solve it? (Simple language)
    - **影响**: Any risks?

### B. For Tasks (`openspec task gen`)
When generating tasks, the task titles must be bilingual.
* **Format**: `English Action (中文动作)`
* **Example**: `Update polling logic in quotaService.ts (更新配额服务的轮询逻辑)`

## 5. Coding Conventions
- **Async/Await**: Use for all I/O operations.
- **Error Handling**: Route specific errors to `errorRecoveryManager`.
- **UI Updates**: Must be debounced to prevent flickering.