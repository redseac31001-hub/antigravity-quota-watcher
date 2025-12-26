/**
 * EventBus 单元测试
 */

import * as assert from 'assert';
import { EventBus } from '../../core/events/EventBus';
import { EventType } from '../../core/events/events';

suite('EventBus 测试套件', () => {
  let eventBus: EventBus;

  setup(() => {
    eventBus = new EventBus();
  });

  teardown(() => {
    eventBus.dispose();
  });

  suite('事件订阅', () => {
    test('应该能够订阅事件', () => {
      let received = false;

      eventBus.on(EventType.QUOTA_FETCH_START, () => {
        received = true;
      });

      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);
      assert.strictEqual(received, true);
    });

    test('应该能够订阅多个处理器', () => {
      let count = 0;

      eventBus.on(EventType.QUOTA_FETCH_START, () => { count++; });
      eventBus.on(EventType.QUOTA_FETCH_START, () => { count++; });

      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);
      assert.strictEqual(count, 2);
    });

    test('应该能够接收事件载荷', () => {
      let receivedPayload: { attempt: number; maxAttempts: number } | null = null;

      eventBus.on(EventType.QUOTA_RETRY, (payload) => {
        receivedPayload = payload;
      });

      const testPayload = { attempt: 1, maxAttempts: 3 };
      eventBus.emit(EventType.QUOTA_RETRY, testPayload);

      assert.deepStrictEqual(receivedPayload, testPayload);
    });
  });

  suite('事件取消订阅', () => {
    test('dispose 应该取消订阅', () => {
      let count = 0;

      const subscription = eventBus.on(EventType.QUOTA_FETCH_START, () => {
        count++;
      });

      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);
      subscription.dispose();
      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);

      assert.strictEqual(count, 1);
    });

    test('多次 dispose 应该安全', () => {
      const subscription = eventBus.on(EventType.QUOTA_FETCH_START, () => {});

      subscription.dispose();
      subscription.dispose(); // 不应该抛出错误
    });
  });

  suite('一次性订阅', () => {
    test('once 应该只触发一次', () => {
      let count = 0;

      eventBus.once(EventType.QUOTA_FETCH_START, () => {
        count++;
      });

      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);
      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);

      assert.strictEqual(count, 1);
    });

    test('once 即使出错也应该只触发一次', () => {
      let count = 0;

      eventBus.once(EventType.QUOTA_FETCH_START, () => {
        count++;
        throw new Error('测试错误');
      });

      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);
      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);

      assert.strictEqual(count, 1);
    });
  });

  suite('错误隔离', () => {
    test('单个处理器错误不应该影响其他处理器', () => {
      let handler1Called = false;
      let handler2Called = false;

      eventBus.on(EventType.QUOTA_FETCH_START, () => {
        handler1Called = true;
        throw new Error('测试错误');
      });

      eventBus.on(EventType.QUOTA_FETCH_START, () => {
        handler2Called = true;
      });

      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);

      assert.strictEqual(handler1Called, true);
      assert.strictEqual(handler2Called, true);
    });

    test('全局错误处理器应该被调用', () => {
      let errorReceived: Error | null = null;
      let eventTypeReceived: EventType | null = null;

      eventBus.onError((error, eventType) => {
        errorReceived = error;
        eventTypeReceived = eventType;
      });

      eventBus.on(EventType.QUOTA_FETCH_START, () => {
        throw new Error('测试错误');
      });

      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);

      assert.notStrictEqual(errorReceived, null);
      assert.strictEqual(errorReceived?.message, '测试错误');
      assert.strictEqual(eventTypeReceived, EventType.QUOTA_FETCH_START);
    });

    test('全局错误处理器可以取消订阅', () => {
      let errorCount = 0;

      const subscription = eventBus.onError(() => {
        errorCount++;
      });

      eventBus.on(EventType.QUOTA_FETCH_START, () => {
        throw new Error('测试错误');
      });

      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);
      subscription.dispose();
      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);

      assert.strictEqual(errorCount, 1);
    });
  });

  suite('异步处理器', () => {
    test('emitAsync 应该等待所有异步处理器', async () => {
      const results: number[] = [];

      eventBus.on(EventType.QUOTA_FETCH_START, async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(1);
      });

      eventBus.on(EventType.QUOTA_FETCH_START, async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        results.push(2);
      });

      await eventBus.emitAsync(EventType.QUOTA_FETCH_START, undefined);

      assert.strictEqual(results.length, 2);
      assert.ok(results.includes(1));
      assert.ok(results.includes(2));
    });

    test('异步处理器错误不应该影响其他处理器', async () => {
      let handler2Called = false;

      eventBus.on(EventType.QUOTA_FETCH_START, async () => {
        throw new Error('异步错误');
      });

      eventBus.on(EventType.QUOTA_FETCH_START, async () => {
        handler2Called = true;
      });

      await eventBus.emitAsync(EventType.QUOTA_FETCH_START, undefined);

      assert.strictEqual(handler2Called, true);
    });
  });

  suite('事件总线状态', () => {
    test('getSubscriptionCount 应该返回正确的订阅数', () => {
      eventBus.on(EventType.QUOTA_FETCH_START, () => {});
      eventBus.on(EventType.QUOTA_FETCH_START, () => {});
      eventBus.on(EventType.QUOTA_RETRY, () => {});

      assert.strictEqual(eventBus.getSubscriptionCount(EventType.QUOTA_FETCH_START), 2);
      assert.strictEqual(eventBus.getSubscriptionCount(EventType.QUOTA_RETRY), 1);
      assert.strictEqual(eventBus.getSubscriptionCount(EventType.CONFIG_CHANGE), 0);
    });

    test('getActiveEventTypes 应该返回有订阅的事件类型', () => {
      eventBus.on(EventType.QUOTA_FETCH_START, () => {});
      eventBus.on(EventType.QUOTA_RETRY, () => {});

      const activeTypes = eventBus.getActiveEventTypes();

      assert.strictEqual(activeTypes.length, 2);
      assert.ok(activeTypes.includes(EventType.QUOTA_FETCH_START));
      assert.ok(activeTypes.includes(EventType.QUOTA_RETRY));
    });

    test('clearSubscriptions 应该清除指定事件的所有订阅', () => {
      eventBus.on(EventType.QUOTA_FETCH_START, () => {});
      eventBus.on(EventType.QUOTA_FETCH_START, () => {});
      eventBus.on(EventType.QUOTA_RETRY, () => {});

      eventBus.clearSubscriptions(EventType.QUOTA_FETCH_START);

      assert.strictEqual(eventBus.getSubscriptionCount(EventType.QUOTA_FETCH_START), 0);
      assert.strictEqual(eventBus.getSubscriptionCount(EventType.QUOTA_RETRY), 1);
    });
  });

  suite('事件总线销毁', () => {
    test('销毁后 emit 应该被忽略', () => {
      let count = 0;

      eventBus.on(EventType.QUOTA_FETCH_START, () => {
        count++;
      });

      eventBus.dispose();
      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);

      assert.strictEqual(count, 0);
    });

    test('销毁后不应该能够订阅', () => {
      eventBus.dispose();

      assert.throws(
        () => eventBus.on(EventType.QUOTA_FETCH_START, () => {}),
        /事件总线已销毁/
      );
    });

    test('重复销毁应该安全', () => {
      eventBus.dispose();
      eventBus.dispose(); // 不应该抛出错误
    });
  });

  suite('命名处理器', () => {
    test('处理器名称应该出现在错误报告中', () => {
      let handlerName: string | undefined;

      eventBus.onError((_, __, name) => {
        handlerName = name;
      });

      eventBus.on(EventType.QUOTA_FETCH_START, () => {
        throw new Error('测试错误');
      }, { name: 'TestHandler' });

      eventBus.emit(EventType.QUOTA_FETCH_START, undefined);

      assert.strictEqual(handlerName, 'TestHandler');
    });
  });
});
