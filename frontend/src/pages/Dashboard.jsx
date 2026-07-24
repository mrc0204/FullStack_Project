import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isClient = user.role === 'client';

  // State management
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(isClient ? 'my-projects' : 'discover');
  
  // AI matches state for freelancer
  const [aiMatches, setAiMatches] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Form states for new project
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    category: 'Software Development',
    scope: '',
    budget: '',
    deadline: '',
    required_skills: ''
  });
  
  // AI Scoping Assistant states
  const [scopingLoading, setScopingLoading] = useState(false);
  const [scopingQuestions, setScopingQuestions] = useState([]);
  const [scopingAnswers, setScopingAnswers] = useState({ q0: '', q1: '', q2: '' });

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      if (isClient) {
        // Fetch client's own projects
        const res = await axios.get(`/projects?client_id=${user.id}`);
        setProjects(res.data.projects);
      } else {
        // Fetch all open projects
        const res = await axios.get('/projects?status=open');
        setProjects(res.data.projects);
        
        // Fetch AI recommendations
        fetchRecommendations();
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    setAiLoading(true);
    try {
      const res = await axios.get('/ai/matches/freelancer');
      setAiMatches(res.data.matches);
    } catch (err) {
      console.error('Error fetching AI matches:', err);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id]);

  // Handle Search & Filtering
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let url = `/projects?status=open&search=${search}`;
      if (categoryFilter) {
        url += `&category=${categoryFilter}`;
      }
      const res = await axios.get(url);
      setProjects(res.data.projects);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Run AI Scoping Advisor (Gemini)
  const handleGetScopingAdvice = async () => {
    if (!newProject.title || !newProject.scope) {
      alert('Please fill out the Title and description/scope first.');
      return;
    }
    setScopingLoading(true);
    try {
      const res = await axios.post('/ai/scoping-questions', {
        title: newProject.title,
        category: newProject.category,
        scope: newProject.scope,
        budget: newProject.budget,
        required_skills: newProject.required_skills.split(',').map(s => s.trim())
      });
      setScopingQuestions(res.data.questions || []);
    } catch (err) {
      console.error('Scoping advisor error:', err);
      alert('Scoping helper failed. Using backup scoping questions.');
      setScopingQuestions([
        "What specific deliverables do you expect by the end of the project?",
        "Are there any external integrations (e.g. Stripe, Twilio) that should be accounted for?",
        "What is your target timeframe or deadline for key project milestones?"
      ]);
    } finally {
      setScopingLoading(false);
    }
  };

  // Compile scoping answers into project description
  const handleApplyScopingAdvice = () => {
    let clarifiedDetails = `\n\n--- Clarified Requirements ---\n`;
    scopingQuestions.forEach((q, i) => {
      const answer = scopingAnswers[`q${i}`];
      if (answer) {
        clarifiedDetails += `Q: ${q}\nA: ${answer}\n\n`;
      }
    });

    setNewProject({
      ...newProject,
      scope: newProject.scope + clarifiedDetails
    });
    setScopingQuestions([]);
    setScopingAnswers({ q0: '', q1: '', q2: '' });
  };

  // Project Creation Submit
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.title || !newProject.budget) {
      alert('Title and budget are required.');
      return;
    }

    try {
      const payload = {
        ...newProject,
        required_skills: newProject.required_skills.split(',').map(s => s.trim()).filter(Boolean)
      };

      await axios.post('/projects', payload);
      setShowCreateModal(false);
      setNewProject({
        title: '',
        category: 'Software Development',
        scope: '',
        budget: '',
        deadline: '',
        required_skills: ''
      });
      fetchData();
    } catch (err) {
      console.error('Failed to create project:', err);
      alert(err.response?.data?.error || 'Project creation failed');
    }
  };

  return (
    <div>
      {/* Upper header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>
            {isClient ? 'Client Workspace' : 'Freelancer Marketplace'}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isClient 
              ? 'Define detailed briefs, evaluate matching applicants, and monitor milestone payments.'
              : 'Browse open contracts, analyze AI-guided matches, and pitch custom proposal structures.'}
          </p>
        </div>
        {isClient && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + Post New Project
          </button>
        )}
      </div>

      {/* Tabs */}
      {!isClient && (
        <div className="tab-container">
          <button 
            className={`tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            Discover Opportunities
          </button>
          <button 
            className={`tab-btn ${activeTab === 'ai-recs' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('ai-recs');
              fetchRecommendations();
            }}
          >
            ✧ Recommended for You
          </button>
        </div>
      )}

      {/* Discover Opportunities View */}
      {(isClient || activeTab === 'discover') && (
        <div className="dashboard-grid">
          {/* Main Column */}
          <div>
            {!isClient && (
              <form onSubmit={handleSearchSubmit} className="search-container">
                <input
                  type="text"
                  placeholder="Search by keywords, skills..."
                  className="form-control"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select 
                  className="form-control" 
                  style={{ maxWidth: '200px' }}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="Software Development">Software Development</option>
                  <option value="Design & Creative">Design & Creative</option>
                  <option value="Writing & Marketing">Writing & Marketing</option>
                  <option value="Data & Admin">Data & Admin</option>
                </select>
                <button type="submit" className="btn btn-primary">Search</button>
              </form>
            )}

            {loading ? (
              <div className="spinner" />
            ) : projects.length === 0 ? (
              <div className="empty-state">
                <h3>No project briefs found</h3>
                <p>Try refining your search terms or wait for clients to post new opportunities.</p>
              </div>
            ) : (
              <div className="list-container">
                {projects.map((proj) => (
                  <div key={proj.id} className="glass-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/project/${proj.id}`)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '1.25rem' }}>{proj.title}</h3>
                      <span className={`badge ${proj.status === 'open' ? 'badge-success' : 'badge-info'}`}>
                        {proj.status}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.5rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {proj.scope}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div className="tag-container">
                        {proj.required_skills.map((s, idx) => (
                          <span key={idx} className="tag">{s}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <span>Budget: <strong style={{ color: 'var(--text-primary)' }}>${proj.budget}</strong></span>
                        {proj.deadline && <span>Deadline: <strong style={{ color: 'var(--text-primary)' }}>{proj.deadline}</strong></span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column / Marketplace Stats */}
          <div className="glass-card" style={{ height: 'fit-content' }}>
            <h3 style={{ marginBottom: '1rem' }}>Marketplace Guide</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Welcome back! Use Gemini AI tools to improve outcomes:
            </p>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>Clients can ask AI to refine scope specifications.</li>
              <li>Freelancers receive customized proposals and milestones structures.</li>
              <li>AI computes matches comparing rate, availability, and experience.</li>
            </ul>
          </div>
        </div>
      )}

      {/* AI Recommendations View (Freelancer Only) */}
      {!isClient && activeTab === 'ai-recs' && (
        <div>
          {aiLoading ? (
            <div className="spinner" />
          ) : aiMatches.length === 0 ? (
            <div className="empty-state">
              <h3>No matched recommendations found</h3>
              <p>Try updating your profile skills and rate on the Profile page to get matched.</p>
            </div>
          ) : (
            <div className="list-container">
              {aiMatches.map((match) => (
                <div key={match.id} className="glass-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/project/${match.project_id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem' }}>{match.project_title}</h3>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Category: {match.project_category}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Compatibility:</span>
                      <div className="badge badge-info" style={{ fontSize: '1rem', padding: '0.4rem 0.8rem', fontWeight: 'bold' }}>
                        {match.match_score}%
                      </div>
                    </div>
                  </div>
                  <div className="match-meter-container" style={{ margin: '0 0 1rem 0' }}>
                    <div style={{ flex: 1 }}>
                      <h4 className="ai-label" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>✦ AI Explanation</h4>
                      <ul className="match-reasons" style={{ margin: 0 }}>
                        {match.match_explanation.map((item, idx) => (
                          <li key={idx} style={{ fontSize: '0.85rem' }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Client: {match.client_name}</span>
                    <span style={{ fontSize: '0.9rem' }}>Budget: <strong>${match.project_budget}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post Project Modal (Client Only) */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: scopingQuestions.length > 0 ? '700px' : '550px' }}>
            <h2>Create New Project Brief</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Publish details of your workspace opportunity for freelancer bids.
            </p>

            {scopingQuestions.length === 0 ? (
              <form onSubmit={handleCreateProject}>
                <div className="form-group">
                  <label className="form-label">Project Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Full-Stack E-Commerce Website"
                    value={newProject.title}
                    onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-control"
                      value={newProject.category}
                      onChange={(e) => setNewProject({ ...newProject, category: e.target.value })}
                    >
                      <option value="Software Development">Software Development</option>
                      <option value="Design & Creative">Design & Creative</option>
                      <option value="Writing & Marketing">Writing & Marketing</option>
                      <option value="Data & Admin">Data & Admin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Required Skills (comma separated)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="React, Node.js, SQLite"
                      value={newProject.required_skills}
                      onChange={(e) => setNewProject({ ...newProject, required_skills: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Scope & Description *</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="Describe milestones, expectations, features..."
                    value={newProject.scope}
                    onChange={(e) => setNewProject({ ...newProject, scope: e.target.value })}
                    required
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ marginTop: '0.5rem', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                    onClick={handleGetScopingAdvice}
                    disabled={scopingLoading}
                  >
                    {scopingLoading ? 'Generating advice...' : '✦ Let Gemini Scoping Helper Clarify Details'}
                  </button>
                </div>

                <div className="form-row" style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Budget ($) *</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="500"
                      value={newProject.budget}
                      onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deadline / Duration</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 4 Weeks, 2026-08-30"
                      value={newProject.deadline}
                      onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Publish Brief
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>
                  ✦ Scoping Helper - Clarification Questions
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  Gemini has analyzed your project brief. Please answer these clarification questions to generate a more structured listing:
                </p>

                {scopingQuestions.map((q, idx) => (
                  <div key={idx} className="form-group">
                    <label className="form-label">{q}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={scopingAnswers[`q${idx}`] || ''}
                      onChange={(e) => setScopingAnswers({ ...scopingAnswers, [`q${idx}`]: e.target.value })}
                      placeholder="Your answer..."
                    />
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setScopingQuestions([])}>
                    Back
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleApplyScopingAdvice}>
                    Apply Answers to Scope
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
