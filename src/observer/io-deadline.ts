/** A single locked/unresponsive transcript must not stop every live room. */
export function ioDeadline<T>(work: Promise<T>, timeoutMs = 1500, disposeLate?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(Object.assign(new Error('Source I/O timed out'), { code: 'ETIMEDOUT' }));
    }, timeoutMs);
    work.then(value => {
      clearTimeout(timer);
      if (expired) { disposeLate?.(value); return; }
      resolve(value);
    }, error => {
      clearTimeout(timer);
      if (!expired) reject(error);
    });
  });
}
