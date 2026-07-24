import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Profile() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isFreelancer = user.role === 'freelancer';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [profileData, setProfileData] = useState({
    bio: '',
    skills: '',
    experience: '',
    rates: '',
    availability: 'full-time',
    preferred_project_types: '',
    portfolio: ''
  });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/profiles/${user.id}`);
      const p = res.data.profile;
      
      setProfileData({
        bio: p.bio || '',
        skills: Array.isArray(p.skills) ? p.skills.join(', ') : '',
        experience: p.experience || '',
        rates: p.rates !== undefined ? p.rates.toString() : '',
        availability: p.availability || 'full-time',
        preferred_project_types: p.preferred_project_types || '',
        portfolio: Array.isArray(p.portfolio) ? p.portfolio.join(', ') : ''
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user.id]);

  const handleChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
    if (successMsg) setSuccessMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');

    try {
      const payload = {
        bio: profileData.bio,
        experience: profileData.experience,
        rates: parseFloat(profileData.rates) || 0,
        availability: profileData.availability,
        preferred_project_types: profileData.preferred_project_types,
        skills: profileData.skills.split(',').map(s => s.trim()).filter(Boolean),
        portfolio: profileData.portfolio.split(',').map(s => s.trim()).filter(Boolean)
      };

      await axios.put('/profiles/me', payload);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Update profile error:', err);
      alert('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="spinner" />;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Edit User Profile</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Keep your details up-to-date to get accurate AI matching scores and stand out to clients.
        </p>
      </div>

      {successMsg && (
        <div className="badge badge-success" style={{ display: 'block', width: '100%', padding: '0.75rem', marginBottom: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card">
        <div className="form-group">
          <label className="form-label" htmlFor="bio">Professional Bio</label>
          <textarea
            name="bio"
            id="bio"
            rows="4"
            className="form-control"
            placeholder="Tell us about yourself or your organization..."
            value={profileData.bio}
            onChange={handleChange}
            required
          />
        </div>

        {isFreelancer ? (
          <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="skills">Skills (comma separated)</label>
                <input
                  type="text"
                  name="skills"
                  id="skills"
                  className="form-control"
                  placeholder="React, Node.js, Python, SQLite"
                  value={profileData.skills}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="rates">Hourly Rate / Desired Price ($/hr)</label>
                <input
                  type="number"
                  name="rates"
                  id="rates"
                  className="form-control"
                  placeholder="50"
                  value={profileData.rates}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="availability">Availability State</label>
                <select
                  name="availability"
                  id="availability"
                  className="form-control"
                  value={profileData.availability}
                  onChange={handleChange}
                >
                  <option value="full-time">Full-Time Available</option>
                  <option value="part-time">Part-Time Available</option>
                  <option value="unavailable">Not Available</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="preferred_project_types">Preferred Project Types</label>
                <input
                  type="text"
                  name="preferred_project_types"
                  id="preferred_project_types"
                  className="form-control"
                  placeholder="e.g. Web Apps, Machine Learning, UI design"
                  value={profileData.preferred_project_types}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="experience">Work Experience / Background Description</label>
              <textarea
                name="experience"
                id="experience"
                rows="4"
                className="form-control"
                placeholder="List your previous employment details, achievements, and technical expertise..."
                value={profileData.experience}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="portfolio">Portfolio Links (comma separated URLs)</label>
              <input
                type="text"
                name="portfolio"
                id="portfolio"
                className="form-control"
                placeholder="https://github.com/profile, https://portfolio.com"
                value={profileData.portfolio}
                onChange={handleChange}
              />
            </div>
          </>
        ) : (
          <div className="form-group">
            <label className="form-label" htmlFor="experience">Company / Hirer Background details</label>
            <textarea
              name="experience"
              id="experience"
              rows="3"
              className="form-control"
              placeholder="e.g. Google DeepMind team working on Advanced Agentic coding..."
              value={profileData.experience}
              onChange={handleChange}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile Details'}
          </button>
        </div>
      </form>
    </div>
  );
}
