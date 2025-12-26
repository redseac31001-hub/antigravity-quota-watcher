# core-infrastructure Specification

## Purpose
TBD - created by archiving change refactor-extension-architecture. Update Purpose after archive.
## Requirements
### Requirement: Dependency Injection Container
The system SHALL provide a lightweight dependency injection container for service management.

#### Scenario: Service Registration
- **WHEN** a service factory is registered with the container
- **THEN** the container SHALL store the factory with its lifecycle configuration

#### Scenario: Singleton Service Resolution
- **WHEN** a singleton service is resolved multiple times
- **THEN** the container SHALL return the same instance each time

#### Scenario: Transient Service Resolution
- **WHEN** a transient service is resolved multiple times
- **THEN** the container SHALL create a new instance each time

#### Scenario: Circular Dependency Detection
- **WHEN** a circular dependency is detected during resolution
- **THEN** the container SHALL throw an error with the dependency chain

#### Scenario: Container Disposal
- **WHEN** the container is disposed
- **THEN** all singleton instances with dispose methods SHALL be disposed

---

### Requirement: Event Bus
The system SHALL provide a typed event bus for decoupled inter-service communication.

#### Scenario: Event Subscription
- **WHEN** a handler is registered for an event type
- **THEN** the handler SHALL be called when that event is emitted

#### Scenario: Event Emission
- **WHEN** an event is emitted with a payload
- **THEN** all registered handlers for that event type SHALL receive the payload

#### Scenario: One-Time Subscription
- **WHEN** a one-time handler is registered and the event is emitted
- **THEN** the handler SHALL be called once and then automatically unsubscribed

#### Scenario: Handler Error Isolation
- **WHEN** an event handler throws an error
- **THEN** other handlers for the same event SHALL still be called
- **AND** the error SHALL be logged

#### Scenario: Subscription Disposal
- **WHEN** a subscription disposable is disposed
- **THEN** the handler SHALL no longer receive events

---

### Requirement: Service Interfaces
The system SHALL define interfaces for all core services to enable dependency inversion.

#### Scenario: Interface Implementation
- **WHEN** a service class implements its interface
- **THEN** the class SHALL provide all methods defined in the interface

#### Scenario: Mock Substitution
- **WHEN** a mock implementation of an interface is provided to the container
- **THEN** dependents SHALL receive the mock instead of the real implementation

---

### Requirement: Type Definitions
The system SHALL provide centralized type definitions for domain models.

#### Scenario: Quota Types
- **WHEN** quota data is processed
- **THEN** it SHALL use the QuotaSnapshot, ModelQuotaInfo, and PromptCreditsInfo types

#### Scenario: Event Payload Types
- **WHEN** events are emitted
- **THEN** the payload type SHALL match the EventPayloads mapping for that event type

#### Scenario: Configuration Types
- **WHEN** configuration is read or updated
- **THEN** it SHALL use the Config interface type

