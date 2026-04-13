import { useCallback, useRef } from 'react';

interface BatchItem<T> {
  id: string;
  data: T;
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

export const useBatchProcessor = <T, R>(
  processor: (items: T[]) => Promise<R[]>,
  delay: number = 100
) => {
  const batchRef = useRef<BatchItem<T>[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processBatch = useCallback(async () => {
    if (batchRef.current.length === 0) return;

    const batch = [...batchRef.current];
    batchRef.current = [];

    try {
      const results = await processor(batch.map((item) => item.data));
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach((item) => {
        item.reject(error);
      });
    }
  }, [processor]);

  const addToBatch = useCallback(
    (id: string, data: T): Promise<R> => {
      return new Promise((resolve, reject) => {
        batchRef.current.push({ id, data, resolve, reject });

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(processBatch, delay);
      });
    },
    [processBatch, delay]
  );

  return { addToBatch };
};
