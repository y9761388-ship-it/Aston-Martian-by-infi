import { useCallback, useEffect, useRef, useState } from 'react';
import { MinimalTopControls } from './components/MinimalTopControls';
import { useSelfCleanOptimizer } from './utils/selfCleanOptimizer';
import { getDeviceViewportSpec, type DeviceViewportSpec } from './utils/viewport';

type SlotId = '1' | '1.1_fwd' | '1.1_rev' | '2' | '2.1_fwd' | '2.1_rev' | '3';

function waitOnePaintedFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const rVFC = (
      video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
      }
    ).requestVideoFrameCallback;

    if (typeof rVFC === 'function') {
      rVFC.call(video, () => done());
      window.setTimeout(done, 80);
    } else {
      requestAnimationFrame(() => requestAnimationFrame(done));
    }
  });
}

function ensureVideoSource(video: HTMLVideoElement | null, src: string) {
  if (!video) return;
  if (video.getAttribute('data-src') === src) return;
  video.setAttribute('data-src', src);
  video.src = src;
  video.load();
}

function waitUntilReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      video.removeEventListener('canplay', finish);
      video.removeEventListener('loadeddata', finish);
      resolve();
    };
    video.addEventListener('canplay', finish, { once: true });
    video.addEventListener('loadeddata', finish, { once: true });
    window.setTimeout(finish, 1500);
  });
}

