# service-layer Specification

## Purpose
TBD - created by archiving change refactor-extension-architecture. Update Purpose after archive.
## Requirements
### Requirement: Quota Service Interface
The QuotaService SHALL implement the IQuotaService interface and communicate via EventBus.

#### Scenario: Polling Start
- **WHEN** startPolling is called with an interval
- **THEN** the service SHALL begin periodic quota fetches at that interval
- **AND** emit QUOTA_FETCH_START event before each fetch

#### Scenario: Quota Fetch Success
- **WHEN** quota data is successfully fetched
- **THEN** the service SHALL emit QUOTA_FETCH_SUCCESS with the QuotaSnapshot
- **AND** emit QUOTA_UPDATE with the same snapshot

#### Scenario: Quota Fetch Error
- **WHEN** quota fetch fails
- **THEN** the service SHALL emit QUOTA_FETCH_ERROR with the Error
- **AND** initiate retry logic if configured

#### Scenario: Retry Notification
- **WHEN** a retry attempt is initiated
- **THEN** the service SHALL emit QUOTA_RETRY with attempt number and max attempts

#### Scenario: Connection Info Update
- **WHEN** setConnectionInfo is called
- **THEN** the service SHALL use the new port, httpPort, and csrfToken for subsequent requests

---

### Requirement: Status Bar Service Interface
The StatusBarService SHALL implement the IStatusBarService interface.

#### Scenario: Display Update
- **WHEN** updateDisplay is called with a QuotaSnapshot
- **THEN** the status bar text SHALL reflect the quota information

#### Scenario: Status Indicators
- **WHEN** displaying quota percentages
- **THEN** the service SHALL show appropriate indicators based on thresholds
  - Green (🟢) for normal (> warning threshold)
  - Yellow (🟡) for warning (> critical threshold)
  - Red (🔴) for critical (> 0)
  - Stop (⛔) for depleted (= 0)

#### Scenario: Loading States
- **WHEN** showDetecting/showInitializing/showFetching/showRetrying is called
- **THEN** the status bar SHALL display the corresponding loading indicator

#### Scenario: Threshold Configuration
- **WHEN** setThresholds is called
- **THEN** subsequent display updates SHALL use the new thresholds

---

### Requirement: Config Service Interface
The ConfigService SHALL implement the IConfigService interface.

#### Scenario: Configuration Reading
- **WHEN** getConfig is called
- **THEN** the service SHALL return the current configuration from VS Code settings

#### Scenario: Configuration Update
- **WHEN** updateConfig is called with a key and value
- **THEN** the VS Code workspace configuration SHALL be updated

---

### Requirement: Port Detection Service Interface
The PortDetectionService SHALL implement the IPortDetectionService interface.

#### Scenario: Port Detection
- **WHEN** detectPort is called
- **THEN** the service SHALL return a PortDetectionResult with port, httpPort, and csrfToken
- **OR** return null if detection fails

---

### Requirement: Error Recovery Service Interface
The ErrorRecoveryService SHALL implement the IErrorRecoveryService interface.

#### Scenario: Error Handling
- **WHEN** handleError is called with an error and recovery context
- **THEN** the service SHALL classify the error and invoke appropriate recovery actions

#### Scenario: Error Classification
- **WHEN** an error is received
- **THEN** the service SHALL classify it as one of:
  - CONNECTION_REFUSED → trigger port redetection
  - PROTOCOL_ERROR → trigger API method toggle
  - TIMEOUT → wait and retry
  - AUTH_ERROR → prompt user to re-login
  - UNKNOWN → log and continue

#### Scenario: Error Statistics
- **WHEN** getStatistics is called
- **THEN** the service SHALL return error counts and type distribution

---

### Requirement: Localization Service Interface
The LocalizationService SHALL implement the ILocalizationService interface.

#### Scenario: Text Translation
- **WHEN** t(key) is called with a translation key
- **THEN** the service SHALL return the translated string for the current language

#### Scenario: Language Change
- **WHEN** setLanguage is called
- **THEN** subsequent t() calls SHALL use the new language translations

