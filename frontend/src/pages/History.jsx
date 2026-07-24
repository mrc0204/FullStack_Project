import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function History() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isClient = user.role === 'client';

  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/proposals/history');
      setProposals(res.data.proposals || []);
    } catch (err) {
      console.error('Error fetching proposal history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const getFilteredProposals = () => {
    if (filterStatus === 'all') return proposals;
    if (filterStatus === 'active') return proposals.filter(p => p.status === 'accepted' && p.project_status === 'in_progress');
    if (filterStatus === 'completed') return proposals.filter(p => p.status === 'accepted' && p.project_status === 'completed');
    if (filterStatus === 'pending') return proposals.filter(p => ['pending', 'shortlisted'].includes(p.status));
    if (filterStatus === 'rejected') return proposals.filter(p => p.status === 'rejected');
    return proposals;
  };

  if (loading) {
    return <div className="spinner" />;
  }

  const filtered = getFilteredProposals();

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Contract & Proposal History</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Review your archived applications, currently active contracts, and completed projects.
        </p>
      </div>

      {/* Filters */}
      <div className="tab-container">
        <button 
          className={`tab-btn ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          All Opportunities ({proposals.length})
        </button>
        <button 
          className={`tab-btn ${filterStatus === 'active' ? 'active' : ''}`}
          onClick={() => setFilterStatus('active')}
        >
          Active Contracts ({proposals.filter(p => p.status === 'accepted' && p.project_status === 'in_progress').length})
        </button>
        <button 
          className={`tab-btn ${filterStatus === 'completed' ? 'active' : ''}`}
          onClick={() => setFilterStatus('completed')}
        >
          Completed Contracts ({proposals.filter(p => p.status === 'accepted' && p.project_status === 'completed').length})
        </button>
        <button 
          className={`tab-btn ${filterStatus === 'pending' ? 'active' : ''}`}
          onClick={() => setFilterStatus('pending')}
        >
          Pending / Shortlisted ({proposals.filter(p => ['pending', 'shortlisted'].includes(p.status)).length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No records found</h3>
          <p>You do not have any contracts or proposals fitting this status filter.</p>
        </div>
      ) : (
        <div className="list-container">
          {filtered.map((item) => (
            <div 
              key={item.id} 
              className="glass-card" 
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/project/${item.project_id}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem' }}>{item.project_title}</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {isClient ? `Freelancer applicant: ${item.freelancer_name}` : `Client: ${item.client_name}`}
                  </span>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  {item.status === 'accepted' ? (
                    <span className={`badge ${item.project_status === 'completed' ? 'badge-success' : 'badge-info'}`}>
                      {item.project_status === 'completed' ? 'Completed Contract' : 'Active Contract'}
                    </span>
                  ) : (
                    <span className={`badge ${item.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                      Proposal {item.status}
                    </span>
                  )}
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.5rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.cover_letter}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Applied on: {new Date(item.created_at).toLocaleDateString()}
                </span>
                <div style={{ fontSize: '0.9rem' }}>
                  <span>Bid Amount: <strong>${item.bid_amount}</strong></span>
                  {item.estimated_duration && (
                    <span style={{ marginLeft: '1rem' }}>Duration: <strong>{item.estimated_duration}</strong></span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
