import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { dbGet, dbRun, dbAll } from '../db.js';
import { authenticateToken } from '../auth.js';

dotenv.config();

const router = express.Router();

// Helper to initialize Gemini
const getGeminiModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  // Using gemini-2.5-flash as configured by API permissions
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
};

// Helper to clean and parse JSON response from Gemini
const cleanAndParseJSON = (text) => {
  try {
    let cleanText = text.trim();
    // Remove markdown code blocks if present
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();
    return JSON.parse(cleanText);
  } catch (err) {
    console.error('Error parsing Gemini response as JSON:', err, 'Original text:', text);
    throw new Error('Failed to parse AI response as valid JSON.');
  }
};

// 1. Generate scoping questions for a project (Client only)
router.post('/scoping-questions', authenticateToken, async (req, res) => {
  const { title, category, scope, budget, required_skills } = req.body;

  const model = getGeminiModel();
  if (!model) {
    return res.json({
      questions: [
        "What specific deliverables do you expect by the end of the project?",
        "Are there any external integrations (e.g. Stripe, Twilio) that should be accounted for?",
        "What is your target timeframe or deadline for key project milestones?"
      ],
      isMock: true
    });
  }

  const prompt = `
    You are an expert technical project scoping assistant.
    A client wants to publish a project brief on a freelance marketplace with the following details:
    - Title: ${title || 'Untitled Project'}
    - Category: ${category || 'Software Development'}
    - Scope/Description: ${scope || 'Not specified'}
    - Budget: $${budget || '0'}
    - Required Skills: ${Array.isArray(required_skills) ? required_skills.join(', ') : 'None'}

    Generate exactly 3 structured, highly relevant clarification questions to help this client define the project scope, deliverables, and milestones.
    Format your response as a valid JSON object matching this schema:
    {
      "questions": ["Question 1", "Question 2", "Question 3"]
    }
    Return only raw JSON. Do not write explanation prose.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const data = cleanAndParseJSON(response.text());
    res.json(data);
  } catch (err) {
    console.error('Gemini scoping questions error:', err);
    res.status(500).json({ error: 'AI scoping generation failed.' });
  }
});

// 2. Generate and Save Match Score for a Project and Freelancer
router.post('/match', authenticateToken, async (req, res) => {
  const { project_id, freelancer_id } = req.body;

  if (!project_id || !freelancer_id) {
    return res.status(400).json({ error: 'Project ID and freelancer ID are required.' });
  }

  try {
    // Fetch project
    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [project_id]);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    // Fetch freelancer user and profile
    const freelancer = await dbGet(
      `SELECT u.username, p.*
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       WHERE u.id = ? AND u.role = 'freelancer'`,
      [freelancer_id]
    );
    if (!freelancer) return res.status(404).json({ error: 'Freelancer profile not found.' });

    const model = getGeminiModel();
    if (!model) {
      // Mock match score based on basic skill intersection
      const pSkills = project.required_skills ? JSON.parse(project.required_skills) : [];
      const fSkills = freelancer.skills ? JSON.parse(freelancer.skills) : [];
      const intersection = pSkills.filter(s => fSkills.includes(s));
      let score = 50 + (intersection.length * 10);
      if (score > 98) score = 98;

      const explanation = [
        `Freelancer matches skills: ${intersection.join(', ') || 'none matched'}.`,
        `Freelancer profile rate is $${freelancer.rates}/hr.`,
        `Freelancer availability is ${freelancer.availability}.`
      ];

      // Save match to db using PostgreSQL ON CONFLICT syntax
      await dbRun(
        `INSERT INTO matches (project_id, freelancer_id, match_score, match_explanation)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (project_id, freelancer_id)
         DO UPDATE SET match_score = EXCLUDED.match_score, match_explanation = EXCLUDED.match_explanation`,
        [project_id, freelancer_id, score, JSON.stringify(explanation)]
      );

      return res.json({ score, explanation, isMock: true });
    }

    const prompt = `
      Compare the project brief requirements with the freelancer's profile.
      Project details:
      - Title: ${project.title}
      - Scope: ${project.scope}
      - Budget: $${project.budget}
      - Required Skills: ${project.required_skills}
      - Deadline: ${project.deadline}

      Freelancer profile:
      - Name: ${freelancer.username}
      - Bio: ${freelancer.bio}
      - Skills: ${freelancer.skills}
      - Rate: $${freelancer.rates}/hr
      - Experience: ${freelancer.experience}
      - Availability: ${freelancer.availability}
      - Preferred Project Types: ${freelancer.preferred_project_types}

      Determine:
      1. Overall compatibility score between 0 and 100.
      2. Bulleted list of reasons summarizing the match details, skill matches, budget suitability, and any risk/gaps.

      Format your response as a valid JSON object matching this schema:
      {
        "score": 85,
        "explanation": ["Reason 1", "Reason 2", "Reason 3 (Gap or risk if any)"]
      }
      Return only raw JSON. Do not write explanation prose.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const data = cleanAndParseJSON(response.text());

    // Save match to database using PostgreSQL ON CONFLICT syntax
    await dbRun(
      `INSERT INTO matches (project_id, freelancer_id, match_score, match_explanation)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (project_id, freelancer_id)
       DO UPDATE SET match_score = EXCLUDED.match_score, match_explanation = EXCLUDED.match_explanation`,
      [project_id, freelancer_id, data.score, JSON.stringify(data.explanation)]
    );

    res.json(data);
  } catch (err) {
    console.error('Gemini matching error:', err);
    res.status(500).json({ error: 'AI matching analysis failed.' });
  }
});

