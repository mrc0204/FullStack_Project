import express from 'express';
import { dbGet, dbRun, dbAll } from '../db.js';
import { authenticateToken } from '../auth.js';

const router = express.Router();

// Create project
router.post('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'client') {
    return res.status(403).json({ error: 'Only clients can publish project briefs.' });
  }

  const { title, category, scope, required_skills, budget, deadline } = req.body;

  if (!title || !budget) {
    return res.status(400).json({ error: 'Title and budget are required.' });
  }

  try {
    const skillsStr = Array.isArray(required_skills) ? JSON.stringify(required_skills) : JSON.stringify([]);
    const budgetVal = parseFloat(budget) || 0;

    const result = await dbRun(
      `INSERT INTO projects (client_id, title, category, scope, required_skills, budget, deadline, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
      [req.user.id, title, category || '', scope || '', skillsStr, budgetVal, deadline || '']
    );

    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [result.lastID]);
    res.status(201).json({ message: 'Project created successfully', project });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search & List projects
router.get('/', async (req, res) => {
  const { search, category, status, client_id } = req.query;

  try {
    let query = `
      SELECT p.id, p.client_id, p.title, p.category, p.scope, p.required_skills, p.budget, p.deadline, p.status, p.created_at,
             u.username as client_name
      FROM projects p
      JOIN users u ON p.client_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (p.title LIKE ? OR p.scope LIKE ? OR p.required_skills LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (category) {
      query += ` AND p.category = ?`;
      params.push(category);
    }

    if (status) {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    if (client_id) {
      query += ` AND p.client_id = ?`;
      params.push(client_id);
    }

    query += ` ORDER BY p.created_at DESC`;

    const projects = await dbAll(query, params);

    const formattedProjects = projects.map((p) => {
      try {
        p.required_skills = p.required_skills ? JSON.parse(p.required_skills) : [];
      } catch {
        p.required_skills = [];
      }
      return p;
    });

    res.json({ projects: formattedProjects });
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get detailed project
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const project = await dbGet(
      `SELECT p.*, u.username as client_name, u.email as client_email
       FROM projects p
       JOIN users u ON p.client_id = u.id
       WHERE p.id = ?`,
      [id]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    try {
      project.required_skills = project.required_skills ? JSON.parse(project.required_skills) : [];
    } catch {
      project.required_skills = [];
    }

    // Fetch milestones for this project
    const milestones = await dbAll(
      'SELECT * FROM milestones WHERE project_id = ? ORDER BY id ASC',
      [id]
    );

    res.json({ project, milestones });
  } catch (err) {
    console.error('Get project details error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update project (Client only)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, category, scope, required_skills, budget, deadline, status } = req.body;

  try {
    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this project brief.' });
    }

    const skillsStr = Array.isArray(required_skills) ? JSON.stringify(required_skills) : JSON.stringify(project.required_skills);
    const budgetVal = budget !== undefined ? parseFloat(budget) : project.budget;
    const newStatus = status || project.status;

    await dbRun(
      `UPDATE projects
       SET title = ?, category = ?, scope = ?, required_skills = ?, budget = ?, deadline = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title || project.title,
        category !== undefined ? category : project.category,
        scope !== undefined ? scope : project.scope,
        skillsStr,
        budgetVal,
        deadline !== undefined ? deadline : project.deadline,
        newStatus,
        id
      ]
    );

    res.json({ message: 'Project brief updated successfully.' });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete project (Client only)
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this project brief.' });
    }

    await dbRun('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ message: 'Project brief deleted successfully.' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
