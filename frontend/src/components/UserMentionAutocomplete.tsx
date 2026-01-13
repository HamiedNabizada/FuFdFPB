import { useState, useEffect, useRef } from 'react';
import { User as UserIcon } from 'lucide-react';
import { toBase36 } from '../lib/id-utils';

interface UserOption {
  id: number;
  name: string;
}

interface UserMentionAutocompleteProps {
  text: string;
  cursorPosition: number;
  onSelectUser: (mention: string, replaceFrom: number, replaceTo: number) => void;
  onClose: () => void;
  visible: boolean;
  anchorRect?: { top: number; left: number };
}

export function useUserMention(text: string, cursorPosition: number) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [triggerStart, setTriggerStart] = useState(0);

  useEffect(() => {
    const textBeforeCursor = text.slice(0, cursorPosition);
    // Match @U followed by optional letters at end of text before cursor
    const match = textBeforeCursor.match(/@U([a-zA-Z]*)$/i);

    if (match) {
      setTriggerStart(cursorPosition - match[0].length);
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  }, [text, cursorPosition]);

  return {
    showDropdown,
    triggerStart,
    filterText: showDropdown ? text.slice(triggerStart + 2, cursorPosition).toLowerCase() : '',
    closeDropdown: () => setShowDropdown(false),
  };
}

export default function UserMentionAutocomplete({
  text,
  cursorPosition,
  onSelectUser,
  onClose,
  visible,
  anchorRect,
}: UserMentionAutocompleteProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Extract filter text from current input
  const textBeforeCursor = text.slice(0, cursorPosition);
  const match = textBeforeCursor.match(/@U([a-zA-Z]*)$/i);
  const filterText = match ? match[1].toLowerCase() : '';
  const triggerStart = match ? cursorPosition - match[0].length : 0;

  // Fetch users on mount
  useEffect(() => {
    fetch('/api/auth/users')
      .then((res) => res.json())
      .then((data) => {
        console.log('Fetched users:', data);
        setUsers(data.users || []);
      })
      .catch((err) => console.error('Failed to fetch users:', err));
  }, []);

  // Filter users
  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(filterText)
  );

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filterText]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(filteredUsers.length, 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % Math.max(filteredUsers.length, 1));
          break;
        case 'Enter':
        case 'Tab':
          if (filteredUsers[selectedIndex]) {
            e.preventDefault();
            selectUser(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, selectedIndex, filteredUsers, onClose]);

  const selectUser = (user: UserOption) => {
    const mention = `@U-${toBase36(user.id)}`;
    onSelectUser(mention, triggerStart, cursorPosition);
  };

  if (!visible || filteredUsers.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 bg-white border border-primary-200 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto min-w-[200px]"
      style={{
        top: anchorRect ? `${anchorRect.top}px` : '100%',
        left: anchorRect ? `${anchorRect.left}px` : '0',
      }}
    >
      <div className="px-2 py-1 text-xs text-primary-400 border-b border-primary-100">
        Benutzer erwähnen
      </div>
      {filteredUsers.map((user, index) => (
        <button
          key={user.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent textarea blur
            selectUser(user);
          }}
          className={`w-full px-3 py-2 text-left flex items-center gap-2 text-sm transition-colors ${
            index === selectedIndex
              ? 'bg-primary-100 text-primary-900'
              : 'text-primary-700 hover:bg-primary-50'
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
