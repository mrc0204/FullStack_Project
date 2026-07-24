import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isClient = user.role === 'client';

  // State details
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Freelancer proposal form
  const [coverLetter, setCoverLetter] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [hasApplied, setHasApplied] = useState(false);
  const [myProposal, setMyProposal] = useState(null);

  // Freelancer AI Outline helper states
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiProposalDraft, setAiProposalDraft] = useState(null);

  // Client hiring modal/state
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [customMilestones, setCustomMilestones] = useState([]);

  // Client AI Match score caching states
  const [computingMatchId, setComputingMatchId] = useState(null);
  const [matchData, setMatchData] = useState({}); // proposalId -> {score, explanation}

  // Milestone submission state (Freelancer)
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [submissionNotes, setSubmissionNotes] = useState('');

  // Milestone review state (Client)
  const [selectedReviewMilestone, setSelectedReviewMilestone] = useState(null);
  const [reviewAction, setReviewAction] = useState('approve'); // approve or request_revision
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewDrafts, setAiReviewDrafts] = useState(null);

  const fetchProjectDetails = async () => {
    setLoading(true);
    try {
      // 1. Get project and its milestones
      const res = await axios.get(`/projects/${id}`);
      setProject(res.data.project);
      setMilestones(res.data.milestones || []);

      // 2. Fetch proposals or applications
      const propRes = await axios.get(`/proposals/project/${id}`);
      setProposals(propRes.data.proposals);

      // Check if freelancer already applied
      if (!isClient) {
        const found = propRes.data.proposals.find(p => p.freelancer_id === user.id);
        if (found) {
          setHasApplied(true);
          setMyProposal(found);
        }
      } else {
        // Pre-fetch matches saved in database
        const matchRes = await axios.get(`/ai/matches/project/${id}`);
        const mObj = {};
        matchRes.data.matches.forEach(m => {
          mObj[m.freelancer_id] = {
            score: m.match_score,
            explanation: m.match_explanation
          };
        });
        setMatchData(mObj);
      }
    } catch (err) {
      console.error('Error fetching project detail details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  // AI draft proposal helper (Freelancer)
  const handleGetAiDraftProposal = async () => {
    setAiDraftLoading(true);
    try {
      const res = await axios.post('/ai/draft-proposal', { project_id: id });
      setAiProposalDraft(res.data);
      setCoverLetter(res.data.cover_letter);
      setBidAmount(project.budget.toString());
      setEstimatedDuration("4 weeks");
      // Seed default milestones for submission later
      const seedMilestones = res.data.milestones.map(m => ({
        title: m.title,
        description: m.description,
        budget_percentage: m.budget_percentage,
        deadline: m.deadline
      }));
      setCustomMilestones(seedMilestones);
    } catch (err) {
      console.error(err);
      alert('Failed to generate AI proposal outline.');
    } finally {
      setAiDraftLoading(false);
    }
  };

  // Submit Proposal (Freelancer)
  const handleSubmitProposal = async (e) => {
    e.preventDefault();
    if (!coverLetter || !bidAmount) {
      alert('Cover letter and bid amount are required.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post('/proposals', {
        project_id: id,
        cover_letter: coverLetter,
        bid_amount: parseFloat(bidAmount),
        estimated_duration: estimatedDuration
      });
      alert('Proposal submitted successfully!');
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to submit proposal.');
    } finally {
      setSubmitting(false);
    }
  };

  // Analyze Freelancer Match (Client)
  const handleAnalyzeMatch = async (freelancerId) => {
    setComputingMatchId(freelancerId);
    try {
      const res = await axios.post('/ai/match', {
        project_id: id,
        freelancer_id: freelancerId
      });
      setMatchData({
        ...matchData,
        [freelancerId]: {
          score: res.data.score,
          explanation: res.data.explanation
        }
      });
    } catch (err) {
      console.error(err);
      alert('AI Match analysis failed.');
    } finally {
      setComputingMatchId(null);
    }
  };

  // Change Proposal Status (Client)
  const handleUpdateProposalStatus = async (proposalId, status) => {
    try {
      await axios.put(`/proposals/${proposalId}/status`, { status });
      alert(`Proposal status updated to ${status}.`);
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      alert('Failed to update status.');
    }
  };

  // Open Hire flow Dialog (Client)
  const handleOpenHireModal = (proposal) => {
    setSelectedProposal(proposal);
    // Use either the proposal-derived AI milestones or set standard default milestones
    if (aiProposalDraft?.milestones) {
      setCustomMilestones(aiProposalDraft.milestones);
    } else {
      setCustomMilestones([
        { title: 'Milestone 1: Kickoff & Layouts', description: 'Wireframes and base codebase creation.', budget_percentage: 30, deadline: 'Week 1' },
        { title: 'Milestone 2: Main Logic Build', description: 'Functional APIs and schema connections.', budget_percentage: 50, deadline: 'Week 3' },
        { title: 'Milestone 3: Deployment & Review', description: 'Polishing layout, fixing bugs, and final signoff.', budget_percentage: 20, deadline: 'Week 4' }
      ]);
    }
    setShowHireModal(true);
  };

  // Complete Hire (Client)
  const handleConfirmHire = async () => {
    setSubmitting(true);
    try {
      await axios.put(`/proposals/${selectedProposal.id}/status`, {
        status: 'accepted',
        milestones: customMilestones
      });
      alert('Freelancer hired successfully and contract activated!');
      setShowHireModal(false);
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      alert('Hiring process failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Freelancer Milestone Submission
  const handleSubmitMilestoneWork = async (e) => {
    e.preventDefault();
    if (!submissionNotes) {
      alert('Please fill out deliverable description notes.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`/milestones/${selectedMilestone.id}/submit`, {
        submission_notes: submissionNotes
      });
      alert('Milestone deliverables submitted successfully!');
      setSelectedMilestone(null);
      setSubmissionNotes('');
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      alert('Milestone submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // AI Milestone review assistant (Client)
  const handleGetAiReviewDrafts = async (milestoneId) => {
    setAiReviewLoading(true);
    try {
      const res = await axios.post('/ai/milestone-review-drafts', { milestone_id: milestoneId });
      setAiReviewDrafts(res.data);
      // Auto-set the feedback box
      setReviewFeedback(reviewAction === 'approve' ? res.data.approval_draft : res.data.revision_draft);
    } catch (err) {
      console.error(err);
      alert('AI response draft generation failed.');
    } finally {
      setAiReviewLoading(false);
    }
  };

  // Submit Milestone Review (Client)
  const handleReviewMilestone = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`/milestones/${selectedReviewMilestone.id}/review`, {
        action: reviewAction,
        feedback: reviewFeedback
      });
      alert(`Milestone status updated successfully.`);
      setSelectedReviewMilestone(null);
      setReviewFeedback('');
      setAiReviewDrafts(null);
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      alert('Milestone review failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="spinner" />;
  }

  if (!project) {
    return (
      <div className="empty-state">
        <h3>Project not found</h3>
        <p>This project listing may have been deleted or does not exist.</p>
      </div>
    );
  }

  // Find accepted freelancer if contract is in progress
  const acceptedProposal = proposals.find(p => p.status === 'accepted');

  return (
    <div>
      {/* Project Brief Info */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="badge badge-info" style={{ marginBottom: '0.5rem' }}>{project.category}</span>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>{project.title}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Published by client: <strong>{project.client_name}</strong> | Status: <strong style={{ textTransform: 'capitalize' }}>{project.status}</strong>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Project Budget</span>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--success)' }}>${project.budget}</span>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--border-color)', margin: '1.5rem 0' }} />

        <div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Project Scope & Details</h3>
          <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{project.scope}</p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '1.5rem' }}>
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Required Skills</h4>
            <div className="tag-container" style={{ marginTop: '0.25rem' }}>
              {project.required_skills.map((s, idx) => (
                <span key={idx} className="tag">{s}</span>
              ))}
            </div>
          </div>
          {project.deadline && (
            <div>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Target Deadline</h4>
              <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>{project.deadline}</p>
            </div>
          )}
        </div>
      </div>

      {/* FREELANCER ACTIONS */}
      {!isClient && (
        <div>
          {/* Status: Open - Applying Flow */}
          {project.status === 'open' && (
            <div className="glass-card">
              {hasApplied ? (
                <div>
                  <h2 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Your Proposal Status</h2>
                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                      <span className={`badge ${
                        myProposal.status === 'accepted' ? 'badge-success' :
                        myProposal.status === 'rejected' ? 'badge-danger' : 'badge-warning'
                      }`}>
                        {myProposal.status}
                      </span>
                    </div>
                    <div>
                      <span>Your bid amount: <strong>${myProposal.bid_amount}</strong></span>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Cover Letter Submitted:</h4>
                    <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', background: 'var(--bg-cream)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      {myProposal.cover_letter}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2>Submit Proposal</h2>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={handleGetAiDraftProposal}
                      disabled={aiDraftLoading}
                    >
                      {aiDraftLoading ? 'Generating proposal...' : '✦ Generate AI Proposal Draft & Milestones'}
                    </button>
                  </div>

                  <form onSubmit={handleSubmitProposal}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Bid Amount ($) *</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="500"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Estimated Project Duration</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. 3 Weeks"
                          value={estimatedDuration}
                          onChange={(e) => setEstimatedDuration(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Proposal Cover Letter *</label>
                      <textarea
                        className="form-control"
                        rows="6"
                        placeholder="Introduce yourself, outline your approach, skills, and why you are the best fit..."
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        required
                      />
                    </div>

                    {/* Show delivery plan and clarification questions if generated by AI */}
                    {aiProposalDraft && (
                      <div style={{ marginBottom: '2rem' }}>
                        <h4 className="ai-label" style={{ marginBottom: '0.5rem' }}>✦ AI Suggested Delivery & Collaboration Plan</h4>
                        <div className="delivery-plan-markdown">
                          {aiProposalDraft.delivery_plan}
                        </div>
                        
                        <h4 className="ai-label" style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>✦ Clarification Questions to Ask Client</h4>
                        <ul className="match-reasons">
                          {aiProposalDraft.clarification_questions.map((q, idx) => (
                            <li key={idx} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      <button type="submit" className="btn btn-primary" disabled={submitting}>
                        {submitting ? 'Submitting...' : 'Submit Pitch'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Status: Active Contract / In Progress Milestones (Freelancer view) */}
          {project.status === 'in_progress' && hasApplied && myProposal.status === 'accepted' && (
            <div className="glass-card">
              <h2 style={{ marginBottom: '1.5rem' }}>Project Milestones & Deliverables</h2>
              <div className="list-container">
                {milestones.map((m) => (
                  <div key={m.id} className={`milestone-item ${m.status}`}>
                    <div className="milestone-content">
                      <h3 style={{ fontSize: '1.1rem' }}>{m.title}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0' }}>{m.description}</p>
                      <div className="milestone-meta">
                        <span>Budget: <strong>${m.budget}</strong></span>
                        {m.deadline && <span>Timeline: <strong>{m.deadline}</strong></span>}
                      </div>
                      
                      {m.feedback && (
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(196, 154, 69, 0.08)', borderRadius: '6px', border: '1px solid rgba(196, 154, 69, 0.2)' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 'bold' }}>Client Revision Feedback:</span>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{m.feedback}</p>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${
                        m.status === 'approved' ? 'badge-success' :
                        m.status === 'submitted' ? 'badge-info' : 'badge-warning'
                      }`} style={{ marginBottom: '0.75rem' }}>
                        {m.status === 'approved' ? 'Approved / Paid' : m.status}
                      </span>
                      
                      {/* Submission buttons */}
                      {(m.status === 'pending' || m.status === 'revision_requested') && (
                        <button 
                          className="btn btn-secondary"
                          style={{ display: 'block', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                          onClick={() => setSelectedMilestone(m)}
                        >
                          Submit Work
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CLIENT ACTIONS */}
      {isClient && (
        <div>
          {/* Status: Open - Review Applicants Flow */}
          {project.status === 'open' && (
            <div className="glass-card">
              <h2 style={{ marginBottom: '1.5rem' }}>Applicant Pitch Proposals</h2>
              {proposals.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <p>No freelancers have applied to this project brief yet.</p>
                </div>
              ) : (
                <div className="list-container">
                  {proposals.map((prop) => {
                    const match = matchData[prop.freelancer_id];
                    return (
                      <div key={prop.id} style={{ padding: '1.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: 'var(--shadow-normal)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        
                        {/* Freelancer Header info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                          <div>
                            <h3 style={{ fontSize: '1.2rem' }}>{prop.freelancer_name}</h3>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              Availability: <strong style={{ color: 'var(--text-primary)' }}>{prop.freelancer_availability || 'full-time'}</strong> | Hourly rate: <strong style={{ color: 'var(--text-primary)' }}>${prop.freelancer_rates}/hr</strong>
                            </span>
                          </div>
                          
                          {/* AI Match Module */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {match ? (
                              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>AI Match:</span>
                                <div className="badge badge-info" style={{ fontSize: '0.95rem', fontWeight: 'bold', padding: '0.3rem 0.6rem' }}>
                                  {match.score}%
                                </div>
                              </div>
                            ) : (
                              <button 
                                className="btn btn-secondary" 
                                style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                                onClick={() => handleAnalyzeMatch(prop.freelancer_id)}
                                disabled={computingMatchId === prop.freelancer_id}
                              >
                                {computingMatchId === prop.freelancer_id ? 'Analyzing...' : '✦ Calculate AI Compatibility'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* AI Match Explanatory details */}
                        {match && (
                          <div className="match-meter-container" style={{ margin: 0 }}>
                            <div style={{ flex: 1 }}>
                              <h4 className="ai-label" style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>✦ AI Matching Explanations</h4>
                              <ul className="match-reasons" style={{ margin: 0 }}>
                                {match.explanation.map((exp, idx) => (
                                  <li key={idx} style={{ fontSize: '0.85rem' }}>{exp}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Pitch Details */}
                        <div>
                          <div style={{ display: 'flex', gap: '1.5rem', margin: '0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            <span>Bid Amount: <strong style={{ color: 'var(--text-primary)' }}>${prop.bid_amount}</strong></span>
                            <span>Est. Duration: <strong style={{ color: 'var(--text-primary)' }}>{prop.estimated_duration}</strong></span>
                            <span>Status: <strong style={{ color: 'var(--warning)', textTransform: 'capitalize' }}>{prop.status}</strong></span>
                          </div>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', whiteSpace: 'pre-wrap', background: 'var(--bg-main)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            {prop.cover_letter}
                          </p>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                          {prop.status !== 'rejected' && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                              onClick={() => handleUpdateProposalStatus(prop.id, 'rejected')}
                            >
                              Reject Pitch
                            </button>
                          )}
                          {prop.status === 'pending' && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: 'var(--warning)', borderColor: 'rgba(196, 154, 69, 0.3)' }}
                              onClick={() => handleUpdateProposalStatus(prop.id, 'shortlisted')}
                            >
                              Shortlist
                            </button>
                          )}
                          <button 
                            className="btn btn-success" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            onClick={() => handleOpenHireModal(prop)}
                          >
                            Accept & Hire
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Status: Active Contract / In Progress Milestones (Client view) */}
          {project.status === 'in_progress' && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2>Contract Milestone Tracker</h2>
                {acceptedProposal && (
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Hired Freelancer: <strong>{acceptedProposal.freelancer_name}</strong>
                  </span>
                )}
              </div>
              
              <div className="list-container">
                {milestones.map((m) => (
                  <div key={m.id} className={`milestone-item ${m.status}`}>
                    <div className="milestone-content">
                      <h3 style={{ fontSize: '1.1rem' }}>{m.title}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0' }}>{m.description}</p>
                      <div className="milestone-meta">
                        <span>Budget: <strong>${m.budget}</strong></span>
                        {m.deadline && <span>Timeline: <strong>{m.deadline}</strong></span>}
                      </div>

                      {m.submission_notes && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-sage-soft)', border: '1px solid var(--border-strong)', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--sage-dark)', fontWeight: 'bold' }}>Freelancer Submission Deliverables:</span>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{m.submission_notes}</p>
                        </div>
                      )}
                      
                      {m.feedback && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--bg-main)', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Feedback provided:</span>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{m.feedback}</p>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${
                        m.status === 'approved' ? 'badge-success' :
                        m.status === 'submitted' ? 'badge-info' : 'badge-warning'
                      }`} style={{ marginBottom: '0.75rem' }}>
                        {m.status === 'approved' ? 'Approved / Paid' : m.status}
                      </span>
                      
                      {m.status === 'submitted' && (
                        <button 
                          className="btn btn-primary"
                          style={{ display: 'block', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                          onClick={() => {
                            setSelectedReviewMilestone(m);
                            handleGetAiReviewDrafts(m.id);
                          }}
                        >
                          Review Submission
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FREELANCER SUBMIT MILESTONE MODAL */}
      {selectedMilestone && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>Submit Milestone Deliverables</h2>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', margin: '0.5rem 0 1rem 0' }}>
              {selectedMilestone.title}
            </h3>
            
            <form onSubmit={handleSubmitMilestoneWork}>
              <div className="form-group">
                <label className="form-label">Submission Notes & Links *</label>
                <textarea
                  className="form-control"
                  rows="6"
                  placeholder="Explain what has been built, provide repo links, hosting links, or attachments details..."
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedMilestone(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Confirm Submission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLIENT MILESTONE REVIEW MODAL (WITH GEMINI DRAFTS) */}
      {selectedReviewMilestone && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <h2>Review Milestone Deliverables</h2>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--sage-dark)', margin: '0.5rem 0 1rem 0' }}>
              {selectedReviewMilestone.title}
            </h3>

            <div style={{ background: 'var(--bg-cream)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-strong)', marginBottom: '1.5rem' }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Freelancer notes:</strong>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}>{selectedReviewMilestone.submission_notes}</p>
            </div>

            <form onSubmit={handleReviewMilestone}>
              <div className="form-group">
                <label className="form-label">Review Action</label>
                <select 
                  className="form-control"
                  value={reviewAction}
                  onChange={(e) => {
                    setReviewAction(e.target.value);
                    if (aiReviewDrafts) {
                      setReviewFeedback(e.target.value === 'approve' ? aiReviewDrafts.approval_draft : aiReviewDrafts.revision_draft);
                    }
                  }}
                >
                  <option value="approve">Approve & Release Payment (${selectedReviewMilestone.budget})</option>
                  <option value="request_revision">Request Revisions / Reject Submission</option>
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Review Feedback message *</label>
                  <button 
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                    onClick={() => handleGetAiReviewDrafts(selectedReviewMilestone.id)}
                    disabled={aiReviewLoading}
                  >
                    {aiReviewLoading ? 'Drafting...' : '✦ Regene AI Draft Response'}
                  </button>
                </div>
                <textarea
                  className="form-control"
                  rows="5"
                  placeholder="Provide details about acceptance or requested changes..."
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  required
                />
              </div>

              {aiReviewLoading && <div className="spinner" style={{ margin: '1rem auto' }} />}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setSelectedReviewMilestone(null);
                    setReviewFeedback('');
                    setAiReviewDrafts(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting Review...' : 'Confirm Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLIENT CONFIRM ACCEPT & HIRE MODAL (WITH MILESTONE CONFIG) */}
      {showHireModal && selectedProposal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <h2>Finalize Hiring Contract</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Confirm your hiring decision of <strong>{selectedProposal.freelancer_name}</strong> for the bid budget of <strong>${selectedProposal.bid_amount}</strong>.
            </p>

            <h3 style={{ fontSize: '1rem', color: 'var(--sage-dark)', marginBottom: '0.75rem' }}>
              ✦ Contract Milestones Configuration
            </h3>
            
            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
              {customMilestones.map((m, idx) => (
                <div key={idx} style={{ background: 'var(--bg-cream)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <strong style={{ fontSize: '0.9rem' }}>{m.title}</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                      {m.budget_percentage}% (${(selectedProposal.bid_amount * (m.budget_percentage / 100)).toFixed(2)})
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.description}</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Due: {m.deadline}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowHireModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-success" onClick={handleConfirmHire} disabled={submitting}>
                {submitting ? 'Confirming...' : 'Sign Contract & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
