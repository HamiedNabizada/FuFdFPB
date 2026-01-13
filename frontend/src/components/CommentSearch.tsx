import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X, FileText, ExternalLink, CheckCircle, Clock } from 'lucide-react';
import { CATEGORIES, type CommentCategory } from '../lib/categories';

interface SearchResult {
  id: number;
  commentText: string;
  elementName: string | null;
  xpath: string | null;
  status: 'open' | 'resolved';
  category: CommentCategory | null;
  createdAt: string;
  authorName?: string;
  author?: { name: string } | null;
  schema: { id: number; name: string; version: string; groupId: number | null } | null;
  group: { id: number; name: string; version: string } | null;
  replies?: { id: number }[];
}

export default function CommentSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/comments/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.comments);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  const getCommentLink = (comment: SearchResult) => {
    const xpathParam = comment.xpath ? `?xpath=${encodeURIComponent(comment.xpath)}` : '';
    const schemaParam = comment.schema?.id ? `&schemaId=${comment.schema.id}` : '';

    if (comment.schema?.groupId) {
      return `/group/${comment.schema.groupId}${xpathParam}${schemaParam}`;
    } else if (comment.schema) {
      return `/schema/${comment.schema.id}${xpathParam}`;
    } else if (comment.group) {
      return `/group/${comment.group.id}`;
    }
    return '#';
  };

  const getLocationName = (comment: SearchResult) => {
    if (comment.group && !comment.schema) {
      return comment.group.name;
    }
    if (comment.schema) {
      return comment.schema.name;
    }
    return 'Unbekannt';
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark> : part
    );
  };

  return (
    <div className="card p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-5 h-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-primary-900">Kommentare durchsuchen</h2>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchbegriff eingeben..."
            className="input pr-8"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary-400 hover:text-primary-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="btn-primary"
        >
          {loading ? 'Suche...' : 'Suchen'}
        </button>
      </form>

      {/* Results */}
      {searched && (
        <div>
          {results.length === 0 ? (
            <p className="text-center text-primary-500 py-4">
              Keine Kommentare gefunden für "{query}"
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-primary-500 mb-3">
                {results.length} Ergebnis{results.length !== 1 ? 'se' : ''} für "{query}"
              </p>
              {results.map((comment) => (
                <Link
                  key={comment.id}
                  to={getCommentLink(comment)}
                  className="block p-3 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-primary-700">
                          {comment.author?.name || comment.authorName || 'Anonym'}
                        </span>
                        {comment.status === 'resolved' ? (
                          <span className="text-xs bg-accent-100 text-accent-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Erledigt
                          </span>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Offen
                          </span>
                        )}
                        {comment.category && CATEGORIES[comment.category] && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${CATEGORIES[comment.category].bgColor} ${CATEGORIES[comment.category].color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${CATEGORIES[comment.category].dotColor}`}></span>
                            {CATEGORIES[comment.category].label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-primary-800 line-clamp-2">
                        {highlightMatch(comment.commentText, query)}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-primary-400">
                        <FileText className="w-3 h-3" />
                        <span>{getLocationName(comment)}</span>
                        {comment.elementName && (
                          <>
                            <span>→</span>
                            <span className="text-primary-500">{highlightMatch(comment.elementName, query)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-primary-300 flex-shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
