import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'freelancer' // default role
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { username, email, password, role } = formData;
    if (!username || !email || !password || !role) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post('/auth/register', formData);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Registration failed. Try a different username/email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="glass-card auth-card">
        <div className="auth-header">
          <h2 className="auth-title">Get Started</h2>
          <p className="auth-subtitle">Create your account on the marketplace</p>
        </div>

        {error && (
          <div className="badge badge-danger" style={{ display: 'block', width: '100%', padding: '0.75rem', marginBottom: '1.25rem', borderRadius: '8px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              type="text"
              name="username"
              id="username"
              className="form-control"
              placeholder="Pick a unique username"
              value={formData.username}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              type="email"
              name="email"
              id="email"
              className="form-control"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              type="password"
              name="password"
              id="password"
              className="form-control"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">I want to...</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <label 
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${formData.role === 'freelancer' ? 'var(--sage-dark)' : 'var(--border)'}`,
                  background: formData.role === 'freelancer' ? 'rgba(156, 167, 99, 0.15)' : 'transparent',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value="freelancer"
                  checked={formData.role === 'freelancer'}
                  onChange={handleChange}
                  style={{ display: 'none' }}
                />
                Work as Freelancer
              </label>
              
              <label 
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${formData.role === 'client' ? 'var(--sage-dark)' : 'var(--border)'}`,
                  background: formData.role === 'client' ? 'rgba(156, 167, 99, 0.15)' : 'transparent',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value="client"
                  checked={formData.role === 'client'}
                  onChange={handleChange}
                  style={{ display: 'none' }}
                />
                Hire Freelancers
              </label>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: '600' }}>
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
