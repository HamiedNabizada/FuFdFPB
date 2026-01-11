import { useState } from 'react';
import { Send } from 'lucide-react';
import type { User } from '../App';

interface CommentFormProps {
  user: User | null;
  onSubmit: (text: string, authorName?: string) => void;
  disabled?: boolean;
}

export default function CommentForm({ user, onSubmit, disabled }: CommentFormProps) {
  const [text, setText] = useState('');
  const [authorName, setAuthorName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!user && !authorName.trim()) return;

    onSubmit(text, user ? undefined : authorName);
    setText('');
    setAuthorName('');
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
      <textarea
        placeholder="Kommentar hinzufügen..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        className="input resize-none"
        rows={3}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-primary-400">
          **fett**, *kursiv*, `code`, Listen mit - oder 1.
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
