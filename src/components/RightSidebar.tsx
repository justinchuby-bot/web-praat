import { useState, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  AudioWaveform, Mic, Activity, Drum, Ear, Video, BookOpen, Settings, Code, BarChart3, Layers, Circle,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

type Tab = 'spectrum' | 'ltas' | 'mfcc' | 'voice' | 'hnr' | 'rhythm' | 'excitation' | 'video' | 'vocabulary' | 'settings' | 'script' | 'vowels';

interface RightSidebarProps {
  children: {
    spectrum: ReactNode;
    ltas: ReactNode;
    mfcc: ReactNode;
    voice: ReactNode;
    hnr: ReactNode;
    rhythm: ReactNode;
    excitation: ReactNode;
    video: ReactNode;
    vocabulary: ReactNode;
    settings: ReactNode;
    script: ReactNode;
    vowels: ReactNode;
  };
}

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'spectrum', label: 'Spectrum', icon: AudioWaveform },
  { id: 'ltas', label: 'LTAS', icon: BarChart3 },
  { id: 'mfcc', label: 'MFCC', icon: Layers },
  { id: 'voice', label: 'Voice Quality', icon: Mic },
  { id: 'hnr', label: 'HNR', icon: Activity },
  { id: 'rhythm', label: 'Rhythm', icon: Drum },
  { id: 'excitation', label: 'Excitation', icon: Ear },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'vocabulary', label: 'Vocabulary', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'script', label: 'Script Editor', icon: Code },
  { id: 'vowels', label: 'Vowel Space', icon: Circle },
];

const DEFAULT_WIDTH: Record<string, number> = { script: 480 };
const FALLBACK_WIDTH = 320;

export function RightSidebar({ children }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const resizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail as Tab;
      setActiveTab(tab);
      setWidth(DEFAULT_WIDTH[tab] ?? FALLBACK_WIDTH);
    };
    document.addEventListener('open-sidebar-tab', handler);
    return () => document.removeEventListener('open-sidebar-tab', handler);
  }, []);

  const handleTabClick = (tab: Tab) => {
    setActiveTab((current) => {
      if (current === tab) return null;
      setWidth(DEFAULT_WIDTH[tab] ?? FALLBACK_WIDTH);
      return tab;
    });
  };

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;

    const handleMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = startX.current - ev.clientX;
      setWidth(Math.max(280, Math.min(800, startWidth.current + delta)));
    };
    const handleUp = () => {
      resizing.current = false;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [width]);

  const isOpen = activeTab !== null;

  return (
    <div className="right-sidebar" data-open={isOpen} style={isOpen ? { width: `${width}px` } : undefined}>
      {isOpen && (
        <div className="right-sidebar-resize" onMouseDown={handleResizeStart} />
      )}
      <div className="right-sidebar-header">
        {tabs.map(({ id, label, icon: Icon }) => (
          <TooltipProvider key={id} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`right-sidebar-tab ${activeTab === id ? 'active' : ''}`}
                  onClick={() => handleTabClick(id)}
                  aria-label={label}
                >
                  <Icon size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
      {isOpen && (
        <div className="right-sidebar-content">
          {children[activeTab!]}
        </div>
      )}
    </div>
  );
}
