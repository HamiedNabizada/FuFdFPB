export type CommentCategory = 'editorial' | 'technical' | 'question' | 'discussion' | 'error';

export const CATEGORIES: Record<CommentCategory, { label: string; description: string; color: string; bgColor: string; dotColor: string }> = {
  editorial: {
    label: 'Redaktionell',
    description: 'Formatierung, Rechtschreibung, Formulierung',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    dotColor: 'bg-slate-500'
  },
  technical: {
    label: 'Technisch',
    description: 'Strukturelle oder technische Änderungen am Schema',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    dotColor: 'bg-blue-500'
  },
  question: {
    label: 'Frage',
    description: 'Verständnisfrage oder Klärungsbedarf',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    dotColor: 'bg-amber-500'
  },
  discussion: {
    label: 'Diskussion',
    description: 'Thema zur Abstimmung im Gremium',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    dotColor: 'bg-purple-500'
  },
  error: {
    label: 'Fehler',
    description: 'Bug oder Inkonsistenz im Schema',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    dotColor: 'bg-red-500'
  }
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([value, { label }]) => ({
  value: value as CommentCategory,
  label
}));
