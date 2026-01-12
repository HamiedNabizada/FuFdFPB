export type CommentCategory = 'editorial' | 'technical' | 'question' | 'discussion' | 'error';

export const CATEGORIES: Record<CommentCategory, { label: string; icon: string; color: string; bgColor: string }> = {
  editorial: {
    label: 'Redaktionell',
    icon: '✏️',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100'
  },
  technical: {
    label: 'Technisch',
    icon: '⚙️',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100'
  },
  question: {
    label: 'Frage',
    icon: '❓',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100'
  },
  discussion: {
    label: 'Diskussion',
    icon: '💬',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100'
  },
  error: {
    label: 'Fehler',
    icon: '🐛',
    color: 'text-red-700',
    bgColor: 'bg-red-100'
  }
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([value, { label, icon }]) => ({
  value: value as CommentCategory,
  label: `${icon} ${label}`
}));
