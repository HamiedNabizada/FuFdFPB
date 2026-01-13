import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Reply, Clock, FileText, ExternalLink } from 'lucide-react';
import { CATEGORIES, type CommentCategory } from '../lib/categories';

interface Activity {
  type: 'comment' | 'reply';
  id: number;
  text: string;
  elementName: string | null;
  xpath: string | null;
  category: CommentCategory | null;
  authorName: string;
  createdAt: string;
  schema: { id: number; name: string; version: string; groupId: number | null } | null;
  group: { id: number; name: string; version: string } | null;
}

interface RecentActivityProps {
  embedded?: boolean;
}

export default function RecentActivity({ embedded = false }: RecentActivityProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/comments/recent-activity?limit=8');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityLink = (activity: Activity) => {
    const xpathParam = activity.xpath ? `?xpath=${encodeURIComponent(activity.xpath)}` : '';
    const schemaParam = activity.schema?.id ? `&schemaId=${activity.schema.id}` : '';

    if (activity.schema?.groupId) {
      return `/group/${activity.schema.groupId}${xpathParam}${schemaParam}`;
    } else if (activity.schema) {
      return `/schema/${activity.schema.id}${xpathParam}`;
    } else if (activity.group) {
      return `/group/${activity.group.id}`;
    }
    return '#';
  };

  const getLocationName = (activity: Activity) => {
    if (activity.group && !activity.schema) {
      return activity.group.name;
    }
    if (activity.schema) {
      return activity.schema.name;
    }
    return 'Unbekannt';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
    return date.toLocaleDateString('de-DE');
  };

  if (loading) {
    const skeleton = (
      <div className="animate-pulse">
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-primary-50 rounded"></div>
          ))}
        </div>
      </div>
    );

    if (embedded) return skeleton;

    return (
      <div className="card p-6">
        <div className="h-6 bg-primary-100 rounded w-1/3 mb-4"></div>
        {skeleton}
      </div>
    );
  }

  if (activities.length === 0) {
    if (embedded) {
      return <p className="text-center text-primary-400 py-4">Noch keine Aktivitäten</p>;
    }
    return null;
  }

  const content = (
    <div className="space-y-3">
        {activities.map((activity) => (
          <Link
            key={`${activity.type}-${activity.id}`}
            to={getActivityLink(activity)}
            className="block p-3 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors group"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`p-1.5 rounded-full flex-shrink-0 ${
                activity.type === 'comment' ? 'bg-primary-200' : 'bg-accent-100'
              }`}>
                {activity.type === 'comment' ? (
                  <MessageCircle className="w-3.5 h-3.5 text-primary-600" />
                ) : (
                  <Reply className="w-3.5 h-3.5 text-accent-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-primary-800">{activity.authorName}</span>
                  <span className="text-primary-400">
                    {activity.type === 'comment' ? 'kommentierte' : 'antwortete'}
                  </span>
                  {activity.category && CATEGORIES[activity.category] && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${CATEGORIES[activity.category].bgColor} ${CATEGORIES[activity.category].color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${CATEGORIES[activity.category].dotColor}`}></span>
                      {CATEGORIES[activity.category].label}
                    </span>
                  )}
                </div>

                <p className="text-sm text-primary-600 line-clamp-1 mt-0.5">
                  "{activity.text}"
                </p>

                <div className="flex items-center gap-3 mt-1.5 text-xs text-primary-400">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {getLocationName(activity)}
                    {activity.elementName && (
                      <span className="text-primary-500">→ {activity.elementName}</span>
                    )}
                  </span>
                  <span>{formatTimeAgo(activity.createdAt)}</span>
                </div>
              </div>

              {/* Arrow */}
              <ExternalLink className="w-4 h-4 text-primary-300 group-hover:text-primary-500 flex-shrink-0 mt-1" />
            </div>
          </Link>
        ))}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-primary-900">Letzte Aktivität</h2>
      </div>
      {content}
    </div>
  );
}
