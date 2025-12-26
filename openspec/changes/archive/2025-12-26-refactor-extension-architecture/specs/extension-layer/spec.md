## ADDED Requirements

### Requirement: Lifecycle Manager
The system SHALL provide a LifecycleManager to handle extension activation and deactivation.

#### Scenario: Extension Activation
- **WHEN** the extension is activated
- **THEN** the LifecycleManager SHALL:
  1. Register all commands via CommandRegistry
  2. Start ConfigCoordinator
  3. Initialize StatusBarPresenter
  4. Start ServiceOrchestrator

#### Scenario: Extension Deactivation
- **WHEN** the extension is deactivated
- **THEN** the LifecycleManager SHALL dispose all registered disposables

#### Scenario: Context Subscription
- **WHEN** disposables are created during activation
- **THEN** they SHALL be added to the ExtensionContext subscriptions

---

### Requirement: Command Registry
The system SHALL provide a CommandRegistry to register all extension commands.

#### Scenario: Show Quota Command
- **WHEN** 'antigravity-quota-watcher.showQuota' is executed
- **THEN** the QuickMenuPresenter SHALL display the menu

#### Scenario: Show Detailed Panel Command
- **WHEN** 'antigravity-quota-watcher.showDetailedPanel' is executed
- **THEN** the QuotaPanel SHALL be created or shown

#### Scenario: Quick Refresh Command
- **WHEN** 'antigravity-quota-watcher.quickRefreshQuota' is executed
- **THEN** the QuotaService SHALL perform a quick refresh
- **AND** a 5-second cooldown SHALL prevent rapid consecutive refreshes

#### Scenario: Refresh Quota Command
- **WHEN** 'antigravity-quota-watcher.refreshQuota' is executed
- **THEN** a UI_REFRESH_REQUEST event SHALL be emitted

#### Scenario: Retry Login Command
- **WHEN** 'antigravity-quota-watcher.retryLoginCheck' is executed
- **THEN** the QuotaService SHALL stop and restart polling

#### Scenario: Detect Port Command
- **WHEN** 'antigravity-quota-watcher.detectPort' is executed
- **THEN** the ServiceOrchestrator SHALL redetect the port

---

### Requirement: Config Coordinator
The system SHALL provide a ConfigCoordinator to handle configuration changes.

#### Scenario: Configuration Change Detection
- **WHEN** VS Code configuration changes affecting 'antigravity-quota-watcher'
- **THEN** the ConfigCoordinator SHALL detect the change

#### Scenario: Change Debouncing
- **WHEN** multiple configuration changes occur rapidly
- **THEN** the ConfigCoordinator SHALL debounce them (300ms delay)
- **AND** emit a single CONFIG_CHANGE event

#### Scenario: Language Change
- **WHEN** the language configuration changes
- **THEN** a CONFIG_LANGUAGE_CHANGE event SHALL be emitted
- **AND** LocalizationService SHALL be updated

---

### Requirement: Service Orchestrator
The system SHALL provide a ServiceOrchestrator to coordinate service initialization and error handling.

#### Scenario: Initial Port Detection
- **WHEN** the orchestrator is initialized
- **THEN** it SHALL:
  1. Emit PORT_DETECT_START event
  2. Call PortDetectionService.detectPort()
  3. On success: emit PORT_DETECT_SUCCESS and configure QuotaService
  4. On failure: emit PORT_DETECT_ERROR and show retry dialog

#### Scenario: Auto-Redetect on Error
- **WHEN** consecutive quota fetch errors occur
- **AND** 3 minutes have passed since last auto-redetect
- **THEN** the orchestrator SHALL attempt port redetection

#### Scenario: Configuration Application
- **WHEN** a CONFIG_CHANGE event is received
- **THEN** the orchestrator SHALL:
  - Update QuotaService API method and HTTP fallback settings
  - Update StatusBarService thresholds and display options
  - Start or stop polling based on enabled state

#### Scenario: Refresh Request Handling
- **WHEN** a UI_REFRESH_REQUEST event is received
- **THEN** the orchestrator SHALL trigger QuotaService.retryFromError

#### Scenario: Event Subscription Setup
- **WHEN** the orchestrator is initialized
- **THEN** it SHALL subscribe to:
  - QUOTA_FETCH_SUCCESS → update status bar
  - QUOTA_FETCH_ERROR → handle error and trigger auto-redetect
  - QUOTA_RETRY → show retry state
  - CONFIG_CHANGE → apply configuration
  - UI_REFRESH_REQUEST → trigger refresh

---

### Requirement: Container Bootstrap
The system SHALL provide a bootstrap function to build the DI container.

#### Scenario: Container Building
- **WHEN** buildContainer is called with ExtensionContext
- **THEN** all services SHALL be registered with appropriate lifecycles

#### Scenario: Dependency Graph
- **WHEN** services are registered
- **THEN** the registration order SHALL respect dependencies:
  1. Core: EventBus
  2. Services: ConfigService → LocalizationService → Others
  3. Presentation: Presenters
  4. Extension: Orchestrator → LifecycleManager

---

### Requirement: Thin Extension Entry Point
The extension.ts file SHALL be a thin entry point delegating to LifecycleManager.

#### Scenario: Activation
- **WHEN** the extension activates
- **THEN** extension.ts SHALL:
  1. Build the DI container
  2. Resolve LifecycleManager
  3. Call LifecycleManager.activate()

#### Scenario: Deactivation
- **WHEN** the extension deactivates
- **THEN** extension.ts SHALL dispose the container

#### Scenario: Code Size
- **WHEN** the extension.ts file is measured
- **THEN** it SHALL be less than 50 lines
