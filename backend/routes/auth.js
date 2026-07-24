import express from 'express';
import { dbRun, dbGet } from '../db.js';
import { hashPassword, comparePassword, generateToken, authenticateToken } from '../auth.js';

const router = express.Router();

// Register Route
router.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields (username, email, password, role) are required.' });
  }

  if (role !== 'client' && role !== 'freelancer') {
    return res.status(400).json({ error: 'Role must be either client or freelancer.' });
  }

  try {
    // Check if user already exists
    const existingUser = await dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Insert user
    const result = await dbRun(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, password_hash, role]
    );

    const userId = result.lastID;

    // Initialize default profile
    await dbRun(
      'INSERT INTO profiles (user_id, skills, experience, portfolio, rates, availability, preferred_project_types, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        JSON.stringify([]), // empty skills array
        '', // empty experience
        JSON.stringify([]), // empty portfolio links
        0, // default rate
        'full-time', // default availability
        '', // preferred project types
        `Hi, I am a ${role} on the marketplace.` // bio
      ]
    );

    const user = { id: userId, username, email, role };
    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const validPassword = await comparePassword(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const userData = { id: user.id, username: user.username, email: user.email, role: user.role };
    const token = generateToken(userData);

    res.json({
      message: 'Login successful',
      token,
      user: userData
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user session
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, username, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
