import express from 'express';
import { dbGet, dbRun, dbAll } from '../db.js';
import { authenticateToken } from '../auth.js';

const router = express.Router();

// Apply/Submit a proposal (Freelancer only)
router.post('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'freelancer') {
    return res.status(403).json({ error: 'Only freelancers can submit proposals.' });
  }

  const { project_id, cover_letter, bid_amount, estimated_duration } = req.body;

  if (!project_id || !bid_amount) {
    return res.status(400).json({ error: 'Project ID and bid amount are required.' });
  }

  try {
    // Check if project is open
    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [project_id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    if (project.status !== 'open') {
      return res.status(400).json({ error: 'This project is no longer accepting proposals.' });
    }

    // Check if freelancer already applied
    const existingProposal = await dbGet(
      'SELECT id FROM proposals WHERE project_id = ? AND freelancer_id = ?',
      [project_id, req.user.id]
    );

    if (existingProposal) {
      return res.status(400).json({ error: 'You have already submitted a proposal for this project.' });
    }

    const bidVal = parseFloat(bid_amount) || 0;

    const result = await dbRun(
      `INSERT INTO proposals (project_id, freelancer_id, cover_letter, bid_amount, estimated_duration, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [project_id, req.user.id, cover_letter || '', bidVal, estimated_duration || '']
    );

    res.status(201).json({
      message: 'Proposal submitted successfully',
      proposalId: result.lastID
    });
  } catch (err) {
    console.error('Submit proposal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get proposals for a project (Client who owns the project, or freelancer who applied)
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    let query = `
      SELECT p.*, u.username as freelancer_name, u.email as freelancer_email,
             prof.skills as freelancer_skills, prof.rates as freelancer_rates, prof.availability as freelancer_availability
      FROM proposals p
      JOIN users u ON p.freelancer_id = u.id
      LEFT JOIN profiles prof ON u.id = prof.user_id
      WHERE p.project_id = ?
    `;
    const params = [projectId];

    // If current user is a freelancer, they can only see their own proposal
    if (req.user.role === 'freelancer') {
      query += ' AND p.freelancer_id = ?';
      params.push(req.user.id);
    } else {
      // If client, ensure they are the owner of the project
      if (project.client_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. You do not own this project.' });
      }
    }

    const proposals = await dbAll(query, params);

    const formattedProposals = proposals.map((p) => {
      try {
        p.freelancer_skills = p.freelancer_skills ? JSON.parse(p.freelancer_skills) : [];
      } catch {
        p.freelancer_skills = [];
      }
      return p;
    });

    res.json({ proposals: formattedProposals });
  } catch (err) {
    console.error('Fetch proposals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get freelancer proposal history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    let query = '';
    const params = [];

    if (req.user.role === 'freelancer') {
      query = `
        SELECT p.*, pr.title as project_title, pr.budget as project_budget, pr.status as project_status,
               u.username as client_name
        FROM proposals p
        JOIN projects pr ON p.project_id = pr.id
        JOIN users u ON pr.client_id = u.id
        WHERE p.freelancer_id = ?
        ORDER BY p.created_at DESC
      `;
      params.push(req.user.id);
    } else {
      // Client history (proposals received)
      query = `
        SELECT p.*, pr.title as project_title, pr.budget as project_budget, pr.status as project_status,
               u.username as freelancer_name
        FROM proposals p
        JOIN projects pr ON p.project_id = pr.id
        JOIN users u ON p.freelancer_id = u.id
        WHERE pr.client_id = ?
        ORDER BY p.created_at DESC
      `;
      params.push(req.user.id);
    }

    const proposals = await dbAll(query, params);
    res.json({ proposals });
  } catch (err) {
    console.error('Get proposal history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update proposal status (shortlist, accept, reject)
router.put('/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, milestones } = req.body; // status can be: shortlisted, accepted, rejected

  if (!['shortlisted', 'accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status update.' });
  }

  try {
    // Fetch proposal details
    const proposal = await dbGet('SELECT * FROM proposals WHERE id = ?', [id]);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found.' });
    }

    // Fetch project details to check owner
    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [proposal.project_id]);
    if (!project) {
      return res.status(404).json({ error: 'Project associated with this proposal was not found.' });
    }

    if (project.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this project.' });
    }

    // Update proposal status
    await dbRun('UPDATE proposals SET status = ? WHERE id = ?', [status, id]);

    // If proposal is accepted, finalize hiring flow:
    if (status === 'accepted') {
      // 1. Mark project as 'in_progress'
      await dbRun("UPDATE projects SET status = 'in_progress' WHERE id = ?", [proposal.project_id]);

      // 2. Reject all other pending/shortlisted proposals for this project
      await dbRun(
        "UPDATE proposals SET status = 'rejected' WHERE project_id = ? AND id != ?",
        [proposal.project_id, id]
      );

      // 3. Initialize Milestones if provided in request body
      if (Array.isArray(milestones) && milestones.length > 0) {
        // Clear any existing milestones for this project
        await dbRun('DELETE FROM milestones WHERE project_id = ?', [proposal.project_id]);

        for (const m of milestones) {
          const mBudget = parseFloat(m.budget) || (proposal.bid_amount * (parseFloat(m.budget_percentage) / 100)) || 0;
          await dbRun(
            `INSERT INTO milestones (project_id, title, description, budget, deadline, status)
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [proposal.project_id, m.title, m.description || '', mBudget, m.deadline || '']
          );
        }
      }
    }

    res.json({ message: `Proposal status updated to ${status} successfully.` });
  } catch (err) {
    console.error('Update proposal status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
