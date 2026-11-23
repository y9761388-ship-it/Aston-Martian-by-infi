import { useCallback, useEffect, useRef, useState } from 'react';

export interface SelfCleanMetrics {
  sweepCount: number;
  lastCleanedLabel: string;
}

interface SelfCleanOptions {
  activeVideoRef: () => HTMLVideoElement | null;
  allVideoRefs: () => (HTMLVideoElement | null)[];
  shouldPlayActive: boolean;
  onAutoRefreshVideo?: () => void;
}

/**
 * Automated self-clean optimizer that prevents decoder congestion, pauses off-stage
 * media streams, recovers stalled playback, and refreshes buffers on visibility resume.
 */
export function useSelfCleanOptimizer({
  activeVideoRef,
  allVideoRefs,
  shouldPlayActive,
  onAutoRefreshVideo,
}: SelfCleanOptions) {
  const [metrics, setMetrics] = useState<SelfCleanMetrics>({
    sweepCount: 1,
    lastCleanedLabel: 'Just now',
  });

  const lastProgressTimeRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const shouldPlayRef = useRef(shouldPlayActive);
  shouldPlayRef.current = shouldPlayActive;

  const runCleanSweep = useCallback(
    (forceRecover = false) => {
      const active = activeVideoRef();
      const videos = allVideoRefs();

      for (const v of videos) {
        if (!v) continue;
        if (v !== active) {
          if (!v.paused) {
            v.pause();
          }
        }
      }

      if (active && shouldPlayRef.current) {
        if (active.paused && active.readyState >= 2) {
          active.play().catch(() => {});
        } else if (forceRecover && active.readyState < 2) {
          onAutoRefreshVideo?.();
        }
      }

      const now = new Date();
      const label = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setMetrics((prev) => ({
        sweepCount: prev.sweepCount + 1,
        lastCleanedLabel: label,
      }));
    },
    [activeVideoRef, allVideoRefs, onAutoRefreshVideo]
  );

  // Automatic periodic self-clean & stall-recovery cycle
  useEffect(() => {
    lastProgressTimeRef.current = performance.now();

    const intervalId = window.setInterval(() => {
      const active = activeVideoRef();
      let stalled = false;

      if (active && shouldPlayRef.current && !active.paused) {
        const cur = active.currentTime;
        if (Math.abs(cur - lastVideoTimeRef.current) < 0.001) {
          if (performance.now() - lastProgressTimeRef.current > 2500) {
            stalled = true;
          }
        } else {
          lastVideoTimeRef.current = cur;
          lastProgressTimeRef.current = performance.now();
        }
      }

      if (stalled && active) {
        const t = active.currentTime;
        active.currentTime = Math.max(0, t);
        active.play().catch(() => {});
      }

      runCleanSweep(stalled);
    }, 12000);

    return () => window.clearInterval(intervalId);
  }, [activeVideoRef, runCleanSweep]);

  // Auto-pause hidden decoders & refresh active stream when user returns
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        for (const v of allVideoRefs()) {
          if (v && !v.paused) v.pause();
        }
      } else {
        runCleanSweep(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [allVideoRefs, runCleanSweep]);

  return {
    metrics,
    runCleanSweep,
  };
}