// 3. Draft Proposal Outline, Milestones, and Clarification Questions (Freelancer only)
router.post('/draft-proposal', authenticateToken, async (req, res) => {
  const { project_id } = req.body;

  if (!project_id) {
    return res.status(400).json({ error: 'Project ID is required.' });
  }

  try {
    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [project_id]);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const freelancer = await dbGet(
      `SELECT u.username, p.*
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       WHERE u.id = ?`,
      [req.user.id]
    );

    const model = getGeminiModel();
    if (!model) {
      // Mock Proposal
      const mockResult = {
        cover_letter: `Dear Client, I would love to work on your project '${project.title}'. Based on my profile as a freelancer with skills like ${freelancer.skills}, I have the expertise to execute this project efficiently.`,
        delivery_plan: "1. Planning & Design Phase (Week 1)\n2. Development Phase (Week 2-3)\n3. Testing & Delivery (Week 4)",
        milestones: [
          { title: "Project Kickoff & Initial Prototype", description: "Design concepts and wireframes completion.", budget_percentage: 30, deadline: "Week 1" },
          { title: "Core Features Development", description: "Implement main functional models.", budget_percentage: 50, deadline: "Week 3" },
          { title: "Testing, Deployment & Handover", description: "Final validation, bug fixes and files transfer.", budget_percentage: 20, deadline: "Week 4" }
        ],
        clarification_questions: [
          "Do you have a specific host preference for the deployment?",
          "Are there any design branding assets ready to share?",
          "Would you require post-delivery monthly maintenance?"
        ],
        isMock: true
      };
      return res.json(mockResult);
    }

    const prompt = `
      You are an assistant helping a freelancer draft a proposal.
      Project details:
      - Title: ${project.title}
      - Scope: ${project.scope}
      - Budget: $${project.budget}
      - Required Skills: ${project.required_skills}

      Freelancer profile:
      - Name: ${freelancer.username}
      - Skills: ${freelancer.skills}
      - Experience/Bio: ${freelancer.bio} ${freelancer.experience}

      Generate:
      1. A professional, tailored cover letter. Do not make up fake client names or credentials. Focus on freelancer's actual skills: ${freelancer.skills}.
      2. A concise step-by-step project delivery plan.
      3. A list of 3 milestones with suggested titles, descriptions, budget percentages (which must sum to 100), and relative deadlines.
      4. A list of 3 logical clarification questions the freelancer should ask the client regarding requirements.

      Format your response as a valid JSON object matching this schema:
      {
        "cover_letter": "tailored cover letter string",
        "delivery_plan": "step-by-step markdown delivery plan string",
        "milestones": [
          { "title": "Milestone title", "description": "description", "budget_percentage": 30, "deadline": "timeline" }
        ],
        "clarification_questions": ["Question 1", "Question 2", "Question 3"]
      }
      Return only raw JSON. Do not write explanation prose.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const data = cleanAndParseJSON(response.text());
    res.json(data);
  } catch (err) {
    console.error('Gemini draft proposal error:', err);
    res.status(500).json({ error: 'AI proposal draft generation failed.' });
  }
});

// 4. Milestone Acceptance / Revision Message Drafts (Client only)
router.post('/milestone-review-drafts', authenticateToken, async (req, res) => {
  const { milestone_id } = req.body;

  if (!milestone_id) {
    return res.status(400).json({ error: 'Milestone ID is required.' });
  }

  try {
    const milestone = await dbGet('SELECT * FROM milestones WHERE id = ?', [milestone_id]);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found.' });

    const model = getGeminiModel();
    if (!model) {
      return res.json({
        approval_draft: `Hi, thank you for submitting the work for '${milestone.title}'. The deliverables look great and comply with the checklist. I have approved this milestone and released the payment.`,
        revision_draft: `Hi, thank you for your submission for '${milestone.title}'. After reviewing, it looks like we need some adjustments. Specifically, please look at refinement of the core requirements before we proceed with approval.`,
        isMock: true
      });
    }

    const prompt = `
      Draft two alternative messages for a client review of a milestone submission:
      Milestone:
      - Title: ${milestone.title}
      - Description: ${milestone.description}
      - Submission notes: ${milestone.submission_notes || 'No notes provided by freelancer.'}

      Generate:
      1. A professional approval and payment release message.
      2. A constructive, professional revision request message detailing feedback.

      Format your response as a valid JSON object matching this schema:
      {
        "approval_draft": "approval message string",
        "revision_draft": "revision request message string"
      }
      Return only raw JSON. Do not write explanation prose.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const data = cleanAndParseJSON(response.text());
    res.json(data);
  } catch (err) {
    console.error('Gemini milestone drafts error:', err);
    res.status(500).json({ error: 'AI milestone review drafts generation failed.' });
  }
});

