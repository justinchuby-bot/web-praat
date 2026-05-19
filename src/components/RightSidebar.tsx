import { useState } from 'react';
import type { ReactNode } from 'react';

type Tab = 'spectrum' | 'voice' | 'hnr' | 'rhythm' | 'excitation' | 'settings';

interface RightSidebarProps {
  children: {
    spectrum: ReactNode;
    voice: ReactNode;
    hnr: ReactNode;
    rhythm: ReactNode;
    excitation: ReactNode;
    settings: ReactNode;
  };
}

const tabLabels: { id: Tab; label: string }[] = [
  { id: 'spectrum', label: 'Spectrum' },
  { id: 'voice', label: 'Voice Quality' },
  { id: 'hnr', label: 'HNR' },
  { id: 'rhythm', label: 'Rhythm' },
  { id: 'excitation', label: 'Excitation' },
  { id: 'settings', label: 'Settings' },
];

export function RightSidebar({ children }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  const handleTabClick = (tab: Tab) => {
    setActiveTab((current) => (current === tab ? null : tab));
  };

  const isOpen = activeTab !== null;

  return (
    <div className="right-sidebar" data-open={isOpen}>
      <div className="right-sidebar-tabs">
        {tabLabels.map(({ id, label }) => (
          <button
            key={id}
            className={`right-sidebar-tab ${activeTab === id ? 'active' : ''}`}
            onClick={() => handleTabClick(id)}
            title={label}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="right-sidebar-panel">
        {isOpen && (
          <div className="right-sidebar-content">
            {children[activeTab!]}
          </div>
        )}
      </div>
    </div>
  );
}
