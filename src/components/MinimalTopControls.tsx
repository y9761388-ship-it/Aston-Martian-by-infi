import { useEffect, useRef, useState } from 'react';
import { Home, MoreVertical, User, Settings } from 'lucide-react';

interface MinimalTopControlsProps {
  onGoHome: () => void;
  isHome: boolean;
}

export function MinimalTopControls({ onGoHome, isHome }: MinimalTopControlsProps) {
  const [openMenu, setOpenMenu] = useState<'profile' | 'more' | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        openMenu === 'profile' &&
        profileRef.current &&
        !profileRef.current.contains(target)
      ) {
        setOpenMenu(null);
      }
      if (
        openMenu === 'more' &&
        moreRef.current &&
        !moreRef.current.contains(target)
      ) {
        setOpenMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  return (
    <>
      {/* Top-Left: Minimal Small Settings / Profile Button */}
      <div
        ref={profileRef}
        className="fixed z-30 top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] sm:top-4 sm:left-4"
      >
        <button
          type="button"
          onClick={() => setOpenMenu((prev) => (prev === 'profile' ? null : 'profile'))}
          aria-label="Profile"
          aria-expanded={openMenu === 'profile'}
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-neutral-900 border border-black/10 backdrop-blur-md shadow-xs transition-transform duration-150 hover:bg-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          <User className="h-4 w-4 stroke-[1.75]" />
          <Settings className="absolute right-1.5 bottom-1.5 h-2.5 w-2.5 stroke-[2.2] bg-white rounded-full p-[1px]" />
        </button>

        {openMenu === 'profile' && (
          <div
            role="dialog"
            aria-label="Profile message"
            className="mt-2 max-w-[260px] rounded-xl bg-white/95 backdrop-blur-xl border border-black/10 shadow-lg px-3.5 py-2.5 text-neutral-900"
          >
            <p className="text-xs font-medium leading-snug text-neutral-900">
              INFI is read buit your dream
            </p>
          </div>
        )}
      </div>

      {/* Home Title: 'Aston Martian' floating cleanly at top-right above the car */}
      <div
        aria-hidden={!isHome}
        style={{
          fontFamily: '"Cinzel", serif',
          opacity: isHome ? 1 : 0,
          transform: isHome ? 'translateY(0) scale(1)' : 'translateY(-14px) scale(0.97)',
          transition:
            'opacity 420ms cubic-bezier(0.16, 1, 0.3, 1), transform 420ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="fixed z-20 pointer-events-none select-none portrait:top-[22%] portrait:right-[max(1.25rem,env(safe-area-inset-right))] sm:portrait:top-[20%] sm:portrait:right-10 landscape:top-[14%] landscape:right-[max(1.75rem,env(safe-area-inset-right))] md:landscape:top-[14%] md:landscape:right-14"
      >
        <span className="block text-base sm:text-xl md:text-2xl lg:text-[26px] font-semibold tracking-[0.16em] text-neutral-900 whitespace-nowrap">
          Aston Martian
        </span>
      </div>

      {/* Top-Right: Home Button & 3 Dots Button */}
      <div
        ref={moreRef}
        className="fixed z-30 top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] sm:top-4 sm:right-4 flex flex-col items-end"
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setOpenMenu(null);
              onGoHome();
            }}
            aria-label="Home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-neutral-900 border border-black/10 backdrop-blur-md shadow-xs transition-transform duration-150 hover:bg-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            <Home className="h-4 w-4 stroke-[1.75]" />
          </button>

          <button
            type="button"
            onClick={() => setOpenMenu((prev) => (prev === 'more' ? null : 'more'))}
            aria-label="More options"
            aria-expanded={openMenu === 'more'}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-neutral-900 border border-black/10 backdrop-blur-md shadow-xs transition-transform duration-150 hover:bg-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            <MoreVertical className="h-4 w-4 stroke-[1.75]" />
          </button>
        </div>

        {openMenu === 'more' && (
          <div
            role="dialog"
            aria-label="More message"
            className="mt-2 max-w-[260px] rounded-xl bg-white/95 backdrop-blur-xl border border-black/10 shadow-lg px-3.5 py-2.5 text-neutral-900"
          >
            <p className="text-xs font-medium leading-snug text-neutral-900">
              customisable in your dream website
            </p>
          </div>
        )}
      </div>
    </>
  );
}
