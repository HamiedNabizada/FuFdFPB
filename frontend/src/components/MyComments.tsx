import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, FileText, ExternalLink, CheckCircle, Clock, MessageCircle } from 'lucide-react';
import { CATEGORIES, type CommentCategory } from '../lib/categories';

interface MyComment {
  id: number;
  commentText: string;
  elementName: string | null;
  xpath: string | null;
  status: 'open' | 'resolved';
  category: CommentCategory | null;
  createdAt: string;
  schema: { id: number; name: string; version: string; groupId: number | null } | null;
  group: { id: number; name: string; version: string } | null;
  replies: { id: number }[];
}

export default function MyComments() {
  const [comments, setComments] = useState<MyComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  useEffect(() => {
    fetchMyComments();
  }, []);

  const fetchMyComments = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/comments/my-comments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
      }
    } catch (error) {
      console.error('Error fetching my comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCommentLink = (comment: MyComment) => {
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

  const getLocationName = (comment: MyComment) => {
    if (comment.group && !comment.schema) {
      return comment.group.name;
    }
    if (comment.schema) {
      return comment.schema.name;
    }
    return 'Unbekannt';
  };

  const filteredComments = comments.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const openCount = comments.filter((c) => c.status === 'open').length;
  const resolvedCount = comments.filter((c) => c.status === 'resolved').length;

  if (loading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="h-6 bg-primary-100 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-primary-50 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (comments.length === 0) {
    return null;
  }

  return (
    <div className="card p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-primary-900">Meine Kommentare</h2>
          <span className="badge-neutral">{comments.length}</span>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1 bg-primary-100 rounded-lg p-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-primary-500 hover:text-primary-700'
            }`}
          >
            Alle ({comments.length})
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
              filter === 'open'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-primary-500 hover:text-primary-700'
            }`}
          >
            Offen ({openCount})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
              filter === 'resolved'
                ? 'bg-white text-accent-700 shadow-sm'
                : 'text-primary-500 hover:text-primary-700'
            }`}
          >
            Erledigt ({resolvedCount})
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {filteredComments.length === 0 ? (
          <p className="text-center text-primary-400 py-4">
            Keine {filter === 'open' ? 'offenen' : 'erledigten'} Kommentare
          </p>
        ) : (
          filteredComments.map((comment) => (
            <Link
              key={comment.id}
              to={getCommentLink(comment)}
              className="block p-3 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
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
                    {comment.replies.length > 0 && (
                      <span className="text-xs text-primary-500 flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {comment.replies.length}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-primary-800 line-clamp-1">{comment.commentText}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-primary-400">
                    <FileText className="w-3 h-3" />
                    <span>{getLocationName(comment)}</span>
                    {comment.elementName && (
                      <>
                        <span>→</span>
                        <span className="text-primary-500">{comment.elementName}</span>
                      </>
                    )}
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-primary-300 flex-shrink-0 mt-1" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
