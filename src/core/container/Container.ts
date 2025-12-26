/**
 * 轻量级依赖注入容器
 *
 * 提供服务注册、解析和生命周期管理功能。
 * 支持单例和瞬态两种生命周期模式。
 */

import type { Disposable } from 'vscode';

/**
 * 服务生命周期枚举
 */
export enum Lifecycle {
  /** 单例模式：整个容器生命周期内只创建一个实例 */
  Singleton = 'singleton',
  /** 瞬态模式：每次解析都创建新实例 */
  Transient = 'transient',
}

/**
 * 服务工厂函数类型
 */
export type ServiceFactory<T> = (container: Container) => T;

/**
 * 服务注册信息
 */
interface ServiceRegistration<T> {
  factory: ServiceFactory<T>;
  lifecycle: Lifecycle;
  instance?: T;
}

/**
 * 可销毁对象接口
 */
interface IDisposable {
  dispose(): void;
}

/**
 * 检查对象是否可销毁
 */
function isDisposable(obj: unknown): obj is IDisposable {
  return obj !== null &&
         typeof obj === 'object' &&
         typeof (obj as IDisposable).dispose === 'function';
}

/**
 * 依赖注入容器
 *
 * @example
 * ```typescript
 * const container = new Container();
 *
 * // 注册单例服务
 * container.register(TYPES.ConfigService, (c) => new ConfigService());
 *
 * // 注册带依赖的服务
 * container.register(TYPES.QuotaService, (c) =>
 *   new QuotaService(c.resolve(TYPES.ConfigService))
 * );
 *
 * // 解析服务
 * const quota = container.resolve<IQuotaService>(TYPES.QuotaService);
 *
 * // 销毁容器
 * container.dispose();
 * ```
 */
export class Container implements Disposable {
  /** 服务注册表 */
  private readonly services = new Map<symbol, ServiceRegistration<unknown>>();

  /** 正在解析的服务集合，用于检测循环依赖 */
  private readonly resolving = new Set<symbol>();

  /** 容器是否已销毁 */
  private disposed = false;

  /**
   * 注册服务
   *
   * @param identifier - 服务标识符（Symbol）
   * @param factory - 服务工厂函数
   * @param lifecycle - 生命周期（默认单例）
   * @throws Error 如果容器已销毁或标识符已注册
   */
  register<T>(
    identifier: symbol,
    factory: ServiceFactory<T>,
    lifecycle: Lifecycle = Lifecycle.Singleton
  ): void {
    this.ensureNotDisposed();

    if (this.services.has(identifier)) {
      console.warn(`[Container] 服务已注册，将被覆盖: ${identifier.toString()}`);
    }

    this.services.set(identifier, { factory, lifecycle });
  }

  /**
   * 解析服务实例
   *
   * @param identifier - 服务标识符
   * @returns 服务实例
   * @throws Error 如果服务未注册、检测到循环依赖或容器已销毁
   */
  resolve<T>(identifier: symbol): T {
    this.ensureNotDisposed();

    const registration = this.services.get(identifier);
    if (!registration) {
      throw new Error(`[Container] 服务未注册: ${identifier.toString()}`);
    }

    // 检测循环依赖
    if (this.resolving.has(identifier)) {
      const chain = [...this.resolving, identifier]
        .map(s => s.toString())
        .join(' -> ');
      throw new Error(`[Container] 检测到循环依赖: ${chain}`);
    }

    // 单例模式返回缓存实例
    if (registration.lifecycle === Lifecycle.Singleton && registration.instance !== undefined) {
      return registration.instance as T;
    }

    // 标记正在解析
    this.resolving.add(identifier);

    try {
      const instance = registration.factory(this) as T;

      // 缓存单例实例
      if (registration.lifecycle === Lifecycle.Singleton) {
        registration.instance = instance;
      }

      return instance;
    } finally {
      this.resolving.delete(identifier);
    }
  }

  /**
   * 尝试解析服务，如果未注册返回 undefined
   *
   * @param identifier - 服务标识符
   * @returns 服务实例或 undefined
   */
  tryResolve<T>(identifier: symbol): T | undefined {
    if (!this.services.has(identifier)) {
      return undefined;
    }
    return this.resolve<T>(identifier);
  }

  /**
   * 检查服务是否已注册
   *
   * @param identifier - 服务标识符
   * @returns 是否已注册
   */
  has(identifier: symbol): boolean {
    return this.services.has(identifier);
  }

  /**
   * 获取所有已注册的服务标识符
   *
   * @returns 服务标识符数组
   */
  getRegisteredServices(): symbol[] {
    return [...this.services.keys()];
  }

  /**
   * 销毁容器及所有单例实例
   *
   * 按注册顺序的逆序销毁服务实例。
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // 收集所有需要销毁的实例（按注册顺序的逆序）
    const instancesToDispose: IDisposable[] = [];

    for (const registration of this.services.values()) {
      if (registration.instance !== undefined && isDisposable(registration.instance)) {
        instancesToDispose.push(registration.instance);
      }
    }

    // 逆序销毁
    for (let i = instancesToDispose.length - 1; i >= 0; i--) {
      try {
        instancesToDispose[i].dispose();
      } catch (error) {
        console.error('[Container] 销毁服务时发生错误:', error);
      }
    }

    this.services.clear();
    this.resolving.clear();
  }

  /**
   * 确保容器未被销毁
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('[Container] 容器已销毁');
    }
  }
}
