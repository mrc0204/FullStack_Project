import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <span>✧</span> AI-Lancer
        </Link>
        <nav className="navbar-links">
          {token ? (
            <>
              <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
                Dashboard
              </Link>
              <Link to="/matching" className={`nav-link ${isActive('/matching') ? 'active' : ''}`}>
                AI Matching
              </Link>
              <Link to="/history" className={`nav-link ${isActive('/history') ? 'active' : ''}`}>
                Contracts & History
              </Link>
              <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`}>
                Profile
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '1rem' }}>
                <span className={`badge ${user.role === 'client' ? 'badge-info' : 'badge-success'}`}>
                  {user.role}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {user.username}
                </span>
                <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className={`nav-link ${isActive('/login') ? 'active' : ''}`}>
                Login
              </Link>
              <Link to="/register" className={`nav-link ${isActive('/register') ? 'active' : ''}`}>
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
