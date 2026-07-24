import express from 'express';
import { dbGet, dbRun, dbAll } from '../db.js';
import { authenticateToken } from '../auth.js';

const router = express.Router();

// Get profile by user ID
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const profile = await dbGet(
      `SELECT u.id, u.username, u.email, u.role, u.created_at,
              p.skills, p.experience, p.portfolio, p.rates, p.availability, p.preferred_project_types, p.bio
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = ?`,
      [userId]
    );

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Parse JSON lists safely
    try {
      profile.skills = profile.skills ? JSON.parse(profile.skills) : [];
    } catch {
      profile.skills = [];
    }

    try {
      profile.portfolio = profile.portfolio ? JSON.parse(profile.portfolio) : [];
    } catch {
      profile.portfolio = [];
    }

    res.json({ profile });
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update own profile
router.put('/me', authenticateToken, async (req, res) => {
  const { skills, experience, portfolio, rates, availability, preferred_project_types, bio } = req.body;
  const userId = req.user.id;

  try {
    // Validate inputs if provided
    let rateVal = rates ? parseFloat(rates) : 0;
    if (isNaN(rateVal) || rateVal < 0) {
      rateVal = 0;
    }

    let availabilityVal = availability || 'full-time';
    if (!['full-time', 'part-time', 'unavailable'].includes(availabilityVal)) {
      availabilityVal = 'full-time';
    }

    const skillsStr = Array.isArray(skills) ? JSON.stringify(skills) : JSON.stringify([]);
    const portfolioStr = Array.isArray(portfolio) ? JSON.stringify(portfolio) : JSON.stringify([]);

    await dbRun(
      `UPDATE profiles
       SET skills = ?, experience = ?, portfolio = ?, rates = ?, availability = ?, preferred_project_types = ?, bio = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [
        skillsStr,
        experience || '',
        portfolioStr,
        rateVal,
        availabilityVal,
        preferred_project_types || '',
        bio || '',
        userId
      ]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search and list profiles (Freelancers)
router.get('/', async (req, res) => {
  const { search } = req.query;

  try {
    let query = `
      SELECT u.id, u.username, u.email, u.role, p.skills, p.experience, p.rates, p.availability, p.preferred_project_types, p.bio
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.role = 'freelancer'
    `;
    const params = [];

    if (search) {
      query += ` AND (u.username LIKE ? OR p.skills LIKE ? OR p.bio LIKE ? OR p.experience LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    const freelancers = await dbAll(query, params);

    // Parse JSON skills lists for each freelancer
    const formattedFreelancers = freelancers.map((f) => {
      try {
        f.skills = f.skills ? JSON.parse(f.skills) : [];
      } catch {
        f.skills = [];
      }
      return f;
    });

    res.json({ freelancers: formattedFreelancers });
  } catch (err) {
    console.error('Search freelancers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
