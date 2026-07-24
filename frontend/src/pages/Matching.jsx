import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Matching() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isClient = user.role === 'client';

  // Client states
  const [myProjects, setMyProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectMatches, setProjectMatches] = useState([]);
  const [clientLoading, setClientLoading] = useState(false);

  // Freelancer states
  const [freelancerMatches, setFreelancerMatches] = useState([]);
  const [freelancerLoading, setFreelancerLoading] = useState(true);

  // Fetch client projects
  const fetchClientProjects = async () => {
    try {
      const res = await axios.get(`/projects?client_id=${user.id}`);
      setMyProjects(res.data.projects || []);
      if (res.data.projects?.length > 0) {
        setSelectedProjectId(res.data.projects[0].id.toString());
      }
    } catch (err) {
      console.error('Error fetching client projects:', err);
    }
  };

  // Fetch match details for a specific client project
  const fetchProjectMatches = async (projectId) => {
    if (!projectId) return;
    setClientLoading(true);
    try {
      const res = await axios.get(`/ai/matches/project/${projectId}`);
      setProjectMatches(res.data.matches || []);
    } catch (err) {
      console.error('Error fetching project matches:', err);
    } finally {
      setClientLoading(false);
    }
  };

  // Fetch matches for logged-in freelancer
  const fetchFreelancerMatches = async () => {
    setFreelancerLoading(true);
    try {
      const res = await axios.get('/ai/matches/freelancer');
      setFreelancerMatches(res.data.matches || []);
    } catch (err) {
      console.error('Error fetching freelancer matches:', err);
    } finally {
      setFreelancerLoading(false);
    }
  };

  useEffect(() => {
    if (isClient) {
      fetchClientProjects();
    } else {
      fetchFreelancerMatches();
    }
  }, []);

  useEffect(() => {
    if (isClient && selectedProjectId) {
      fetchProjectMatches(selectedProjectId);
    }
  }, [selectedProjectId]);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1>✧ AI Project Matching Center</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {isClient 
            ? 'Compare project requirements with freelancer skills, availability, and experience scores.'
            : 'Analyze suitable jobs matched to your profile, budget expectations, and tech stack.'}
        </p>
      </div>

      {isClient ? (
        /* CLIENT VIEW */
        <div>
          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <div className="form-group" style={{ maxWidth: '400px', margin: 0 }}>
              <label className="form-label" htmlFor="projectSelect">Select Project Brief to Review Matches</label>
              <select
                id="projectSelect"
                className="form-control"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">-- Choose a Project --</option>
                {myProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.title} (${p.budget})</option>
                ))}
              </select>
            </div>
          </div>

          {clientLoading ? (
            <div className="spinner" />
          ) : !selectedProjectId ? (
            <div className="empty-state">
              <p>Please select a project brief to inspect compatibility recommendations.</p>
            </div>
          ) : projectMatches.length === 0 ? (
            <div className="empty-state">
              <h3>No match scores analyzed yet</h3>
              <p>AI matches are computed when you click "Calculate AI Compatibility" on bids within the project detail screen.</p>
              <button 
                className="btn btn-primary" 
                style={{ marginTop: '1rem' }}
                onClick={() => navigate(`/project/${selectedProjectId}`)}
              >
                Go to Project details page
              </button>
            </div>
          ) : (
            <div className="list-container">
              {projectMatches.map((m) => (
                <div key={m.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem' }}>{m.freelancer_name}</h3>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Desired Rate: <strong style={{ color: 'var(--text-primary)' }}>${m.rates}/hr</strong> | Availability: <strong style={{ color: 'var(--text-primary)' }}>{m.availability}</strong>
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Match Compatibility:</span>
                      <div className="badge badge-info" style={{ fontSize: '1.1rem', padding: '0.4rem 0.8rem', fontWeight: 'bold' }}>
                        {m.match_score}%
                      </div>
                    </div>
                  </div>

                  <div className="match-meter-container" style={{ margin: 0 }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>Gemini Match Reasoning</h4>
                      <ul className="match-reasons" style={{ margin: 0 }}>
                        {m.match_explanation.map((reason, idx) => (
                          <li key={idx} style={{ fontSize: '0.85rem' }}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Skills Portfolio:</h4>
                    <div className="tag-container" style={{ marginTop: '0.25rem' }}>
                      {m.skills.map((s, idx) => (
                        <span key={idx} className="tag">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => navigate(`/project/${selectedProjectId}`)}>
                      Review Pitch Brief
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* FREELANCER VIEW */
        <div>
          {freelancerLoading ? (
            <div className="spinner" />
          ) : freelancerMatches.length === 0 ? (
            <div className="empty-state">
              <h3>No matched recommendations yet</h3>
              <p>Apply for project briefs or update your profile details to seed AI match scoring calculations.</p>
            </div>
          ) : (
            <div className="list-container">
              {freelancerMatches.map((m) => (
                <div key={m.id} className="glass-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/project/${m.project_id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem' }}>{m.project_title}</h3>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Project Owner: {m.client_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Suitability Index:</span>
                      <div className="badge badge-info" style={{ fontSize: '1rem', padding: '0.4rem 0.8rem', fontWeight: 'bold' }}>
                        {m.match_score}%
                      </div>
                    </div>
                  </div>

                  <div className="match-meter-container" style={{ margin: '0 0 1rem 0' }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>AI Matching Explanation</h4>
                      <ul className="match-reasons" style={{ margin: 0 }}>
                        {m.match_explanation.map((reason, idx) => (
                          <li key={idx} style={{ fontSize: '0.85rem' }}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Target Budget: <strong>${m.project_budget}</strong></span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Deadline: {m.project_deadline || 'None'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
