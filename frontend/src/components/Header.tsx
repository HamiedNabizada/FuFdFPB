import { Link } from 'react-router-dom';
import { FileCode, LogOut, LogIn } from 'lucide-react';
import type { User } from '../App';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 text-gray-900 hover:text-blue-600">
            <FileCode className="w-6 h-6" />
            <span className="font-semibold text-lg">XSD Review Tool</span>
            <span className="text-sm text-gray-500 hidden sm:inline">VDI/VDE 3682</span>
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-gray-600">
                  {user.name}
                </span>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-red-600"
                >
                  <LogOut className="w-4 h-4" />
                  Abmelden
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600"
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
