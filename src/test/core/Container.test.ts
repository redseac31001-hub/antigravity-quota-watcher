/**
 * Container 单元测试
 */

import * as assert from 'assert';
import { Container, Lifecycle } from '../../core/container/Container';

suite('Container 测试套件', () => {
  let container: Container;

  setup(() => {
    container = new Container();
  });

  teardown(() => {
    container.dispose();
  });

  suite('服务注册', () => {
    test('应该能够注册服务', () => {
      const id = Symbol.for('TestService');
      container.register(id, () => ({ name: 'test' }));

      assert.strictEqual(container.has(id), true);
    });

    test('应该能够覆盖已注册的服务', () => {
      const id = Symbol.for('TestService');
      container.register(id, () => ({ value: 1 }));
      container.register(id, () => ({ value: 2 }));

      const service = container.resolve<{ value: number }>(id);
      assert.strictEqual(service.value, 2);
    });
  });

  suite('单例生命周期', () => {
    test('单例模式应该返回相同的实例', () => {
      const id = Symbol.for('SingletonService');
      let instanceCount = 0;

      container.register(id, () => {
        instanceCount++;
        return { id: instanceCount };
      }, Lifecycle.Singleton);

      const instance1 = container.resolve(id);
      const instance2 = container.resolve(id);

      assert.strictEqual(instance1, instance2);
      assert.strictEqual(instanceCount, 1);
    });

    test('默认应该使用单例模式', () => {
      const id = Symbol.for('DefaultService');
      let instanceCount = 0;

      container.register(id, () => {
        instanceCount++;
        return { id: instanceCount };
      });

      container.resolve(id);
      container.resolve(id);

      assert.strictEqual(instanceCount, 1);
    });
  });

  suite('瞬态生命周期', () => {
    test('瞬态模式应该每次返回新实例', () => {
      const id = Symbol.for('TransientService');
      let instanceCount = 0;

      container.register(id, () => {
        instanceCount++;
        return { id: instanceCount };
      }, Lifecycle.Transient);

      const instance1 = container.resolve<{ id: number }>(id);
      const instance2 = container.resolve<{ id: number }>(id);

      assert.notStrictEqual(instance1, instance2);
      assert.strictEqual(instance1.id, 1);
      assert.strictEqual(instance2.id, 2);
    });
  });

  suite('依赖解析', () => {
    test('应该能够解析带依赖的服务', () => {
      const configId = Symbol.for('Config');
      const serviceId = Symbol.for('Service');

      container.register(configId, () => ({ apiUrl: 'http://test.com' }));
      container.register(serviceId, (c) => {
        const config = c.resolve<{ apiUrl: string }>(configId);
        return { config };
      });

      const service = container.resolve<{ config: { apiUrl: string } }>(serviceId);
      assert.strictEqual(service.config.apiUrl, 'http://test.com');
    });

    test('未注册的服务应该抛出错误', () => {
      const id = Symbol.for('NonExistentService');

      assert.throws(
        () => container.resolve(id),
        /服务未注册/
      );
    });
  });

  suite('循环依赖检测', () => {
    test('应该检测直接循环依赖', () => {
      const serviceA = Symbol.for('ServiceA');
      const serviceB = Symbol.for('ServiceB');

      container.register(serviceA, (c) => {
        return { b: c.resolve(serviceB) };
      });
      container.register(serviceB, (c) => {
        return { a: c.resolve(serviceA) };
      });

      assert.throws(
        () => container.resolve(serviceA),
        /循环依赖/
      );
    });

    test('应该检测间接循环依赖', () => {
      const serviceA = Symbol.for('ServiceA');
      const serviceB = Symbol.for('ServiceB');
      const serviceC = Symbol.for('ServiceC');

      container.register(serviceA, (c) => ({ b: c.resolve(serviceB) }));
      container.register(serviceB, (c) => ({ c: c.resolve(serviceC) }));
      container.register(serviceC, (c) => ({ a: c.resolve(serviceA) }));

      assert.throws(
        () => container.resolve(serviceA),
        /循环依赖/
      );
    });
  });

  suite('tryResolve 方法', () => {
    test('已注册的服务应该返回实例', () => {
      const id = Symbol.for('TestService');
      container.register(id, () => ({ name: 'test' }));

      const service = container.tryResolve<{ name: string }>(id);
      assert.notStrictEqual(service, undefined);
      assert.strictEqual(service?.name, 'test');
    });

    test('未注册的服务应该返回 undefined', () => {
      const id = Symbol.for('NonExistentService');

      const service = container.tryResolve(id);
      assert.strictEqual(service, undefined);
    });
  });

  suite('容器销毁', () => {
    test('应该销毁所有可销毁的实例', () => {
      const id = Symbol.for('DisposableService');
      let disposed = false;

      container.register(id, () => ({
        dispose: () => { disposed = true; }
      }));

      container.resolve(id);
      container.dispose();

      assert.strictEqual(disposed, true);
    });

    test('销毁后不应该能够注册服务', () => {
      container.dispose();

      const id = Symbol.for('TestService');
      assert.throws(
        () => container.register(id, () => ({})),
        /容器已销毁/
      );
    });

    test('销毁后不应该能够解析服务', () => {
      const id = Symbol.for('TestService');
      container.register(id, () => ({}));
      container.resolve(id);

      container.dispose();

      assert.throws(
        () => container.resolve(id),
        /容器已销毁/
      );
    });

    test('重复销毁应该安全', () => {
      container.dispose();
      container.dispose(); // 不应该抛出错误
    });
  });

  suite('getRegisteredServices 方法', () => {
    test('应该返回所有已注册的服务标识符', () => {
      const id1 = Symbol.for('Service1');
      const id2 = Symbol.for('Service2');

      container.register(id1, () => ({}));
      container.register(id2, () => ({}));

      const services = container.getRegisteredServices();
      assert.strictEqual(services.length, 2);
      assert.ok(services.includes(id1));
      assert.ok(services.includes(id2));
    });
  });
});
