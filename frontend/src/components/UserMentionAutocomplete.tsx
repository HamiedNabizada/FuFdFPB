import { useState, useEffect, useRef, useCallback } from 'react';
import { User as UserIcon } from 'lucide-react';
import { toBase36 } from '../lib/id-utils';

interface UserOption {
  id: number;
  name: string;
}

interface UserMentionAutocompleteProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  text: string;
  onInsertMention: (mention: string, cursorOffset: number) => void;
}

export default function UserMentionAutocomplete({
  textareaRef,
  text,
  onInsertMention,
}: UserMentionAutocompleteProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<UserOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerPosition, setTriggerPosition] = useState<{ start: number; end: number } | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch users on mount
  useEffect(() => {
    fetch('/api/auth/users')
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch((err) => console.error('Failed to fetch users:', err));
  }, []);

  // Detect @U trigger in text
  const detectTrigger = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return null;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);

    // Look for @U pattern - trigger on @U followed by optional characters
    const match = textBeforeCursor.match(/@U([a-zA-Z]*)$/i);
    if (match) {
      const start = cursorPos - match[0].length;
      const filterText = match[1]?.toLowerCase() || '';
      return { start, end: cursorPos, filterText };
    }

    return null;
  }, [text, textareaRef]);

  // Update dropdown visibility and filter
  useEffect(() => {
    const trigger = detectTrigger();

    if (trigger && users.length > 0) {
      const filtered = users.filter((u) =>
        u.name.toLowerCase().includes(trigger.filterText)
      );
      setFilteredUsers(filtered);
      setTriggerPosition({ start: trigger.start, end: trigger.end });
      setShowDropdown(filtered.length > 0);
      setSelectedIndex(0);

      // Calculate dropdown position
      const textarea = textareaRef.current;
      if (textarea) {
        const rect = textarea.getBoundingClientRect();
        // Approximate position based on cursor
        const lineHeight = 24;
        const charWidth = 8;
        const lines = text.slice(0, trigger.start).split('\n');
        const currentLine = lines.length - 1;
        const charInLine = lines[lines.length - 1].length;

        setDropdownPosition({
          top: Math.min(currentLine * lineHeight + lineHeight, rect.height - 150),
          left: Math.min(charInLine * charWidth, rect.width - 200),
        });
      }
    } else {
      setShowDropdown(false);
      setTriggerPosition(null);
    }
  }, [text, users, detectTrigger, textareaRef]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showDropdown) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
          break;
        case 'Enter':
        case 'Tab':
          if (filteredUsers[selectedIndex]) {
            e.preventDefault();
            selectUser(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          setShowDropdown(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDropdown, selectedIndex, filteredUsers]);

  const selectUser = (user: UserOption) => {
    if (!triggerPosition) return;

    const mention = `@U-${toBase36(user.id)}`;
    onInsertMention(mention, triggerPosition.start);
    setShowDropdown(false);
  };

  if (!showDropdown) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 bg-white border border-primary-200 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto min-w-[200px]"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
      }}
    >
      <div className="px-2 py-1 text-xs text-primary-400 border-b border-primary-100">
        Benutzer erwähnen
      </div>
      {filteredUsers.map((user, index) => (
        <button
          key={user.id}
          type="button"
          onClick={() => selectUser(user)}
          className={`w-full px-3 py-2 text-left flex items-center gap-2 text-sm transition-colors ${
            index === selectedIndex
              ? 'bg-primary-50 text-primary-900'
              : 'text-primary-700 hover:bg-primary-25'
          }`}
        >
          <UserIcon className="w-4 h-4 text-primary-400" />
          <span>{user.name}</span>
          <span className="text-xs text-primary-400 ml-auto">U-{toBase36(user.id)}</span>
        </button>
      ))}
    </div>
  );
}