export default function App() {
  const loop1Ref = useRef<HTMLVideoElement>(null);
  const loop2Ref = useRef<HTMLVideoElement>(null);
  const loop3Ref = useRef<HTMLVideoElement>(null);
  const transFwdRef = useRef<HTMLVideoElement>(null);
  const transRevRef = useRef<HTMLVideoElement>(null);

  const [viewportSpec, setViewportSpec] = useState<DeviceViewportSpec>(() =>
    getDeviceViewportSpec(window.innerWidth, window.innerHeight)
  );
  const viewportSpecRef = useRef(viewportSpec);

  const [activeSlot, setActiveSlot] = useState<SlotId>('1');
  const [backplateSlot, setBackplateSlot] = useState<SlotId | null>(null);
  const activeSlotRef = useRef<SlotId>('1');

  const switchingRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const prewarmedNextLoopRef = useRef(false);
  const backplateTimerRef = useRef<number | null>(null);

  const getVideoForSlot = useCallback((slot: SlotId): HTMLVideoElement | null => {
    switch (slot) {
      case '1':
        return loop1Ref.current;
      case '2':
        return loop2Ref.current;
      case '3':
        return loop3Ref.current;
      case '1.1_fwd':
      case '2.1_fwd':
        return transFwdRef.current;
      case '1.1_rev':
      case '2.1_rev':
        return transRevRef.current;
    }
  }, []);

  const getActiveVideo = useCallback(
    () => getVideoForSlot(activeSlotRef.current),
    [getVideoForSlot]
  );

  const getAllVideos = useCallback(
    () => [
      loop1Ref.current,
      loop2Ref.current,
      loop3Ref.current,
      transFwdRef.current,
      transRevRef.current,
    ],
    []
  );

  // Pre-stage adjacent transition clips cleanly so next scroll starts instantly
  const stageNeighborsForLoop = useCallback((loopSlot: '1' | '2' | '3', variant: string) => {
    if (loopSlot === '1') {
      ensureVideoSource(transFwdRef.current, `/videos/1_1_${variant}.mp4`);
      if (transFwdRef.current) {
        transFwdRef.current.pause();
        transFwdRef.current.currentTime = 0;
      }
    } else if (loopSlot === '2') {
      ensureVideoSource(transFwdRef.current, `/videos/2_1_${variant}.mp4`);
      if (transFwdRef.current) {
        transFwdRef.current.pause();
        transFwdRef.current.currentTime = 0;
      }
      ensureVideoSource(transRevRef.current, `/videos/1_1_${variant}_rev.mp4`);
      if (transRevRef.current) {
        transRevRef.current.pause();
        transRevRef.current.currentTime = 0;
      }
    } else {
      ensureVideoSource(transRevRef.current, `/videos/2_1_${variant}_rev.mp4`);
      if (transRevRef.current) {
        transRevRef.current.pause();
        transRevRef.current.currentTime = 0;
      }
    }
  }, []);

  const refreshActiveStream = useCallback(() => {
    const slot = activeSlotRef.current;
    const active = getVideoForSlot(slot);
    if (!active) return;
    const cur = active.currentTime;
    if (active.readyState >= 2) {
      active.currentTime = cur;
      active.play().catch(() => {});
      return;
    }
    const restoreTime = () => {
      if (cur > 0 && Number.isFinite(active.duration)) {
        active.currentTime = Math.min(cur, Math.max(0, active.duration - 0.1));
      }
      active.play().catch(() => {});
    };
    active.addEventListener('loadedmetadata', restoreTime, { once: true });
    active.load();
  }, [getVideoForSlot]);

  const { runCleanSweep } = useSelfCleanOptimizer({
    activeVideoRef: getActiveVideo,
    allVideoRefs: getAllVideos,
    shouldPlayActive: true,
    onAutoRefreshVideo: refreshActiveStream,
  });

  // Responsive device detection & equal zoom across all devices/orientations
  useEffect(() => {
    const handleResize = () => {
      const next = getDeviceViewportSpec(window.innerWidth, window.innerHeight);
      viewportSpecRef.current = next;
      setViewportSpec((prev) =>
        prev.variant === next.variant &&
        prev.deviceClass === next.deviceClass &&
        prev.zoom === next.zoom
          ? prev
          : next
      );
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Load orientation-matched videos & warm browser cache silently in background
  useEffect(() => {
    const variant = viewportSpec.variant;
    const controller = new AbortController();

    ensureVideoSource(loop1Ref.current, `/videos/1_${variant}.mp4`);
    ensureVideoSource(loop2Ref.current, `/videos/2_${variant}.mp4`);
    ensureVideoSource(loop3Ref.current, `/videos/3_${variant}.mp4`);

    const slot = activeSlotRef.current;
    if (slot === '1' || slot === '2' || slot === '3') {
      stageNeighborsForLoop(slot, variant);
    } else if (slot === '1.1_fwd' || slot === '1.1_rev') {
      ensureVideoSource(transFwdRef.current, `/videos/1_1_${variant}.mp4`);
      ensureVideoSource(transRevRef.current, `/videos/1_1_${variant}_rev.mp4`);
    } else {
      ensureVideoSource(transFwdRef.current, `/videos/2_1_${variant}.mp4`);
      ensureVideoSource(transRevRef.current, `/videos/2_1_${variant}_rev.mp4`);
    }

    const active = getVideoForSlot(slot);
    if (active) {
      active.play().catch(() => {});
    }

    // Background-warm transition clips into HTTP cache so zero network stutter occurs
    const warmUrls = [
      `/videos/1_1_${variant}.mp4`,
      `/videos/2_${variant}.mp4`,
      `/videos/2_1_${variant}.mp4`,
      `/videos/3_${variant}.mp4`,
      `/videos/1_1_${variant}_rev.mp4`,
      `/videos/2_1_${variant}_rev.mp4`,
    ];

    (async () => {
      for (const url of warmUrls) {
        if (controller.signal.aborted) break;
        try {
          await fetch(url, { signal: controller.signal, priority: 'low' as RequestPriority });
        } catch {
          // ignore prefetch aborts
        }
      }
    })();

    return () => controller.abort();
  }, [viewportSpec.variant, getVideoForSlot, stageNeighborsForLoop]);

  // Zero-flash continuous handoff using an opaque backplate layer behind the promoted video
  const swapToSlot = useCallback(
    async (targetSlot: SlotId, startTime = 0) => {
      if (switchingRef.current) return;
      switchingRef.current = true;
      prewarmedNextLoopRef.current = false;

      if (backplateTimerRef.current !== null) {
        window.clearTimeout(backplateTimerRef.current);
        backplateTimerRef.current = null;
      }

      try {
        const variant = viewportSpecRef.current.variant;
        const targetVideo = getVideoForSlot(targetSlot);
        if (!targetVideo) return;

        if (targetSlot === '1.1_fwd') {
          ensureVideoSource(targetVideo, `/videos/1_1_${variant}.mp4`);
        } else if (targetSlot === '1.1_rev') {
          ensureVideoSource(targetVideo, `/videos/1_1_${variant}_rev.mp4`);
        } else if (targetSlot === '2.1_fwd') {
          ensureVideoSource(targetVideo, `/videos/2_1_${variant}.mp4`);
        } else if (targetSlot === '2.1_rev') {
          ensureVideoSource(targetVideo, `/videos/2_1_${variant}_rev.mp4`);
        }

        await waitUntilReady(targetVideo);

        if (Math.abs(targetVideo.currentTime - startTime) > 0.05) {
          targetVideo.currentTime = startTime;
        }

        try {
          await targetVideo.play();
        } catch {
          // Autoplay fallback
        }
        await waitOnePaintedFrame(targetVideo);

        const prevSlot = activeSlotRef.current;
        const prevVideo = getVideoForSlot(prevSlot);
        const isLoop = targetSlot === '1' || targetSlot === '2' || targetSlot === '3';

        // Keep prevSlot visible directly behind targetSlot for 140ms so no white background flash ever appears
        if (prevSlot !== targetSlot) {
          setBackplateSlot(prevSlot);
        }
        activeSlotRef.current = targetSlot;
        setActiveSlot(targetSlot);

        backplateTimerRef.current = window.setTimeout(() => {
          setBackplateSlot(null);
          if (prevVideo && prevVideo !== targetVideo) {
            prevVideo.pause();
          }
          if (isLoop) {
            stageNeighborsForLoop(targetSlot, variant);
            runCleanSweep(false);
          }
          backplateTimerRef.current = null;
        }, 140);

        if (isLoop) {
          cooldownUntilRef.current = performance.now() + 450;
        }
      } finally {
        switchingRef.current = false;
      }
    },
    [getVideoForSlot, stageNeighborsForLoop, runCleanSweep]
  );

  // Trigger forward scroll (1 -> 1.1 -> 2 -> 2.1 -> 3)
  const triggerScrollDown = useCallback(() => {
    if (switchingRef.current) return;
    if (performance.now() < cooldownUntilRef.current) return;

    const slot = activeSlotRef.current;
    if (slot === '1') {
      void swapToSlot('1.1_fwd', 0);
    } else if (slot === '2') {
      void swapToSlot('2.1_fwd', 0);
    } else if (slot === '1.1_rev') {
      const rev = transRevRef.current;
      const startT =
        rev && Number.isFinite(rev.duration) && rev.duration > 0
          ? Math.max(0, rev.duration - rev.currentTime)
          : 0;
      void swapToSlot('1.1_fwd', startT);
    } else if (slot === '2.1_rev') {
      const rev = transRevRef.current;
      const startT =
        rev && Number.isFinite(rev.duration) && rev.duration > 0
          ? Math.max(0, rev.duration - rev.currentTime)
          : 0;
      void swapToSlot('2.1_fwd', startT);
    }
  }, [swapToSlot]);

  // Trigger backward scroll (3 -> 2.1 rev -> 2 -> 1.1 rev -> 1)
  const triggerScrollUp = useCallback(() => {
    if (switchingRef.current) return;
    if (performance.now() < cooldownUntilRef.current) return;

    const slot = activeSlotRef.current;
    if (slot === '3') {
      void swapToSlot('2.1_rev', 0);
    } else if (slot === '2') {
      void swapToSlot('1.1_rev', 0);
    } else if (slot === '1.1_fwd') {
      const fwd = transFwdRef.current;
      const startT =
        fwd && Number.isFinite(fwd.duration) && fwd.duration > 0
          ? Math.max(0, fwd.duration - fwd.currentTime)
          : 0;
      void swapToSlot('1.1_rev', startT);
    } else if (slot === '2.1_fwd') {
      const fwd = transFwdRef.current;
      const startT =
        fwd && Number.isFinite(fwd.duration) && fwd.duration > 0
          ? Math.max(0, fwd.duration - fwd.currentTime)
          : 0;
      void swapToSlot('2.1_rev', startT);
    }
  }, [swapToSlot]);

  // Transition video timeupdate & ended handlers for seamless zero-flash handoff
  useEffect(() => {
    const fwd = transFwdRef.current;
    const rev = transRevRef.current;
    if (!fwd || !rev) return;

    const handleTimeUpdate = (el: HTMLVideoElement, nextLoop: '1' | '2' | '3') => {
      if (!Number.isFinite(el.duration) || el.duration <= 0) return;
      const remaining = el.duration - el.currentTime;
      if (!prewarmedNextLoopRef.current && remaining <= 0.35) {
        prewarmedNextLoopRef.current = true;
        const nextVideo = getVideoForSlot(nextLoop);
        if (nextVideo) {
          nextVideo.currentTime = 0;
          nextVideo.play().catch(() => {});
        }
      }
      if (remaining <= 0.06 && !switchingRef.current) {
        void swapToSlot(nextLoop, 0);
      }
    };

    const onFwdTime = () => {
      const slot = activeSlotRef.current;
      if (slot === '1.1_fwd') handleTimeUpdate(fwd, '2');
      else if (slot === '2.1_fwd') handleTimeUpdate(fwd, '3');
    };

    const onRevTime = () => {
      const slot = activeSlotRef.current;
      if (slot === '1.1_rev') handleTimeUpdate(rev, '1');
      else if (slot === '2.1_rev') handleTimeUpdate(rev, '2');
    };

    const onFwdEnded = () => {
      const slot = activeSlotRef.current;
      if (slot === '1.1_fwd') void swapToSlot('2', 0);
      else if (slot === '2.1_fwd') void swapToSlot('3', 0);
    };

    const onRevEnded = () => {
      const slot = activeSlotRef.current;
      if (slot === '1.1_rev') void swapToSlot('1', 0);
      else if (slot === '2.1_rev') void swapToSlot('2', 0);
    };

    fwd.addEventListener('timeupdate', onFwdTime);
    fwd.addEventListener('ended', onFwdEnded);
    rev.addEventListener('timeupdate', onRevTime);
    rev.addEventListener('ended', onRevEnded);

    return () => {
      fwd.removeEventListener('timeupdate', onFwdTime);
      fwd.removeEventListener('ended', onFwdEnded);
      rev.removeEventListener('timeupdate', onRevTime);
      rev.removeEventListener('ended', onRevEnded);
    };
  }, [getVideoForSlot, swapToSlot]);

  // Unified Wheel, Touch Swipe, and Keyboard listeners across desktop, tablet & mobile
  useEffect(() => {
    let lastWheelAbs = 0;
    let wheelReadyForNewGesture = true;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[role="dialog"], [role="menu"]')) return;

      e.preventDefault();
      const absY = Math.abs(e.deltaY);

      if (absY < 8) {
        wheelReadyForNewGesture = true;
        lastWheelAbs = absY;
        return;
      }

      const isSpike = absY > lastWheelAbs * 1.8 && absY > 18;
      lastWheelAbs = absY;

      if (!wheelReadyForNewGesture && !isSpike) return;

      if (e.deltaY > 10) {
        wheelReadyForNewGesture = false;
        triggerScrollDown();
      } else if (e.deltaY < -10) {
        wheelReadyForNewGesture = false;
        triggerScrollUp();
      }
    };

    let touchStartY = 0;
    let touchTriggered = false;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, [role="dialog"], [role="menu"]')) return;
      if (e.touches.length !== 1) return;
      touchStartY = e.touches[0].clientY;
      touchTriggered = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchTriggered || e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, [role="dialog"], [role="menu"]')) return;

      const deltaY = touchStartY - e.touches[0].clientY;
      if (deltaY > 28) {
        touchTriggered = true;
        triggerScrollDown();
      } else if (deltaY < -28) {
        touchTriggered = true;
        triggerScrollUp();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        triggerScrollDown();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        triggerScrollUp();
      } else if (e.key === 'Home') {
        e.preventDefault();
        void swapToSlot('1', 0);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerScrollDown, triggerScrollUp, swapToSlot]);

  // Unlock initial autoplay on first user gesture if browser power-saver paused initial play
  useEffect(() => {
    const unlock = () => {
      const active = getActiveVideo();
      if (active && active.paused) {
        active.play().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [getActiveVideo]);

  useEffect(() => {
    return () => {
      if (backplateTimerRef.current !== null) {
        window.clearTimeout(backplateTimerRef.current);
      }
    };
  }, []);

  const handleGoHome = useCallback(() => {
    void swapToSlot('1', 0);
  }, [swapToSlot]);

  const sharedVideoStyle = (slot: SlotId): React.CSSProperties => {
    const isActive = activeSlot === slot;
    const isBackplate = backplateSlot === slot;
    return {
      transform: `scale(${viewportSpec.zoom}) translateZ(0)`,
      filter: 'brightness(1.03) contrast(1.03) saturate(1.03)',
      opacity: isActive || isBackplate ? 1 : 0,
      zIndex: isActive ? 20 : isBackplate ? 10 : 0,
      willChange: 'transform, opacity',
    };
  };

  const fwdSlot: SlotId = activeSlot === '2.1_fwd' || backplateSlot === '2.1_fwd' ? '2.1_fwd' : '1.1_fwd';
  const revSlot: SlotId = activeSlot === '2.1_rev' || backplateSlot === '2.1_rev' ? '2.1_rev' : '1.1_rev';

  return (
    <main className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-white select-none touch-none">
      {/* Stacked GPU-decoded HD video layers with zero flash or transition effects */}
      <video
        ref={loop1Ref}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        aria-label="Asset 1 loop animation"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={sharedVideoStyle('1')}
      />

      <video
        ref={transFwdRef}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={sharedVideoStyle(fwdSlot)}
      />

      <video
        ref={transRevRef}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={sharedVideoStyle(revSlot)}
      />

      <video
        ref={loop2Ref}
        muted
        loop
        playsInline
        preload="auto"
        aria-label="Asset 2 loop animation"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={sharedVideoStyle('2')}
      />

      <video
        ref={loop3Ref}
        muted
        loop
        playsInline
        preload="auto"
        aria-label="Asset 3 loop animation"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={sharedVideoStyle('3')}
      />

      {/* Minimal Top Controls + Home 'Aston Martian' title */}
      <MinimalTopControls onGoHome={handleGoHome} isHome={activeSlot === '1'} />

      {/* Bottom-right HD Logo matching R asset placement */}
      <img
        src="/logo.png"
        alt="Brand logo"
        draggable={false}
        className="fixed z-[25] bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] sm:bottom-6 sm:right-7 md:bottom-7 md:right-8 w-12 sm:w-16 md:w-[76px] h-auto object-contain pointer-events-none select-none"
      />
    </main>
  );
}
