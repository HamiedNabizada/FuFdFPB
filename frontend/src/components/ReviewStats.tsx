import { useState, useEffect } from 'react';
import { MessageCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface Stats {
  total: number;
  open: number;
  resolved: number;
  progress: number;
}

export default function ReviewStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="h-6 bg-primary-100 rounded w-1/3 mb-4"></div>
        <div className="h-16 bg-primary-50 rounded"></div>
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return null; // Keine Statistik anzeigen wenn keine Kommentare
  }

  return (
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

        <div className="bg-amber-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-2xl font-bold text-amber-700">{stats.open}</span>
          </div>
          <span className="text-xs text-amber-600 uppercase tracking-wide">Offen</span>
        </div>

        <div className="bg-accent-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-accent-500" />
            <span className="text-2xl font-bold text-accent-700">{stats.resolved}</span>
          </div>
          <span className="text-xs text-accent-600 uppercase tracking-wide">Erledigt</span>
        </div>
      </div>
    </div>
  );
}
