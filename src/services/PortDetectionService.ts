/**
 * 端口检测服务
 *
 * 负责检测 Antigravity 进程的端口和 CSRF 令牌，通过事件总线发布检测结果。
 */

import type { IPortDetectionService } from '../core/interfaces/IPortDetectionService';
import type { PortDetectionResult } from '../core/events/events';
import type { EventBus } from '../core/events/EventBus';
import { EventType } from '../core/events/events';
import {
  ProcessPortDetector,
  type AntigravityProcessInfo,
} from '../processPortDetector';

/**
 * 端口检测服务实现
 */
export class PortDetectionService implements IPortDetectionService {
  private readonly processDetector: ProcessPortDetector;
  private disposed: boolean = false;

  constructor(private readonly eventBus?: EventBus) {
    this.processDetector = new ProcessPortDetector();
  }

  /**
   * 检测端口
   *
   * 从进程参数中读取端口和 CSRF 令牌。
   *
   * @returns 检测结果或 null（检测失败时）
   */
  async detectPort(): Promise<PortDetectionResult | null> {
    // 发布检测开始事件
    this.eventBus?.emit(EventType.PORT_DETECTION_START, undefined);

    try {
      // 从进程参数获取端口和 CSRF 令牌
      const processInfo: AntigravityProcessInfo | null =
        await this.processDetector.detectProcessInfo();

      if (!processInfo) {
        console.error(
          '[PortDetectionService] 无法从进程获取端口和 CSRF 令牌。'
        );
        console.error(
          '[PortDetectionService] 请确保 language_server_windows_x64.exe 正在运行。'
        );

        const error = new Error('无法检测到 Antigravity 进程');

        // 发布检测失败事件
        this.eventBus?.emit(EventType.PORT_DETECTION_FAILED, error);
        this.eventBus?.emit(EventType.PORT_DETECT_ERROR, error);

        return null;
      }

      console.log(
        `[PortDetectionService] 检测到 Connect 端口 (HTTPS): ${processInfo.connectPort}`
      );
      console.log(
        `[PortDetectionService] 检测到 extension 端口 (HTTP): ${processInfo.extensionPort}`
      );
      console.log('[PortDetectionService] 检测到 CSRF 令牌: [已隐藏]');

      const result: PortDetectionResult = {
        // 保持兼容性：port 是主要的 connect 端口
        port: processInfo.connectPort,
        connectPort: processInfo.connectPort,
        httpPort: processInfo.extensionPort,
        csrfToken: processInfo.csrfToken,
        source: 'process',
        confidence: 'high',
      };

      // 发布检测成功事件
      this.eventBus?.emit(EventType.PORT_DETECTION_SUCCESS, result);
      this.eventBus?.emit(EventType.PORT_DETECT_SUCCESS, result);

      return result;
    } catch (error: any) {
      console.error('[PortDetectionService] 端口检测失败:', error.message);

      const err = error instanceof Error ? error : new Error(String(error));

      // 发布检测失败事件
      this.eventBus?.emit(EventType.PORT_DETECTION_FAILED, err);
      this.eventBus?.emit(EventType.PORT_DETECT_ERROR, err);

      return null;
    }
  }

  /**
   * 销毁服务
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
  }
}
