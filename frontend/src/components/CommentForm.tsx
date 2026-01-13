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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertMention = useCallback((mention: string, triggerStart: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const newText = text.slice(0, triggerStart) + mention + ' ' + text.slice(cursorPos);
    setText(newText);

    // Set cursor after the mention
    setTimeout(() => {
      const newCursorPos = triggerStart + mention.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
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
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          className="input resize-none"
          rows={3}
        />
        <UserMentionAutocomplete
          textareaRef={textareaRef}
          text={text}
          onInsertMention={handleInsertMention}
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
