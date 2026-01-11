import { useState } from 'react';
import { MessageCircle, Check, Reply, Trash2 } from 'lucide-react';
import type { User } from '../App';

export interface CommentReply {
  id: number;
  replyText: string;
  authorName: string | null;
  author: { name: string } | null;
  createdAt: string;
}

export interface Comment {
  id: number;
  xpath: string;
  elementName: string | null;
  commentText: string;
  authorName: string | null;
  author: { name: string } | null;
  status: 'open' | 'resolved';
  createdAt: string;
  replies: CommentReply[];
}

interface CommentListProps {
  comments: Comment[];
  user: User | null;
  onResolve: (commentId: number) => void;
  onReply: (commentId: number, text: string, authorName?: string) => void;
  onDelete: (commentId: number) => void;
}

export default function CommentList({
  comments,
  user,
  onResolve,
  onReply,
  onDelete,
}: CommentListProps) {
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyAuthor, setReplyAuthor] = useState('');

  const handleSubmitReply = (commentId: number) => {
    if (!replyText.trim()) return;
    if (!user && !replyAuthor.trim()) return;

    onReply(commentId, replyText, user ? undefined : replyAuthor);
    setReplyText('');
    setReplyAuthor('');
    setReplyingTo(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAuthorName = (comment: Comment | CommentReply) => {
    return comment.author?.name || comment.authorName || 'Anonym';
  };

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Noch keine Kommentare</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className={`border rounded-lg p-4 ${
            comment.status === 'resolved' ? 'bg-green-50 border-green-200' : 'bg-white'
          }`}
        >
          {/* Comment Header */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="font-medium text-gray-900">{getAuthorName(comment)}</span>
              <span className="text-xs text-gray-500 ml-2">{formatDate(comment.createdAt)}</span>
            </div>
            {comment.status === 'resolved' && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                Erledigt
              </span>
            )}
          </div>

          {/* Comment Text */}
          <p className="text-gray-700 text-sm mb-3">{comment.commentText}</p>

          {/* Replies */}
          {comment.replies.length > 0 && (
            <div className="ml-4 border-l-2 border-gray-200 pl-4 space-y-3 mb-3">
              {comment.replies.map((reply) => (
                <div key={reply.id}>
                  <div className="text-xs text-gray-500 mb-1">
                    <span className="font-medium text-gray-700">{getAuthorName(reply)}</span>
                    <span className="ml-2">{formatDate(reply.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{reply.replyText}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply Form */}
          {replyingTo === comment.id && (
            <div className="mt-3 space-y-2">
              {!user && (
                <input
                  type="text"
                  placeholder="Ihr Name"
                  value={replyAuthor}
                  onChange={(e) => setReplyAuthor(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-3 py-1.5"
                />
              )}
              <textarea
                placeholder="Antwort schreiben..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleSubmitReply(comment.id)}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                >
                  Antworten
                </button>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-xs text-gray-600 px-3 py-1.5 hover:text-gray-800"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {replyingTo !== comment.id && (
            <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setReplyingTo(comment.id)}
                className="text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1"
              >
                <Reply className="w-3.5 h-3.5" />
                Antworten
              </button>
              {comment.status === 'open' && (
                <button
                  onClick={() => onResolve(comment.id)}
                  className="text-xs text-gray-600 hover:text-green-600 flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Als erledigt markieren
                </button>
              )}
              {user && (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="text-xs text-gray-600 hover:text-red-600 flex items-center gap-1 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
