import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, CheckCircle, Clock, TrendingUp, X, FileText, ExternalLink } from 'lucide-react';

interface Stats {
  total: number;
  open: number;
  resolved: number;
  progress: number;
}

interface CommentItem {
  id: number;
  commentText: string;
  elementName: string | null;
  xpath: string | null;
  status: 'open' | 'resolved';
  createdAt: string;
  author: { name: string } | null;
  authorName: string | null;
  schema: { id: number; name: string; version: string; groupId: number | null } | null;
  group: { id: number; name: string; version: string } | null;
  replies: { id: number }[];
}

export default function ReviewStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<'open' | 'resolved' | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/comments/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (status: 'open' | 'resolved') => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/comments/by-status/${status}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCardClick = (status: 'open' | 'resolved') => {
    setShowModal(status);
    fetchComments(status);
  };

  const closeModal = () => {
    setShowModal(null);
    setComments([]);
  };

  const getCommentLink = (comment: CommentItem) => {
    if (comment.schema?.groupId) {
      return `/group/${comment.schema.groupId}`;
    } else if (comment.schema) {
      return `/schema/${comment.schema.id}`;
    } else if (comment.group) {
      return `/group/${comment.group.id}`;
    }
    return '#';
  };

  const getCommentLocation = (comment: CommentItem) => {
    if (comment.group && !comment.schema) {
      return `${comment.group.name} v${comment.group.version}`;
    }
    if (comment.schema) {
      return `${comment.schema.name} v${comment.schema.version}`;
    }
    return 'Unbekannt';
  };

  if (loading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="h-6 bg-primary-100 rounded w-1/3 mb-4"></div>
        <div className="h-16 bg-primary-50 rounded"></div>
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return null;
  }

  return (
    <>
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-primary-900">Review-Fortschritt</h2>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-primary-600 font-medium">{stats.progress}% abgeschlossen</span>
            <span className="text-primary-400">{stats.resolved} von {stats.total}</span>
          </div>
          <div className="h-3 bg-primary-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-500 to-accent-600 rounded-full transition-all duration-500"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-primary-50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <MessageCircle className="w-4 h-4 text-primary-500" />
              <span className="text-2xl font-bold text-primary-900">{stats.total}</span>
            </div>
            <span className="text-xs text-primary-500 uppercase tracking-wide">Gesamt</span>
          </div>

          <button
            onClick={() => handleCardClick('open')}
            className="bg-amber-50 hover:bg-amber-100 rounded-lg p-4 text-center transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-2xl font-bold text-amber-700">{stats.open}</span>
            </div>
            <span className="text-xs text-amber-600 uppercase tracking-wide">Offen</span>
          </button>

          <button
            onClick={() => handleCardClick('resolved')}
            className="bg-accent-50 hover:bg-accent-100 rounded-lg p-4 text-center transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-accent-500" />
              <span className="text-2xl font-bold text-accent-700">{stats.resolved}</span>
            </div>
            <span className="text-xs text-accent-600 uppercase tracking-wide">Erledigt</span>
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-primary-100">
              <h3 className="font-semibold text-primary-900 flex items-center gap-2">
                {showModal === 'open' ? (
                  <>
                    <Clock className="w-5 h-5 text-amber-500" />
                    Offene Kommentare
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 text-accent-500" />
                    Erledigte Kommentare
                  </>
                )}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 hover:bg-primary-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-primary-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center text-primary-500 py-8">Keine Kommentare vorhanden.</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <Link
                      key={comment.id}
                      to={getCommentLink(comment)}
                      onClick={closeModal}
                      className="block p-4 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-primary-400 flex-shrink-0" />
                            <span className="text-sm font-medium text-primary-700 truncate">
                              {getCommentLocation(comment)}
                            </span>
                            {comment.elementName && (
                              <span className="text-xs bg-primary-200 text-primary-700 px-1.5 py-0.5 rounded">
                                {comment.elementName}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-primary-800 line-clamp-2">{comment.commentText}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-primary-500">
                            <span>{comment.author?.name || comment.authorName}</span>
                            <span>{new Date(comment.createdAt).toLocaleDateString('de-DE')}</span>
                            {comment.replies.length > 0 && (
                              <span>{comment.replies.length} Antwort{comment.replies.length !== 1 ? 'en' : ''}</span>
                            )}
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-primary-400 flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
