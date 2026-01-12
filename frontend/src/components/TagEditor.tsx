import { useState } from 'react';
import { Tag, X, Plus, Check } from 'lucide-react';

// Vordefinierte Tag-Optionen mit Farben
const TAG_PRESETS: Record<string, { label: string; color: string }> = {
  'Draft': { label: 'Draft', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'In Review': { label: 'In Review', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'Approved': { label: 'Approved', color: 'bg-green-100 text-green-800 border-green-200' },
  'Deprecated': { label: 'Deprecated', color: 'bg-red-100 text-red-800 border-red-200' },
  'Final': { label: 'Final', color: 'bg-purple-100 text-purple-800 border-purple-200' },
};

interface TagEditorProps {
  tags: string[];
  onTagsChange: (tags: string[]) => Promise<void>;
  canEdit: boolean;
}

export default function TagEditor({ tags, onTagsChange, canEdit }: TagEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState('');

  const getTagStyle = (tag: string) => {
    return TAG_PRESETS[tag]?.color || 'bg-primary-100 text-primary-700 border-primary-200';
  };

  const handleAddTag = async (tag: string) => {
    if (!tag.trim() || tags.includes(tag.trim())) return;

    setSaving(true);
    try {
      await onTagsChange([...tags, tag.trim()]);
      setNewTag('');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    setSaving(true);
    try {
      await onTagsChange(tags.filter(t => t !== tagToRemove));
    } finally {
      setSaving(false);
    }
  };

  // Nur Tags anzeigen (nicht editierbar)
  if (!canEdit) {
    if (tags.length === 0) return null;

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {tags.map(tag => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${getTagStyle(tag)}`}
          >
            <Tag className="w-3 h-3" />
            {tag}
          </span>
        ))}
      </div>
    );
  }

  // Editierbarer Modus
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tags.map(tag => (
        <span
          key={tag}
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${getTagStyle(tag)}`}
        >
          <Tag className="w-3 h-3" />
          {tag}
          {isEditing && (
            <button
              onClick={() => handleRemoveTag(tag)}
              className="ml-0.5 hover:text-red-600"
              disabled={saving}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}

      {isEditing ? (
        <div className="flex items-center gap-1">
          {/* Preset-Tags als schnelle Optionen */}
          <div className="flex gap-1">
            {Object.keys(TAG_PRESETS)
              .filter(preset => !tags.includes(preset))
              .slice(0, 3)
              .map(preset => (
                <button
                  key={preset}
                  onClick={() => handleAddTag(preset)}
                  disabled={saving}
                  className={`px-2 py-0.5 text-xs rounded-full border opacity-60 hover:opacity-100 transition-opacity ${TAG_PRESETS[preset].color}`}
                >
                  + {preset}
                </button>
              ))
            }
          </div>

          {/* Custom Tag Input */}
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag(newTag);
              }
            }}
            placeholder="Neuer Tag..."
            className="px-2 py-0.5 text-xs border border-primary-200 rounded-full w-24 focus:outline-none focus:ring-1 focus:ring-primary-400"
            disabled={saving}
          />

          <button
            onClick={() => setIsEditing(false)}
            className="p-1 text-primary-500 hover:text-primary-700"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded-full transition-colors"
        >
          <Plus className="w-3 h-3" />
          Tag
        </button>
      )}
    </div>
  );
}

// Kompakte Tag-Anzeige für Listen
export function TagBadges({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map(tag => (
        <span
          key={tag}
          className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded border ${
            TAG_PRESETS[tag]?.color || 'bg-primary-100 text-primary-700 border-primary-200'
          }`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