// 5. Get Saved Matches for a Project (ranked)
router.get('/matches/project/:projectId', authenticateToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const matches = await dbAll(
      `SELECT m.*, u.username as freelancer_name, u.email as freelancer_email,
              p.skills, p.rates, p.availability, p.bio
       FROM matches m
       JOIN users u ON m.freelancer_id = u.id
       JOIN profiles p ON u.id = p.user_id
       WHERE m.project_id = ?
       ORDER BY m.match_score DESC`,
      [projectId]
    );

    const formattedMatches = matches.map((m) => {
      try {
        m.skills = m.skills ? JSON.parse(m.skills) : [];
        m.match_explanation = m.match_explanation ? JSON.parse(m.match_explanation) : [];
      } catch {
        m.skills = [];
        m.match_explanation = [];
      }
      return m;
    });

    res.json({ matches: formattedMatches });
  } catch (err) {
    console.error('Fetch project matches error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Get Recommended/Matched Projects for current Freelancer
router.get('/matches/freelancer', authenticateToken, async (req, res) => {
  try {
    const matches = await dbAll(
      `SELECT m.*, pr.title as project_title, pr.category as project_category,
              pr.budget as project_budget, pr.deadline as project_deadline, pr.status as project_status,
              u.username as client_name
       FROM matches m
       JOIN projects pr ON m.project_id = pr.id
       JOIN users u ON pr.client_id = u.id
       WHERE m.freelancer_id = ? AND pr.status = 'open'
       ORDER BY m.match_score DESC`,
      [req.user.id]
    );

    const formattedMatches = matches.map((m) => {
      try {
        m.match_explanation = m.match_explanation ? JSON.parse(m.match_explanation) : [];
      } catch {
        m.match_explanation = [];
      }
      return m;
    });

    res.json({ matches: formattedMatches });
  } catch (err) {
    console.error('Fetch freelancer matches error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
