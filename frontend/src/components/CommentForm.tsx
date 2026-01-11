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
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        />
      )}
      <textarea
        placeholder="Kommentar hinzufügen..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        rows={3}
      />
      <button
        type="submit"
        disabled={disabled || !text.trim() || (!user && !authorName.trim())}
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-4 h-4" />
        Kommentar senden
      </button>
    </form>
  );
}
