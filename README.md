# AI-Powered Freelance Project Marketplace Assistant
### Full-Stack Generative AI Application | React.js + Node.js + Gemini API

This project is an AI-powered freelance marketplace that helps clients detail project scopes, ranks and recommends freelancers based on capability matching, drafts proposals, and structures milestone feedback using Gemini API.

---

## Technical Architecture

### Tech Stack
- **Frontend**: React (Vite), React Router, Axios, Custom Dark Obsidian CSS theme.
- **Backend**: Node.js, Express, JWT (Session authentication), bcryptjs (Secure hashing).
- **Database**: Supabase PostgreSQL (utilizing pg pooling client connector).
- **AI Integration**: Official Google Gemini Node.js SDK (`@google/generative-ai` v0.21.0), executing prompts via `gemini-1.5-flash`.

---

## Core Generative AI Features & Prompts

The Gemini API is integrated securely into the Express backend and operates via custom prompt structures:

1. **Scoping Assistant**: Prompts Gemini to generate 3 targeted questions on initial project titles/budgets. Answers are compiled back into the scope to produce clear briefs.
2. **Explainable Matching**: Evaluates compatibility between freelancer profiles (availability, rates, experience, skills) and project requirements. It yields a dynamic score (0-100%) and bulleted justifications.
3. **Proposal Outline Generator**: Takes project details and structures a cover letter pitch, week-by-week delivery plan, milestone payment breakdowns, and freelancer-to-client clarification questions.
4. **Milestone Review Drafts**: Analyzes milestone deliverable submission notes to generate approval release messages or constructive revision-request feedback options.

---

## Database Schema (Supabase PostgreSQL)

The database schema is initialized dynamically on backend startup (`backend/db.js`).

- **`users`**: User records, emails, credentials, and roles (`client` or `freelancer`).
- **`profiles`**: Biography, skill JSON list, average rates, availability status, portfolio links, and preferred project types.
- **`projects`**: Category, title, budget, deadline, status (`open`, `in_progress`, `completed`, `archived`, `closed`), and requirements.
- **`milestones`**: Project milestone checklists containing status trackers (`pending`, `submitted`, `approved`, `revision_requested`, `paid`), submission notes, and review feedback.
- **`proposals`**: Bid amounts, estimated duration, custom pitch cover letters, and status.
- **`matches`**: Cache of compatibility match scores and Gemini-generated reasons.
- **`messages`**: Internal chat messages.
- **`reviews`**: Completed contract ratings and reviews.

---

## Installation & Setup Instructions

### Prerequisites
- Node.js (v18+)
- NPM

### Step 1: Clone or Open Workspace
Ensure you are in the project root directory: `Project_FullStack/`

### Step 2: Configure Backend Server
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Setup Environment Variables:
   Create a `.env` file matching `.env.example`:
   ```bash
    PORT=5000
    JWT_SECRET=super_secret_key_change_me
    GEMINI_API_KEY=your_actual_gemini_api_key_here
    DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
    ```
3. Install dependencies and start the backend:
    ```bash
    npm install
    npm start
    ```
    *Note: The PostgreSQL tables will be automatically created on Supabase database when connection initializes.*

### Step 3: Configure Frontend App
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install packages and launch the dev server:
   ```bash
   npm install
   npm run dev
   ```
3. Access the application in your browser at: `http://localhost:5173`

---

## Explaining the Gemini API Integration
Gemini API calls are made only from the backend. The backend constructs structured instruction sheets and supplies data (e.g. project brief, skills tags). By requesting outputs to match a standard JSON Schema and parsing codeblocks on return, the app guarantees clean structured data maps directly to DB storage and UI states.
# FullStack_Project
