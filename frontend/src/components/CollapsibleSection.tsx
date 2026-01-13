import { useState, useEffect, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  id: string; // Unique ID for localStorage
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export default function CollapsibleSection({
  id,
  title,
  icon,
  badge,
  defaultOpen = true,
  children,
  className = '',
}: CollapsibleSectionProps) {
  const storageKey = `collapsible-${id}`;

  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      return stored === 'true';
    }
    return defaultOpen;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(isOpen));
  }, [isOpen, storageKey]);

  return (
    <div className={`card overflow-hidden ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-primary-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-primary-900">{title}</h2>
          {badge}
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-primary-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-primary-400" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-primary-100">
          {children}
        </div>
      )}
    </div>
  );
}
