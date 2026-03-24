// RESUME OPTIMIZER - FIXED VERSION
// Backup file with improved question generation
// Fixed: Questions no longer ask about "members", "consistent", "opportunities"

// ============================================================
// lib/ats.ts - The improved ATS scoring and JD analysis
// ============================================================

// ATS Scoring and JD Analysis utilities
export interface JDAnalysis {
  keywords: string[];
  requirements: string[];
  skills: string[];
  experience: string[];
}

export interface ATScore {
  resumeId: number;
  resumeName: string;
  totalScore: number;
  keywordScore: number;
  formattingScore: number;
  missingKeywords: string[];
  matchedKeywords: string[];
}

// Common ATS keywords to look for
const ATS_KEYWORDS = [
  'team', 'lead', 'manage', 'project', 'experience', 'developed', 'created',
  'implemented', 'designed', 'built', 'optimized', 'improved', 'increased',
  'reduced', 'analyzed', 'collaborated', 'communication', 'leadership',
  'problem-solving', 'analytical', 'strategic', 'innovative', 'agile',
  'scrum', 'javascript', 'python', 'java', 'react', 'node', 'sql', 'aws',
  'cloud', 'docker', 'kubernetes', 'git', 'ci/cd', 'rest', 'api', 'database'
];

// Technical skills patterns
const SKILL_PATTERNS = [
  /javascript|js|typescript|ts|react|vue|angular|next\.js|node\.?js/i,
  /python|django|flask|fastapi/i,
  /java|spring|hibernate/i,
  /sql|mysql|postgresql|mongodb|redis/i,
  /aws|azure|gcp|cloud/i,
  /docker|kubernetes|k8s/i,
  /git|github|gitlab|bitbucket/i,
  /agile|scrum|kanban|lean/i,
  /machine learning|ml|ai|deep learning|tensorflow|pytorch/i,
  /api|rest|graphql|microservices/i
];

// Words to EXCLUDE from JD keywords - these are context words, not requirements
const EXCLUDED_KEYWORD_PATTERNS = [
  /^(members?|membership|consistent|consistency|opportunities?|opportunity|passionate|dynamic|collaborative|mission|driven|elevate|shape|interact|touchpoints|key|role|essential|fundamental|core|critical|primary|secondary|support|responsible|accountable|ensure|deliver|provide|maintain|monitor|stay|continuously|efficient|effective|successful|strong|excellent|outstanding|exceptional|proven|demonstrated|extensive|comprehensive|working|relevant|related|similar|equivalent|preferred|desired|ideal|candidate|applicant|position|job|work|role|responsibility|duty|salary|benefit|discount|meal|lunch|parking|health|care|schedule|monday|tuesday|wednesday|thursday|friday|week|year|day|hour)$/i
];

// Patterns for extracting actionable skills/requirements from JD
const ACTIONABLE_SKILL_PATTERNS = [
  // Tools & Software
  /(?:crm| Salesforce| HubSpot| Zendesk| Freshdesk| LiveChat| Intercom| Zoho| Microsoft Dynamics| SugarCRM| Sage| QuickBooks| Excel| PowerPoint| Word| Google Suite| Slack| Teams| Zoom| Webex| Asana| Trello| Monday\.com| Jira| Confluence| Notion| Airtable| Hootsuite| Buffer| Mailchimp| HubSpot Marketing| Google Analytics| GA4| Hotjar| Mixpanel| Amplitude| Segment| FullStory| Crazy Egg)/gi,
  // Industry-standard frameworks
  /(?:Six Sigma| Lean| Kaizen| PMP| CAPM| PRINCE2| ITIL| COBIT| SOC 2| HIPAA| GDPR| PCI DSS| ISO 9001| ISO 27001| NIST)/gi,
  // Data & Analytics
  /(?:Power BI| Tableau| Looker| Qlik| Alteryx| KNIME| RapidMiner| SPSS| SAS| R programming| STATA| MATLAB| Excel VBA| SQL| NoSQL| ETL| Apache Spark| Hadoop| Hive| Snowflake| Databricks| BigQuery| Redshift| Data Warehouse| Business Intelligence| BI| Analytics| Reporting| Dashboard| Visualization| Forecasting| Predictive| Machine Learning| AI| NLP| Computer Vision)/gi,
  // Soft skills with context
  /(?:customer service|customer experience|cx|client relations|stakeholder management|vendor management|account management|people management|team leadership|project management|time management|conflict resolution|negotiation|presentation|public speaking|training|coaching|mentoring|cross-functional|collaboration|strategic planning|budgeting|forecasting)/gi,
  // Languages (non-programming)
  /(?:English|Spanish|French|German|Mandarin|Cantonese|Japanese|Korean|Portuguese|Italian|Arabic|Hindi|bilingual|fluent|proficient)/gi
];

