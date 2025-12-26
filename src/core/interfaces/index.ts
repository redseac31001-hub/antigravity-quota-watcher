/**
 * 接口模块导出
 */

export type { IQuotaService } from './IQuotaService';
export { QuotaApiMethod } from './IQuotaService';

export type { IStatusBarService, DisplayStyle } from './IStatusBarService';

export type { IConfigService } from './IConfigService';

export type { IPortDetectionService, PortDetectionResult } from './IPortDetectionService';

export type {
  IErrorRecoveryService,
  RecoveryContext,
  ErrorStatistics,
} from './IErrorRecoveryService';

export type {
  ILocalizationService,
  SupportedLanguage,
} from './ILocalizationService';
