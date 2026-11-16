import { describe, expect, it } from 'vitest';
import { createSerialQueue } from './serial';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('createSerialQueue', () => {
  it('exécute les actions l’une après l’autre, dans l’ordre', async () => {
    const run = createSerialQueue();
    const log: string[] = [];
    const first = deferred();
    const a = run(async () => {
      log.push('a:début');
      await first.promise;
      log.push('a:fin');
      return 'A';
    });
    const b = run(async () => {
      log.push('b:début');
      return 'B';
    });
    await Promise.resolve();
    expect(log).toEqual(['a:début']);
    first.resolve();
    expect(await a).toBe('A');
    expect(await b).toBe('B');
    expect(log).toEqual(['a:début', 'a:fin', 'b:début']);
  });

  it('une action en échec rejette sa promesse sans bloquer la suivante', async () => {
    const run = createSerialQueue();
    const failing = run(async () => {
      throw new Error('raté');
    });
    const next = run(async () => 'ok');
    await expect(failing).rejects.toThrow('raté');
    expect(await next).toBe('ok');
  });
});
