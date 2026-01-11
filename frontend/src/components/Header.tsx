import { Link } from 'react-router-dom';
import { LogOut, LogIn, User as UserIcon } from 'lucide-react';
import type { User } from '../App';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-primary-900 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-white text-lg leading-tight">
                Schema Review
              </span>
              <span className="text-xs text-primary-300 hidden sm:block">
                VDI/VDE 3682 Fachausschuss
              </span>
            </div>
          </Link>

          {/* User Section */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
                  <UserIcon className="w-4 h-4 text-primary-300" />
                  <span className="text-sm text-white font-medium">
                    {user.name}
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-200
                           hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Abmelden</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                         bg-white text-primary-900 rounded-lg
                         hover:bg-primary-50 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Anmelden
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
