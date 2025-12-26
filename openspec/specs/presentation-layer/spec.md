# presentation-layer Specification

## Purpose
TBD - created by archiving change refactor-extension-architecture. Update Purpose after archive.
## Requirements
### Requirement: Status Bar Presenter
The system SHALL provide a StatusBarPresenter to control status bar UI independently.

#### Scenario: Quota Display
- **WHEN** the presenter receives a QUOTA_UPDATE event
- **THEN** it SHALL update the status bar via StatusBarService

#### Scenario: Error Display
- **WHEN** the presenter receives a QUOTA_FETCH_ERROR event
- **THEN** it SHALL show error state via StatusBarService.showError

#### Scenario: Retry Display
- **WHEN** the presenter receives a QUOTA_RETRY event
- **THEN** it SHALL show retry state via StatusBarService.showRetrying

#### Scenario: Initial State
- **WHEN** the presenter is initialized
- **THEN** it SHALL show detecting state via StatusBarService.showDetecting

---

### Requirement: Quick Menu Presenter
The system SHALL provide a QuickMenuPresenter for the status bar click menu.

#### Scenario: Menu Display
- **WHEN** show() is called
- **THEN** a QuickPick menu SHALL be displayed with available actions

#### Scenario: Refresh Action
- **WHEN** user selects "Refresh Quota" from the menu
- **THEN** the QUOTA_REFRESH_REQUEST event SHALL be emitted

#### Scenario: Show Panel Action
- **WHEN** user selects "Show Detailed Panel" from the menu
- **THEN** the showDetailedPanel command SHALL be executed

#### Scenario: Detect Port Action
- **WHEN** user selects "Detect Port" from the menu
- **THEN** the detectPort command SHALL be executed

#### Scenario: Localized Menu Items
- **WHEN** the menu is displayed
- **THEN** all menu items SHALL be translated using LocalizationService

---

### Requirement: Quota Panel
The QuotaPanel SHALL render detailed quota information in a Webview.

#### Scenario: Panel Creation
- **WHEN** createOrShow is called with a QuotaSnapshot
- **THEN** a Webview panel SHALL be created or brought to focus

#### Scenario: Content Rendering
- **WHEN** the panel is displayed
- **THEN** it SHALL show:
  - Plan name (if configured)
  - Prompt credits (if configured)
  - Model quota cards with percentages and reset times

#### Scenario: XSS Prevention
- **WHEN** rendering user data in HTML
- **THEN** all values SHALL be HTML-escaped to prevent XSS attacks

#### Scenario: Panel Singleton
- **WHEN** createOrShow is called multiple times
- **THEN** only one panel instance SHALL exist

