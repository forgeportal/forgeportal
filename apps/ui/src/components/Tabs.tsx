import { type ReactNode, useEffect, useState } from 'react';
import clsx from 'clsx';

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export default function Tabs({ tabs, defaultTab }: TabsProps) {
  const getActiveFromHash = () => {
    const hash = window.location.hash.slice(1);
    return tabs.find((t) => t.id === hash)?.id ?? defaultTab ?? tabs[0]?.id ?? '';
  };

  const [active, setActive] = useState<string>(getActiveFromHash);

  useEffect(() => {
    const onHashChange = () => setActive(getActiveFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  });

  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  function handleClick(id: string) {
    window.location.hash = id;
    setActive(id);
  }

  return (
    <div>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-1" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleClick(tab.id)}
              className={clsx(
                'whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                active === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              )}
              aria-selected={active === tab.id}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="py-6" role="tabpanel">
        {activeTab?.content}
      </div>
    </div>
  );
}
