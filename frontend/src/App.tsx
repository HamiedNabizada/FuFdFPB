import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import SchemaPage from './pages/SchemaPage';
import SchemaGroupPage from './pages/SchemaGroupPage';
import LoginPage from './pages/LoginPage';

export interface User {
  id: number;
  email: string;
  name: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) setUser(data.user);
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (user: User, token: string) => {
    localStorage.setItem('token', token);
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={handleLogout} />
      <main>
        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/schema/:id" element={<SchemaPage user={user} />} />
          <Route path="/group/:groupId" element={<SchemaGroupPage user={user} />} />
          <Route path="/group/:groupId/schema/:schemaId" element={<SchemaGroupPage user={user} />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