// Helper: Check if a word should be excluded from keywords
function shouldExcludeKeyword(word) {
  const lower = word.toLowerCase();
  
  // Check against exclusion patterns
  for (const pattern of EXCLUDED_KEYWORD_PATTERNS) {
    if (pattern.test(lower)) {
      return true;
    }
  }
  
  // Exclude very common words that appear in JD context but aren't requirements
  const commonContextWords = [
    'company', 'team', 'department', 'organization', 'business', 'industry',
    'market', 'customer', 'client', 'candidate', 'position', 'role', 'job',
    'environment', 'culture', 'values', 'mission', 'vision', 'goals',
    'opportunity', 'opportunities', 'benefits', 'compensation', 'salary',
    'location', 'remote', 'hybrid', 'fulltime', 'parttime', 'contract'
  ];
  
  return commonContextWords.includes(lower);
}

// Helper: Clean and extract actionable items from bullet points
function extractActionableRequirements(lines) {
  const requirements = [];
  
  for (const line of lines) {
    const cleaned = line.trim().replace(/^[\•\-\*\d\.\)]+\s*/, '').trim();
    
    // Skip if too short or too long
    if (cleaned.length < 10 || cleaned.length > 200) continue;
    
    // Skip lines that are just headings or don't describe a requirement
    if (/^(what|why|who|where|when|how|benefits|compensation|salary|schedule|location|remote)/i.test(cleaned)) continue;
    
    // Skip lines that are mostly declarative (about the company)
    if (/^(we are|our|we offer|you will|join our|be part of)/i.test(cleaned)) continue;
    
    requirements.push(cleaned);
  }
  
  return requirements;
}

export function analyzeJobDescription(jdText) {
  const text = jdText.toLowerCase();
  
  // Extract keywords - only ATS-relevant ones, excluding context words
  const keywords = [];
  const words = jdText.split(/[\s,\-\.\(\)\[\]]+/).filter(w => w.length > 3);
  
  for (const word of words) {
    const lower = word.toLowerCase();
    if (ATS_KEYWORDS.includes(lower) && !keywords.includes(lower) && !shouldExcludeKeyword(lower)) {
      keywords.push(lower);
    }
  }
  
  // Extract skills using multiple patterns (technical + tools + soft skills)
  const skills = [];
  
  // Technical skills
  for (const pattern of SKILL_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        if (!skills.includes(match.toLowerCase())) {
          skills.push(match.toLowerCase());
        }
      }
    }
  }
  
  // Actionable skills (tools, frameworks, soft skills)
  for (const pattern of ACTIONABLE_SKILL_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const normalized = match.toLowerCase().trim();
        if (!skills.includes(normalized) && normalized.length > 2) {
          skills.push(normalized);
        }
      }
    }
  }
  
  // Extract requirements (lines starting with • or numbered lists)
  const lines = jdText.split('\n');
  const rawRequirements = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+[\.\)]/.test(trimmed)) {
      rawRequirements.push(trimmed);
    }
  }
  
  const requirements = extractActionableRequirements(rawRequirements);
  
  // Extract experience requirements with context
  const experience = [];
  const expPatterns = [
    { regex: /(\d+)\+?\s*(years?|yrs?)\s*(of\s*)?(experience|exp)/gi, context: 'experience' },
    { regex: /(\d+)\+?\s*(years?|yrs?)\s*(of\s*)?(management|managing|leadership)/gi, context: 'management' },
    { regex: /minimum\s*(\d+)\s*(years?|yrs?)/gi, context: 'minimum' },
    { regex: /(\d+)\s*-\s*(\d+)\s*(years?|yrs?)/gi, context: 'range' }
  ];
  
  for (const { regex, context } of expPatterns) {
    const matches = [...jdText.matchAll(regex)];
    for (const match of matches) {
      experience.push(match[0]);
    }
  }
  
  return {
    keywords: [...new Set(keywords)].slice(0, 20),
    requirements,
    skills: [...new Set(skills)].slice(0, 15),
    experience: [...new Set(experience)].slice(0, 5)
  };
}

