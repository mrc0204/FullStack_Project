import express from 'express';
import { dbGet, dbRun, dbAll } from '../db.js';
import { authenticateToken } from '../auth.js';

const router = express.Router();

// Get milestones for a project
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Secure checking: either client or hired freelancer should access milestones
    // Let's check who the hired freelancer is (the accepted proposal freelancer)
    const acceptedProposal = await dbGet(
      "SELECT freelancer_id FROM proposals WHERE project_id = ? AND status = 'accepted'",
      [projectId]
    );

    const isClient = project.client_id === req.user.id;
    const isFreelancer = acceptedProposal && acceptedProposal.freelancer_id === req.user.id;

    if (!isClient && !isFreelancer) {
      return res.status(403).json({ error: 'Access denied. You are not associated with this contract.' });
    }

    const milestones = await dbAll('SELECT * FROM milestones WHERE project_id = ? ORDER BY id ASC', [projectId]);
    res.json({ milestones });
  } catch (err) {
    console.error('Fetch milestones error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit milestone work (Freelancer only)
router.post('/:id/submit', authenticateToken, async (req, res) => {
  if (req.user.role !== 'freelancer') {
    return res.status(403).json({ error: 'Only freelancers can submit milestone deliverables.' });
  }

  const { id } = req.params;
  const { submission_notes } = req.body;

  if (!submission_notes) {
    return res.status(400).json({ error: 'Submission notes or deliverables description required.' });
  }

  try {
    const milestone = await dbGet('SELECT * FROM milestones WHERE id = ?', [id]);
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found.' });
    }

    // Verify freelancer is assigned to this project
    const acceptedProposal = await dbGet(
      "SELECT freelancer_id FROM proposals WHERE project_id = ? AND status = 'accepted'",
      [milestone.project_id]
    );

    if (!acceptedProposal || acceptedProposal.freelancer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You are not assigned to this project.' });
    }

    // Check status
    if (milestone.status === 'approved' || milestone.status === 'paid') {
      return res.status(400).json({ error: 'Milestone is already approved/paid.' });
    }

    // Update milestone status to 'submitted'
    await dbRun(
      "UPDATE milestones SET status = 'submitted', submission_notes = ? WHERE id = ?",
      [submission_notes, id]
    );

    res.json({ message: 'Milestone work submitted successfully.' });
  } catch (err) {
    console.error('Submit milestone error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Review milestone (Client only)
router.post('/:id/review', authenticateToken, async (req, res) => {
  if (req.user.role !== 'client') {
    return res.status(403).json({ error: 'Only clients can review milestones.' });
  }

  const { id } = req.params;
  const { action, feedback } = req.body; // action: approve, request_revision

  if (!['approve', 'request_revision'].includes(action)) {
    return res.status(400).json({ error: 'Action must be either "approve" or "request_revision".' });
  }

  try {
    const milestone = await dbGet('SELECT * FROM milestones WHERE id = ?', [id]);
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found.' });
    }

    // Verify client is owner of project
    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [milestone.project_id]);
    if (!project || project.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You do not own this project.' });
    }

    if (milestone.status !== 'submitted') {
      return res.status(400).json({ error: 'This milestone has not been submitted yet.' });
    }

    let nextStatus = '';
    if (action === 'approve') {
      nextStatus = 'approved'; // which release payment
    } else {
      nextStatus = 'revision_requested';
    }

    await dbRun(
      'UPDATE milestones SET status = ?, feedback = ? WHERE id = ?',
      [nextStatus, feedback || '', id]
    );

    // If approved, check if all project milestones are approved. If so, mark project as completed
    if (action === 'approve') {
      const remaining = await dbAll(
        "SELECT id FROM milestones WHERE project_id = ? AND status != 'approved'",
        [milestone.project_id]
      );
      if (remaining.length === 0) {
        await dbRun("UPDATE projects SET status = 'completed' WHERE id = ?", [milestone.project_id]);
      }
    }

    res.json({ message: `Milestone status updated to ${nextStatus}.` });
  } catch (err) {
    console.error('Review milestone error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
