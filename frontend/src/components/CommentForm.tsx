import { useState, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import type { User } from '../App';
import { CATEGORIES, CATEGORY_OPTIONS, type CommentCategory } from '../lib/categories';
import UserMentionAutocomplete from './UserMentionAutocomplete';

interface CommentFormProps {
  user: User | null;
  onSubmit: (text: string, authorName?: string, category?: CommentCategory) => void;
  disabled?: boolean;
}

export default function CommentForm({ user, onSubmit, disabled }: CommentFormProps) {
  const [text, setText] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [category, setCategory] = useState<CommentCategory>('technical');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if we should show the mention dropdown
  const checkForMentionTrigger = useCallback((newText: string, newCursorPos: number) => {
    const textBeforeCursor = newText.slice(0, newCursorPos);
    const match = textBeforeCursor.match(/@U([a-zA-Z]*)$/i);
    setShowMentionDropdown(!!match);
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const newCursorPos = e.target.selectionStart;
    setText(newText);
    setCursorPosition(newCursorPos);
    checkForMentionTrigger(newText, newCursorPos);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Update cursor position on key navigation
    const newCursorPos = e.currentTarget.selectionStart;
    setCursorPosition(newCursorPos);
    checkForMentionTrigger(text, newCursorPos);
  };

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const newCursorPos = e.currentTarget.selectionStart;
    setCursorPosition(newCursorPos);
    checkForMentionTrigger(text, newCursorPos);
  };

  const handleSelectUser = useCallback((mention: string, replaceFrom: number, replaceTo: number) => {
    const newText = text.slice(0, replaceFrom) + mention + ' ' + text.slice(replaceTo);
    setText(newText);
    setShowMentionDropdown(false);

    // Set cursor after the mention
    const newCursorPos = replaceFrom + mention.length + 1;
    setCursorPosition(newCursorPos);

    // Focus and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [text]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!user && !authorName.trim()) return;

    onSubmit(text, user ? undefined : authorName, category);
    setText('');
    setAuthorName('');
    setCategory('technical');
    setCursorPosition(0);
    setShowMentionDropdown(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!user && (
        <input
          type="text"
          placeholder="Ihr Name"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          disabled={disabled}
          className="input"
        />
      )}

      {/* Kategorie-Auswahl */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setCategory(opt.value)}
            disabled={disabled}
            title={CATEGORIES[opt.value].description}
            className={`text-xs px-2.5 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
              category === opt.value
                ? `${CATEGORIES[opt.value].bgColor} ${CATEGORIES[opt.value].color} ring-2 ring-offset-1 ring-primary-300`
                : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${CATEGORIES[opt.value].dotColor}`}></span>
            {opt.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          placeholder="Kommentar hinzufügen... (@U für Benutzer erwähnen)"
          value={text}
          onChange={handleTextChange}
          onKeyUp={handleKeyUp}
          onClick={handleClick}
          disabled={disabled}
          className="input resize-none"
          rows={3}
        />
        <UserMentionAutocomplete
          text={text}
          cursorPosition={cursorPosition}
          onSelectUser={handleSelectUser}
          onClose={() => setShowMentionDropdown(false)}
          visible={showMentionDropdown}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-primary-400">
          **fett**, *kursiv*, `code`, @U für Benutzer
        </span>
        <button
          type="submit"
          disabled={disabled || !text.trim() || (!user && !authorName.trim())}
          className="btn-primary"
        >
          <Send className="w-4 h-4" />
          Senden
        </button>
      </div>
    </form>
  );
}