// Smart question templates mapped to requirement types
const QUESTION_TEMPLATES = {
  leadership: [
    "Describe your experience leading a team. What challenges did you face and how did you overcome them?",
    "Tell us about a time you mentored or coached team members. What approach did you take?",
    "How do you motivate and develop your team members?"
  ],
  technical: [
    "Describe a complex technical project you led. What was the challenge and outcome?",
    "What technical skills are you most proficient in, and how have you applied them?",
    "Describe a time you had to learn a new technology quickly. How did you approach it?"
  ],
  customer_experience: [
    "Describe your experience improving customer satisfaction or experience. What metrics did you impact?",
    "How do you handle difficult customers or escalations? Can you give an example?",
    "Tell us about a time you went above and beyond for a customer."
  ],
  communication: [
    "Describe a time you had to communicate complex information to stakeholders. How did you ensure understanding?",
    "How do you handle cross-functional collaboration between different departments?",
    "Tell us about a presentation or proposal you delivered. What was the outcome?"
  ],
  data_analytics: [
    "Describe your experience analyzing data to drive decisions. What tools do you use?",
    "Tell us about a time you used data to solve a business problem. What was your approach?",
    "How do you translate data insights into actionable recommendations?"
  ],
  process: [
    "Describe a process improvement initiative you led. What was the outcome?",
    "How do you ensure efficiency and quality in your work?",
    "Tell us about a time you identified and solved an operational bottleneck."
  ],
  general: [
    "Describe a challenging problem you solved. What was your approach?",
    "What are your greatest strengths and how do they align with this role?",
    "Where do you see yourself in 3-5 years, and how does this role fit?",
    "Why are you interested in this position, and what excites you most about it?",
    "Describe a time you had to manage multiple priorities. How did you handle it?"
  ]
};

// Helper: Detect the primary focus area from JD analysis
function detectFocusAreas(jdAnalysis) {
  const focusAreas = [];
  const skillsText = (jdAnalysis.skills || []).join(' ').toLowerCase();
  const requirementsText = (jdAnalysis.requirements || []).join(' ').toLowerCase();
  const combined = skillsText + ' ' + requirementsText;
  
  // Check for leadership/management
  if (/lead|manage|team|supervisor|director|head|chief|mentor|coach/i.test(combined)) {
    focusAreas.push('leadership');
  }
  
  // Check for technical skills
  if (/programming|development|software|engineer|technical|coding|python|java|javascript|react|node|sql|cloud|aws|azure|devops|data science|machine learning|ai/i.test(combined)) {
    focusAreas.push('technical');
  }
  
  // Check for customer experience
  if (/customer|customer experience|cx|client service|support|account management|relationship|stakeholder/i.test(combined)) {
    focusAreas.push('customer_experience');
  }
  
  // Check for communication/presentation
  if (/communication|presentation|public speaking|writing|collaboration|interpersonal/i.test(combined)) {
    focusAreas.push('communication');
  }
  
  // Check for data/analytics
  if (/analytics|data|business intelligence|bi|reporting|metrics|kpi| dashboard|excel|tableau|power bi|analysis/i.test(combined)) {
    focusAreas.push('data_analytics');
  }
  
  // Check for process/six sigma/operations
  if (/process|improvement|operations|efficiency|workflow|agile|scrum|lean|six sigma|project management/i.test(combined)) {
    focusAreas.push('process');
  }
  
  return focusAreas;
}

// Helper: Generate a specific question from a skill
function generateSkillQuestion(skills) {
  if (!skills || skills.length === 0) return null;
  
  const skill = skills[0];
  const skillLower = skill.toLowerCase();
  
  // CRM/Tools questions
  if (/crm|salesforce|hubspot|zendesk|freshdesk|intercom/i.test(skillLower)) {
    return `Describe your experience using ${skill}. What features have you leveraged most effectively?`;
  }
  
  // Data/BI tools
  if (/power bi|tableau|looker|google analytics|excel/i.test(skillLower)) {
    return `Tell us about a time you used ${skill} to derive insights or make decisions.`;
  }
  
  // Programming/Technical
  if (/python|java|javascript|typescript|react|node|sql|aws|azure/i.test(skillLower)) {
    return `Describe a project where you used ${skill}. What challenges did you face?`;
  }
  
  // Default skill question
  return `What is your experience with ${skill}, and how have you applied it in your work?`;
}

// Helper: Generate question from experience requirement
function generateExperienceQuestion(experience) {
  if (!experience || experience.length === 0) return null;
  
  const exp = experience[0];
  return `This role requires ${exp} of professional experience. How does your background align with this requirement, and what relevant achievements can you share?`;
}

