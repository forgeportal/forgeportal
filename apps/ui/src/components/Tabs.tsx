import { type ReactNode, useEffect, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';

interface Tab {
  id:      string;
  label:   string;
  content: ReactNode;
}

interface TabsProps {
  tabs:        Tab[];
  defaultTab?: string;
}

// How many tabs to show directly before collapsing the rest into "More ▾"
const VISIBLE_THRESHOLD = 7;

export default function Tabs({ tabs, defaultTab }: TabsProps) {
  // ── active tab (hash-synced) ───────────────────────────────────────────────
  const getActiveFromHash = useCallback(() => {
    const hash = window.location.hash.slice(1);
    return tabs.find((t) => t.id === hash)?.id ?? defaultTab ?? tabs[0]?.id ?? '';
  }, [tabs, defaultTab]);

  const [active,      setActive]      = useState<string>(getActiveFromHash);
  const [moreOpen,    setMoreOpen]    = useState(false);
  const [canScrollL,  setCanScrollL]  = useState(false);
  const [canScrollR,  setCanScrollR]  = useState(false);

  const stripRef   = useRef<HTMLDivElement>(null);
  const moreRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onHashChange = () => setActive(getActiveFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [getActiveFromHash]);

  // Close "More" on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Track scroll position to show/hide arrow buttons
  const checkScroll = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCanScrollL(el.scrollLeft > 4);
    setCanScrollR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [checkScroll]);

  function handleClick(id: string) {
    window.location.hash = id;
    setActive(id);
    setMoreOpen(false);
  }

  function scroll(dir: 'left' | 'right') {
    stripRef.current?.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' });
  }

  // Split tabs into visible + overflow
  const visibleTabs  = tabs.slice(0, VISIBLE_THRESHOLD);
  const overflowTabs = tabs.slice(VISIBLE_THRESHOLD);
  const activeInOverflow = overflowTabs.some((t) => t.id === active);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      {/* Tab bar */}
      <div className="relative border-b border-gray-200">
        {/* Left scroll arrow */}
        {canScrollL && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-1 bg-gradient-to-r from-white via-white to-transparent pr-3"
            aria-label="Scroll tabs left"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Scrollable strip */}
        <div
          ref={stripRef}
          className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          role="tablist"
          aria-label="Entity tabs"
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleClick(tab.id)}
              role="tab"
              aria-selected={active === tab.id}
              className={clsx(
                'shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                active === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              )}
            >
              {tab.label}
            </button>
          ))}

          {/* "More ▾" button for overflow tabs */}
          {overflowTabs.length > 0 && (
            <div ref={moreRef} className="relative shrink-0">
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={clsx(
                  'whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1',
                  activeInOverflow
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                )}
                aria-haspopup="true"
                aria-expanded={moreOpen}
              >
                {activeInOverflow
                  ? (tabs.find((t) => t.id === active)?.label ?? 'More')
                  : 'More'}
                <svg
                  className={clsx('h-3.5 w-3.5 transition-transform', moreOpen && 'rotate-180')}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {activeInOverflow && (
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                )}
              </button>

              {/* Overflow dropdown */}
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                  {overflowTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleClick(tab.id)}
                      className={clsx(
                        'w-full text-left px-4 py-2 text-sm transition-colors',
                        active === tab.id
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50',
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right scroll arrow */}
        {canScrollR && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 flex items-center px-1 bg-gradient-to-l from-white via-white to-transparent pl-3"
            aria-label="Scroll tabs right"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Tab panel */}
      <div className="py-6" role="tabpanel">
        {activeTab?.content}
      </div>
    </div>
  );
}
