/**
 * 强类型事件总线
 *
 * 提供解耦的发布/订阅机制，支持强类型事件定义。
 * 所有事件处理器错误都会被隔离，不会影响其他处理器执行。
 */

import type { Disposable } from 'vscode';
import type { EventType, EventPayloads } from './events';

/**
 * 事件处理器函数类型
 */
export type EventHandler<T> = (payload: T) => void | Promise<void>;

/**
 * 全局错误处理器类型
 */
export type ErrorHandler = (error: Error, eventType: EventType, handlerName?: string) => void;

/**
 * 订阅选项
 */
export interface SubscriptionOptions {
  /** 处理器名称，用于调试和错误报告 */
  name?: string;
  /** 是否为一次性订阅 */
  once?: boolean;
}

/**
 * 内部订阅信息
 */
interface Subscription<T> {
  handler: EventHandler<T>;
  name?: string;
  once: boolean;
}

/**
 * 事件总线
 *
 * @example
 * ```typescript
 * const bus = new EventBus();
 *
 * // 订阅事件
 * const disposable = bus.on(EventType.QUOTA_UPDATE, (snapshot) => {
 *   console.log('配额更新:', snapshot);
 * });
 *
 * // 发布事件
 * bus.emit(EventType.QUOTA_UPDATE, quotaSnapshot);
 *
 * // 取消订阅
 * disposable.dispose();
 *
 * // 销毁总线
 * bus.dispose();
 * ```
 */
export class EventBus implements Disposable {
  /** 事件处理器映射表 */
  private readonly handlers = new Map<EventType, Set<Subscription<unknown>>>();

  /** 全局错误处理器列表 */
  private readonly errorHandlers: ErrorHandler[] = [];

  /** 事件总线是否已销毁 */
  private disposed = false;

  /**
   * 订阅事件
   *
   * @param eventType - 事件类型
   * @param handler - 事件处理器
   * @param options - 订阅选项
   * @returns 可用于取消订阅的 Disposable 对象
   */
  on<E extends EventType>(
    eventType: E,
    handler: EventHandler<EventPayloads[E]>,
    options?: SubscriptionOptions
  ): Disposable {
    this.ensureNotDisposed();

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const subscription: Subscription<EventPayloads[E]> = {
      handler,
      name: options?.name,
      once: options?.once ?? false,
    };

    this.handlers.get(eventType)!.add(subscription as Subscription<unknown>);

    return {
      dispose: () => {
        this.handlers.get(eventType)?.delete(subscription as Subscription<unknown>);
      },
    };
  }

  /**
   * 一次性订阅事件
   *
   * 事件触发后自动取消订阅。
   *
   * @param eventType - 事件类型
   * @param handler - 事件处理器
   * @param name - 处理器名称（可选）
   * @returns 可用于取消订阅的 Disposable 对象
   */
  once<E extends EventType>(
    eventType: E,
    handler: EventHandler<EventPayloads[E]>,
    name?: string
  ): Disposable {
    return this.on(eventType, handler, { name, once: true });
  }

  /**
   * 发布事件
   *
   * 同步执行所有处理器，但处理器可以是异步的。
   * 单个处理器的错误不会影响其他处理器执行。
   *
   * @param eventType - 事件类型
   * @param payload - 事件载荷
   */
  emit<E extends EventType>(eventType: E, payload: EventPayloads[E]): void {
    if (this.disposed) {
      console.warn(`[EventBus] 总线已销毁，忽略事件: ${eventType}`);
      return;
    }

    const subscriptions = this.handlers.get(eventType);
    if (!subscriptions || subscriptions.size === 0) {
      return;
    }

    // 收集需要移除的一次性订阅
    const toRemove: Subscription<unknown>[] = [];

    for (const subscription of subscriptions) {
      try {
        const result = subscription.handler(payload);

        // 处理异步处理器的错误
        if (result instanceof Promise) {
          result.catch((error) => {
            this.handleError(error as Error, eventType, subscription.name);
          });
        }

        // 标记一次性订阅
        if (subscription.once) {
          toRemove.push(subscription);
        }
      } catch (error) {
        this.handleError(error as Error, eventType, subscription.name);

        // 即使出错，一次性订阅也应被移除
        if (subscription.once) {
          toRemove.push(subscription);
        }
      }
    }

    // 移除一次性订阅
    for (const subscription of toRemove) {
      subscriptions.delete(subscription);
    }
  }

  /**
   * 异步发布事件
   *
   * 等待所有处理器执行完成（包括异步处理器）。
   * 单个处理器的错误不会影响其他处理器执行。
   *
   * @param eventType - 事件类型
   * @param payload - 事件载荷
   */
  async emitAsync<E extends EventType>(eventType: E, payload: EventPayloads[E]): Promise<void> {
    if (this.disposed) {
      console.warn(`[EventBus] 总线已销毁，忽略事件: ${eventType}`);
      return;
    }

    const subscriptions = this.handlers.get(eventType);
    if (!subscriptions || subscriptions.size === 0) {
      return;
    }

    const toRemove: Subscription<unknown>[] = [];
    const promises: Promise<void>[] = [];

    for (const subscription of subscriptions) {
      const promise = (async () => {
        try {
          await subscription.handler(payload);
        } catch (error) {
          this.handleError(error as Error, eventType, subscription.name);
        } finally {
          if (subscription.once) {
            toRemove.push(subscription);
          }
        }
      })();

      promises.push(promise);
    }

    await Promise.all(promises);

    // 移除一次性订阅
    for (const subscription of toRemove) {
      subscriptions.delete(subscription);
    }
  }

  /**
   * 注册全局错误处理器
   *
   * @param handler - 错误处理器
   * @returns 可用于注销的 Disposable 对象
   */
  onError(handler: ErrorHandler): Disposable {
    this.errorHandlers.push(handler);

    return {
      dispose: () => {
        const index = this.errorHandlers.indexOf(handler);
        if (index > -1) {
          this.errorHandlers.splice(index, 1);
        }
      },
    };
  }

  /**
   * 获取指定事件的订阅数量
   *
   * @param eventType - 事件类型
   * @returns 订阅数量
   */
  getSubscriptionCount(eventType: EventType): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  /**
   * 获取所有活跃的事件类型
   *
   * @returns 有订阅的事件类型数组
   */
  getActiveEventTypes(): EventType[] {
    const active: EventType[] = [];
    for (const [eventType, subscriptions] of this.handlers) {
      if (subscriptions.size > 0) {
        active.push(eventType);
      }
    }
    return active;
  }

  /**
   * 清除指定事件的所有订阅
   *
   * @param eventType - 事件类型
   */
  clearSubscriptions(eventType: EventType): void {
    this.handlers.get(eventType)?.clear();
  }

  /**
   * 销毁事件总线
   *
   * 清除所有订阅和错误处理器。
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.handlers.clear();
    this.errorHandlers.length = 0;
  }

  /**
   * 处理处理器错误
   */
  private handleError(error: Error, eventType: EventType, handlerName?: string): void {
    const identifier = handlerName ?? '匿名处理器';
    console.error(`[EventBus] 事件处理器错误 (${eventType}, ${identifier}):`, error);

    // 调用全局错误处理器
    for (const errorHandler of this.errorHandlers) {
      try {
        errorHandler(error, eventType, handlerName);
      } catch (e) {
        console.error('[EventBus] 错误处理器执行失败:', e);
      }
    }
  }

  /**
   * 确保总线未被销毁
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('[EventBus] 事件总线已销毁');
    }
  }
}