// Helper: Generate question from a specific requirement
function generateRequirementQuestion(requirement) {
  if (!requirement) return null;
  
  const reqLower = requirement.toLowerCase();
  
  // Skip if too generic
  if (requirement.length < 15 || requirement.length > 150) return null;
  
  // Skip if it's about the company not the candidate
  if (/^we offer|we provide|we are|join us|be part|benefits|compensation/i.test(requirement)) return null;
  
  // Extract action verbs for question framing
  const actionMatch = requirement.match(/^(develop|create|manage|lead|analyze|implement|design|build|execute|analyze|hire|mentor|train|establish|drive|ensure|optimize|improve)/i);
  
  if (actionMatch) {
    const verb = actionMatch[1].toLowerCase();
    return `Tell us about a time you ${verb}ed something. What was the situation, your approach, and the outcome?`;
  }
  
  // If no clear action verb, ask about the skill area
  if (/experience|knowledge|proficiency|familiarity/i.test(reqLower)) {
    return `Describe your ${requirement}. Can you provide specific examples?`;
  }
  
  return null;
}

export function generateQuestions(jdAnalysis) {
  const questions = [];
  const usedTemplates = new Set();
  
  // Step 1: Detect focus areas and generate contextual questions
  const focusAreas = detectFocusAreas(jdAnalysis);
  
  for (const area of focusAreas) {
    const templates = QUESTION_TEMPLATES[area];
    if (templates && templates.length > 0 && questions.length < 2) {
      // Pick a unique template for this area
      const template = templates[Math.floor(Math.random() * templates.length)];
      if (!questions.includes(template)) {
        questions.push(template);
        usedTemplates.add(area);
      }
    }
  }
  
  // Step 2: Generate skill-specific question if we have good skills
  const remainingSkills = (jdAnalysis.skills || []).filter(s => 
    !questions.some(q => q.toLowerCase().includes(s.toLowerCase()))
  );
  
  if (remainingSkills.length > 0 && questions.length < 3) {
    const skillQuestion = generateSkillQuestion(remainingSkills.slice(0, 2));
    if (skillQuestion && !questions.includes(skillQuestion)) {
      questions.push(skillQuestion);
    }
  }
  
  // Step 3: Generate experience-aligned question
  if ((jdAnalysis.experience || []).length > 0 && questions.length < 3) {
    const expQuestion = generateExperienceQuestion(jdAnalysis.experience);
    if (expQuestion && !questions.includes(expQuestion)) {
      questions.push(expQuestion);
    }
  }
  
  // Step 4: Generate question from a specific requirement (if any are good)
  for (const req of (jdAnalysis.requirements || [])) {
    if (questions.length >= 4) break;
    
    const reqQuestion = generateRequirementQuestion(req);
    if (reqQuestion && !questions.includes(reqQuestion)) {
      questions.push(reqQuestion);
    }
  }
  
  // Step 5: Fill remaining slots with smart general questions
  const generalTemplates = QUESTION_TEMPLATES.general;
  for (const template of generalTemplates) {
    if (questions.length >= 5) break;
    if (!questions.includes(template)) {
      questions.push(template);
    }
  }
  
  return questions.slice(0, 5);
}

// ============================================================
// EXAMPLE OUTPUT
// ============================================================

// For a Customer Experience Supervisor JD like the one you shared:
// Instead of asking: "The JD highlights: members, consistent, opportunities. Describe your relevant experience with these areas."
// 
// Now it generates smart contextual questions like:
// 1. "Describe your experience leading a team. What challenges did you face and how did you overcome them?" (leadership detected)
// 2. "Describe your experience improving customer satisfaction or experience. What metrics did you impact?" (customer experience detected)
// 3. "This role requires 3+ years of professional experience. How does your background align with this requirement, and what relevant achievements can you share?" (experience requirement)
// 4. "Describe a challenging problem you solved. What was your approach?" (general fallback)
// 5. "Why are you interested in this position, and what excites you most about it?" (general fallback)

// ============================================================
// TO USE THIS FIX:
// ============================================================
// 
// 1. Replace lib/ats.ts with the code above
// 2. Update app/page.tsx to import and use these functions
// 3. See the changes in the main app/page.tsx for the import/update code
//
// The key changes:
// - Added EXCLUDED_KEYWORD_PATTERNS to filter out "members", "consistent", "opportunities", etc.
// - Added ACTIONABLE_SKILL_PATTERNS for CRM tools, BI tools, frameworks, soft skills
// - Improved analyzeJobDescription to properly extract real skills
// - Completely rewrote generateQuestions to detect focus areas and generate contextual questions
