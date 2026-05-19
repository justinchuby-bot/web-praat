import { useState, type ReactNode } from 'react';

interface BottomSheetProps {
  children: ReactNode;
  trigger?: ReactNode;
}

export function BottomSheet({ children, trigger }: BottomSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="mobile-fab" onClick={() => setOpen(true)} aria-label="Open settings">
        {trigger ?? '⚙️'}
      </button>
      {open && (
        <>
          <div className="bottom-sheet-overlay" onClick={() => setOpen(false)} />
          <div className="bottom-sheet" role="dialog" aria-label="Settings panel">
            <div className="bottom-sheet-handle" />
            {children}
          </div>
        </>
      )}
    </>
  );
}
