"use client";

import { RefObject, useEffect, useMemo, useRef, useState } from "react";

type ProgressiveCountOptions = {
  initialCount?: number;
  step?: number;
  rootMargin?: string;
};

const DEFAULT_INITIAL_COUNT = 24;
const DEFAULT_STEP = 24;

export const useProgressiveCount = (
  total: number,
  resetKeys: unknown[],
  options: ProgressiveCountOptions = {}
): {
  visibleCount: number;
  sentinelRef: RefObject<HTMLDivElement | null>;
  hasMore: boolean;
} => {
  const initialCount = options.initialCount ?? DEFAULT_INITIAL_COUNT;
  const step = options.step ?? DEFAULT_STEP;
  const rootMargin = options.rootMargin ?? "320px 0px";
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const resetToken = useMemo(
    () => JSON.stringify(resetKeys),
    [resetKeys]
  );
  const baseVisibleCount = Math.min(total, initialCount);
  const [state, setState] = useState(() => ({
    resetToken,
    visibleCount: baseVisibleCount
  }));
  const visibleCount = state.resetToken === resetToken
    ? Math.min(total, state.visibleCount)
    : baseVisibleCount;
  const hasMore = visibleCount < total;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        setState((current) => {
          const currentVisible = current.resetToken === resetToken
            ? current.visibleCount
            : baseVisibleCount;

          return {
            resetToken,
            visibleCount: Math.min(total, currentVisible + step)
          };
        });
      },
      { rootMargin }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [baseVisibleCount, hasMore, resetToken, rootMargin, step, total, visibleCount]);

  return { visibleCount, sentinelRef, hasMore };
};
