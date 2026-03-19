import { useState, useEffect, useCallback, useRef } from "react";
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

// ─── Constants & Helpers ────────────────────────────────────────────────────

const STORAGE_KEY = "resume-optimizer-data";
const MAX_RESUMES = 5;

const ATS_KEYWORDS_BY_CATEGORY = {
  technical: [],
  soft: ["leadership", "communication", "collaboration", "problem-solving", "teamwork", "analytical", "adaptable", "detail-oriented", "organized", "self-motivated"],
  action: ["achieved", "implemented", "developed", "managed", "designed", "created", "led", "optimized", "delivered", "improved", "launched", "built", "streamlined", "analyzed", "executed", "spearheaded", "orchestrated", "pioneered"]
};

function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item) => item.str).join(" ");
          fullText += pageText + "\n";
        }
        resolve(fullText.trim());
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function extractKeywords(text) {
  const lower = text.toLowerCase();
  const words = lower.match(/\b[a-z][a-z+#.-]{1,30}\b/g) || [];
  const bigrams = [];
  const wordArr = lower.split(/\s+/);
  for (let i = 0; i < wordArr.length - 1; i++) {
    const a = wordArr[i].replace(/[^a-z]/g, "");
    const b = wordArr[i + 1].replace(/[^a-z]/g, "");
    if (a.length > 1 && b.length > 1) bigrams.push(a + " " + b);
  }
  const freq = {};
  [...words, ...bigrams].forEach((w) => {
    if (w.length > 2) freq[w] = (freq[w] || 0) + 1;
  });

  // Massive stopword list: generic English, JD filler, culture language, pronouns, vague nouns
  const stopwords = new Set([
    // Common English
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was",
    "one", "our", "out", "has", "have", "with", "this", "that", "from", "they", "will",
    "been", "each", "make", "like", "long", "very", "when", "what", "were", "there",
    "about", "which", "would", "their", "more", "some", "them", "than", "other", "into",
    "also", "able", "work", "year", "must", "should", "could", "being", "well", "such",
    "your", "who", "how", "its", "may", "over", "after", "before", "most", "only",
    "just", "where", "those", "these", "then", "need", "needs", "both", "way", "want",
    "come", "made", "find", "back", "many", "much", "great", "good", "best", "new",
    "first", "last", "own", "part", "take", "get", "high", "low", "big", "small",
    "help", "keep", "still", "here", "every", "even", "next", "same", "another",
    "know", "think", "see", "look", "give", "use", "tell", "because", "thing", "things",
    "through", "between", "under", "around", "while", "during", "including", "across",
    "along", "within", "without", "toward", "towards", "among", "against", "upon",
    "does", "doing", "done", "goes", "going", "gone", "says", "said", "feel", "feels",
    "felt", "means", "meant", "show", "shows", "shown", "turn", "turns", "turned",
    "left", "right", "whether", "become", "becomes", "became", "let", "lets",
    "wants", "wants", "trying", "tried", "simple", "simply", "sounds", "typical",
    "comes", "coming", "receive", "receives", "deliver", "delivers", "expect", "expects",
    "identify", "stress", "wrong", "matters", "matter", "care", "cared", "leave", "leaves",
    "handle", "handles", "handling", "compromise", "compromising", "requires", "requiring",
    "thousands", "hundreds", "millions",
    // Pronouns and determiners
    "someone", "anyone", "everyone", "something", "anything", "everything",
    "nobody", "nothing", "whoever", "whatever", "somewhere", "anywhere",
    "themselves", "yourself", "ourselves", "himself", "herself", "itself",
    // JD filler language
    "clear", "clearly", "strong", "strongly", "ensure", "ability", "including",
    "related", "based", "using", "working", "looking", "understanding", "building",
    "creating", "making", "taking", "providing", "supporting", "leading", "developing",
    "managing", "delivering", "driving", "growing", "improving", "maintaining",
    "role", "roles", "position", "team", "teams", "company", "job", "candidate",
    "ideal", "preferred", "required", "plus", "bonus", "equivalent", "similar",
    "experience", "experiences", "responsible", "responsibilities", "opportunity",
    "environment", "environments", "organization", "organizations", "success",
    "successful", "effectively", "excellent", "exceptional", "proven", "track",
    "record", "demonstrated", "deep", "solid", "relevant", "minimum", "least",
    "highly", "passionate", "eager", "comfortable", "familiar", "proficient",
    "translate", "vision", "delivery", "lead", "owner", "strong", "development",
    // Culture/values JD language
    "believe", "believes", "thrive", "thrives", "obsessed", "raving", "legendary",
    "mission", "wins", "winning", "excuses", "intense", "motivates", "motivating",
    "constantly", "constant", "direction", "predictable", "slow", "fast", "faster",
    "quickly", "early", "hard", "harder", "extreme", "massive", "single",
    // Generic nouns that aren't skills
    "customers", "customer", "people", "person", "friends", "fans", "brand", "brands",
    "messages", "message", "interaction", "interactions", "answers", "answer",
    "problems", "problem", "solutions", "solution", "outcome", "outcomes",
    "systems", "system", "process", "processes", "result", "results",
    "growth", "volume", "pressure", "quality", "speed", "standard", "standards",
    "goal", "goals", "advantage", "response", "responses", "ticket", "tickets",
    "day", "days", "hours", "hour", "time", "times", "level", "levels",
    "type", "types", "kind", "kinds", "sort", "lots", "bit",
    // "this role" type bigrams
    "this role", "this is", "that means", "you will", "you are", "we are",
    "not for", "if you", "what you", "your job", "our goal", "we receive",
    "sounds like", "looks like", "signing up", "will be", "should feel"
  ]);

  return Object.entries(freq)
    .filter(([w]) => !stopwords.has(w) && w.length > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([w]) => w);
}

function parseJD(text) {
  const keywords = extractKeywords(text);
  const lower = text.toLowerCase();
  const requirements = [];
  const lines = text.split(/\n/);
  let inReq = false;
  for (const line of lines) {
    const l = line.trim().toLowerCase();
    if (/requirement|qualification|must have|what you.ll|what we.re looking|what this role|what you will|you will own|you will be/i.test(l)) {
      inReq = true;
      continue;
    }
    if (inReq && /^\s*$/.test(line)) { inReq = false; continue; }
    if (inReq && /^[\s•\-*]/.test(line)) requirements.push(line.trim().replace(/^[•\-*]\s*/, ""));
  }
  const yearsMatch = lower.match(/(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/);
  const experience = yearsMatch ? parseInt(yearsMatch[1]) : null;

  // Filter skills aggressively — remove anything that's clearly not a real skill/technology
  const genericNouns = new Set([
    "experience", "team", "company", "role", "position", "job", "candidate",
    "ability", "skills", "years", "knowledge", "level", "type", "time",
    "day", "people", "person", "place", "everything", "someone", "anyone",
    "customers", "customer", "friends", "fans", "brand", "brands",
    "interaction", "interactions", "messages", "message", "answers", "answer",
    "problems", "problem", "outcome", "outcomes", "result", "results",
    "ticket", "tickets", "volume", "pressure", "advantage", "excuses",
    "direction", "keyboard", "emails", "comments", "questions", "issues",
    "hospitality", "support", "ownership", "accountability"
  ]);
  const skills = keywords.filter((k) =>
    /[a-z]{2,}/.test(k) && !genericNouns.has(k) && k.length > 3
  );
  return { keywords, skills, requirements, experience, raw: text };
}

function scoreResume(resumeText, jdData) {
  const lower = resumeText.toLowerCase();
  const matchedKeywords = jdData.keywords.filter((k) => lower.includes(k));
  const keywordScore = Math.min(100, Math.round((matchedKeywords.length / Math.max(jdData.keywords.length, 1)) * 100));
  const matchedSkills = jdData.skills.filter((s) => lower.includes(s));
  const skillScore = Math.min(100, Math.round((matchedSkills.length / Math.max(jdData.skills.length, 1)) * 100));
  const actionWords = ATS_KEYWORDS_BY_CATEGORY.action.filter((a) => lower.includes(a));
  const actionScore = Math.min(100, Math.round((actionWords.length / 6) * 100));
  const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(resumeText);
  const hasPhone = /[\d()+\-.\s]{10,}/.test(resumeText);
  const sections = ["experience", "education", "skills", "summary", "objective", "projects"];
  const foundSections = sections.filter((s) => lower.includes(s));
  const formatScore = Math.round(((hasEmail ? 25 : 0) + (hasPhone ? 25 : 0) + Math.min(50, foundSections.length * 12.5)));
  const wordCount = resumeText.split(/\s+/).length;
  const lengthScore = wordCount > 200 && wordCount < 1200 ? 100 : wordCount > 100 ? 70 : 40;
  const overall = Math.round(keywordScore * 0.3 + skillScore * 0.25 + actionScore * 0.15 + formatScore * 0.15 + lengthScore * 0.15);
  return {
    overall, keywordScore, skillScore, actionScore, formatScore, lengthScore,
    matchedKeywords, matchedSkills, missingKeywords: jdData.keywords.filter((k) => !lower.includes(k)).slice(0, 15),
    missingSkills: jdData.skills.filter((s) => !lower.includes(s)).slice(0, 10),
    actionWords, wordCount
  };
}

function generateQuestions(jdData, bestScore) {
  const questions = [];

  // Filter missing skills to only include things that look like real skills (not generic nouns)
  const realMissing = bestScore.missingSkills.filter((s) => {
    const lower = s.toLowerCase();
    // Must be at least 4 chars and look like a real skill, not a generic word
    return lower.length >= 4 && !/^(this|that|they|your|their|every|someone|anyone|customer|people)/.test(lower);
  }).slice(0, 3);

  if (realMissing.length > 0) {
    questions.push({
      id: "missing_skills",
      text: `The JD highlights: ${realMissing.join(", ")}. Describe your relevant experience with these areas.`,
      placeholder: "e.g., I built and managed a customer operations team handling 5,000+ daily inquiries..."
    });
  }

  if (jdData.experience) {
    questions.push({
      id: "years_exp",
      text: `This role asks for ${jdData.experience}+ years of experience. Briefly describe your most relevant experience and tenure.`,
      placeholder: "e.g., 5 years leading customer operations at a high-growth e-commerce brand..."
    });
  }

  // Always ask about achievements — this is universally useful
  questions.push({
    id: "achievements",
    text: "What's your most quantifiable achievement relevant to this role?",
    placeholder: "e.g., Reduced average response time from 24hrs to 90min while scaling team from 3 to 15..."
  });

  // Ask about the core JD focus if we can detect it
  const jdLower = jdData.raw.toLowerCase();
  const isCustomerFocused = /customer (experience|support|service|success)|cx |ticket|response time/i.test(jdData.raw);
  const isOpersFocused = /operations|operational|systems|scale|scaling|process/i.test(jdData.raw);
  const isLeadershipFocused = /manage|leader|team|hire|build a team|head of/i.test(jdData.raw);

  if (isCustomerFocused) {
    questions.push({
      id: "domain_focus",
      text: "Describe your experience managing customer-facing operations at scale — volumes handled, tools used, metrics improved.",
      placeholder: "e.g., Managed CX operations handling 10K+ tickets/week using Zendesk, achieving 95% CSAT..."
    });
  } else if (isOpersFocused) {
    questions.push({
      id: "domain_focus",
      text: "Describe a system or process you built that significantly improved operational efficiency.",
      placeholder: "e.g., Designed an automated ticket routing system that reduced resolution time by 40%..."
    });
  }

  if (isLeadershipFocused && !questions.find(q => q.id === "domain_focus")) {
    questions.push({
      id: "domain_focus",
      text: "Describe your experience building or managing teams. How large, in what domain, and what results?",
      placeholder: "e.g., Built a 12-person support team from scratch, reduced churn by 18% in first quarter..."
    });
  }

  // Unique value — always useful
  questions.push({
    id: "unique_value",
    text: "What unique value do you bring that other candidates might not?",
    placeholder: "e.g., I combine deep technical background with customer operations experience..."
  });

  return questions.slice(0, 5);
}

// ─── AI-Powered Suggestion Generation ───────────────────────────────────────

async function generateSuggestionsForQuestions(questions, allResumes, jdData, bestScore) {
  const combinedResumeText = allResumes.map((r, i) =>
    `=== RESUME ${i + 1}: ${r.name} ===\n${r.text}`
  ).join("\n\n");

  const questionsFormatted = questions.map((q, i) =>
    `Question ${i + 1} (id: "${q.id}"): ${q.text}`
  ).join("\n");

  const prompt = `You are an expert career coach and resume analyst. You have access to ALL of the candidate's resumes and a job description analysis. Your task is to deeply analyze the resume content and generate 3-5 highly specific, personalized suggested answers for each question.

IMPORTANT RULES:
- Mine REAL details from the resumes: specific technologies, company names, project descriptions, metrics, team sizes, outcomes
- Each suggestion should take a DIFFERENT ANGLE or highlight DIFFERENT experiences from across the resumes
- Incorporate JD keywords naturally where the candidate's experience genuinely supports them
- Use strong action verbs and quantifiable metrics where found in the resumes
- Make suggestions ready-to-use but editable — they should sound like the candidate wrote them
- If the resume doesn't contain enough info for a suggestion, create a plausible template based on the resume's implied seniority and domain, clearly marked with [placeholder] for parts the user should fill in

CANDIDATE'S RESUMES:
${combinedResumeText}

JOB DESCRIPTION ANALYSIS:
- Key Skills Required: ${jdData.skills.slice(0, 15).join(", ")}
- Missing Skills from Best Resume: ${bestScore.missingSkills.slice(0, 8).join(", ")}
- Missing Keywords: ${bestScore.missingKeywords.slice(0, 10).join(", ")}
- Matched Skills: ${bestScore.matchedSkills.join(", ")}
- Years Required: ${jdData.experience || "Not specified"}
- Requirements: ${jdData.requirements.slice(0, 5).join("; ")}

QUESTIONS TO ANSWER:
${questionsFormatted}

Respond with ONLY a JSON object in this exact format (no markdown, no backticks, no commentary):
{
  "questions": [
    {
      "id": "question_id_here",
      "suggestions": [
        {
          "text": "The full suggested answer text here",
          "source": "Brief label like 'From Resume 1: Project X' or 'Cross-resume: Leadership theme'",
          "confidence": "high"
        }
      ]
    }
  ]
}

Generate 3-5 suggestions per question. "confidence" should be "high" if directly supported by resume content, "medium" if reasonably inferred, and "low" if it's a template the user should customize.`;

  try {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    const text = data.content?.map((c) => c.text || "").join("") || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("AI suggestions failed:", err);
    return null;
  }
}

function generateFallbackSuggestions(questions, allResumes, jdData, bestScore) {
  const combinedText = allResumes.map((r) => r.text).join(" ");
  const lower = combinedText.toLowerCase();
  const extractBullets = (text) => text.split(/\n/).filter((l) => /^[\s•\-*]/.test(l) && l.trim().length > 20).map((l) => l.trim().replace(/^[•\-*]\s*/, ""));
  const allBullets = allResumes.flatMap((r) => extractBullets(r.text));
  const metricBullets = allBullets.filter((b) => /\d+%|\d+x|\$[\d,]+|\d+ (users|customers|clients|team|members|projects)/.test(b));
  const techTerms = jdData.skills.filter((s) => lower.includes(s));
  const years = lower.match(/(\d+)\+?\s*years?/g) || [];

  return {
    questions: questions.map((q) => {
      const suggestions = [];
      if (q.id === "missing_skills") {
        const relevant = allBullets.filter((b) => bestScore.missingSkills.some((s) => b.toLowerCase().includes(s))).slice(0, 2);
        relevant.forEach((b) => suggestions.push({ text: b, source: "From resume experience", confidence: "high" }));
        if (techTerms.length > 0) suggestions.push({ text: `Leveraged ${techTerms.slice(0, 3).join(", ")} in production environments, delivering scalable solutions that met demanding performance requirements.`, source: "Cross-resume: Technical skills", confidence: "medium" });
        if (suggestions.length < 3) suggestions.push({ text: `Applied [specific technology] to [project/initiative], resulting in [measurable outcome]. This experience directly maps to the ${bestScore.missingSkills.slice(0, 2).join(" and ")} requirements in this role.`, source: "Template — customize with your details", confidence: "low" });
      } else if (q.id === "years_exp") {
        if (years.length > 0) suggestions.push({ text: `${years[0]} of progressive experience spanning ${techTerms.slice(0, 4).join(", ")}, with increasing ownership of architecture decisions and team leadership.`, source: "Inferred from resume timeline", confidence: "medium" });
        suggestions.push({ text: `Built deep expertise across the full stack through roles at [Company A] and [Company B], progressing from individual contributor to leading cross-functional initiatives.`, source: "Template from career trajectory", confidence: "low" });
        if (metricBullets.length > 0) suggestions.push({ text: `My most formative experience: ${metricBullets[0]}`, source: "Top achievement from resume", confidence: "high" });
      } else if (q.id === "achievements") {
        metricBullets.slice(0, 3).forEach((b) => suggestions.push({ text: b, source: "Quantified achievement from resume", confidence: "high" }));
        if (suggestions.length < 3) suggestions.push({ text: `Delivered [project] that improved [metric] by [X]%, directly impacting [business outcome] for a team of [N] engineers.`, source: "Template — add your numbers", confidence: "low" });
      } else if (q.id === "unique_value") {
        const domains = new Set();
        allResumes.forEach((r) => {
          if (/manag|lead|direct/i.test(r.text)) domains.add("leadership");
          if (/design|architect/i.test(r.text)) domains.add("architecture");
          if (/data|analy/i.test(r.text)) domains.add("data & analytics");
          if (/product/i.test(r.text)) domains.add("product thinking");
        });
        if (domains.size > 1) suggestions.push({ text: `I bridge ${Array.from(domains).slice(0, 3).join(", ")} — a rare combination that lets me see problems holistically rather than through a single lens.`, source: "Cross-resume theme analysis", confidence: "medium" });
        suggestions.push({ text: `My background uniquely combines [Domain A] with [Domain B], allowing me to [specific advantage]. Few candidates can [differentiator].`, source: "Template — define your edge", confidence: "low" });
        if (techTerms.length > 3) suggestions.push({ text: `Deep fluency across ${techTerms.slice(0, 5).join(", ")} means I don't just build features — I make informed technology choices that compound over time.`, source: "Technical breadth from resumes", confidence: "medium" });
      } else if (q.id === "domain_exp") {
        const certs = allBullets.filter((b) => /certif|aws|gcp|azure|pmp|scrum|hipaa|sox|gdpr/i.test(b)).slice(0, 2);
        certs.forEach((c) => suggestions.push({ text: c, source: "Certification from resume", confidence: "high" }));
        suggestions.push({ text: `Worked extensively in [industry/domain], building [type of system] that handled [scale]. Familiar with [relevant compliance/standards].`, source: "Template — add domain specifics", confidence: "low" });
      }
      while (suggestions.length < 3) suggestions.push({ text: `[Customize: ${q.text.substring(0, 50)}...]`, source: "Placeholder", confidence: "low" });
      return { id: q.id, suggestions: suggestions.slice(0, 5) };
    })
  };
}

// ─── Resume Generation ──────────────────────────────────────────────────────

async function generateOptimizedResume(bestResume, allResumes, jdData, scores, answers, setStatus) {
  setStatus("Analyzing resume and job description...");

  // Send ALL resume text — no truncation. Combine all resumes so Claude sees everything.
  const allResumeText = allResumes.map((r, i) =>
    `=== RESUME ${i + 1}: ${r.name} ===\n${r.text}`
  ).join("\n\n");

  // Use the best-scoring resume as the primary structure
  const prompt = `You are an expert ATS resume optimizer. Your job is to ENHANCE an existing resume for a specific job description — NOT to rewrite it from scratch.

CRITICAL RULES:
1. PRESERVE all real job titles, company names, dates, education, and certifications exactly as they appear
2. REWRITE each bullet point to be stronger: lead with action verbs, add JD-relevant keywords naturally, emphasize metrics
3. DO NOT fabricate experience, companies, titles, or metrics the candidate never mentioned
4. DO NOT drop any jobs or sections — every role in the original resume must appear in the output
5. If the candidate has multiple resumes, merge the best content from all of them into one cohesive resume
6. The summary should be rewritten to align with the JD while accurately reflecting the candidate's real background
7. The skills section should list REAL skills from the resumes, reordered so JD-relevant ones come first, plus any from the questionnaire answers that are genuine
8. Reorder bullet points within each job so the most JD-relevant ones appear first

CANDIDATE'S RESUMES (use ALL of this content — do not skip any jobs):
${allResumeText}

JOB DESCRIPTION — KEY SKILLS & KEYWORDS TO WEAVE IN:
${jdData.skills.slice(0, 20).join(", ")}

REQUIREMENTS FROM JD:
${jdData.requirements.slice(0, 8).join("\n")}

SKILLS CURRENTLY MISSING FROM RESUME (weave in ONLY where truthfully supported):
${scores.missingSkills.slice(0, 8).join(", ")}

YEARS EXPERIENCE REQUIRED: ${jdData.experience || "Not specified"}

CANDIDATE'S QUESTIONNAIRE ANSWERS (use these to enhance bullets and add context):
${Object.entries(answers).filter(([k, v]) => v?.trim()).map(([k, v]) => `${k}: ${v}`).join("\n")}

EXAMPLE OF GOOD BULLET REWRITING:
Original: "Worked with numerous clients in the Web3 space for their project visions"
Optimized: "Defined product roadmaps and technical requirements for 80+ Web3 clients spanning NFT platforms, decentralized exchanges, and blockchain gaming ecosystems"

Notice: same experience, but stronger verb, added specificity, wove in JD keywords naturally.

Respond with ONLY a JSON object (no markdown, no backticks, no commentary) in this format:
{
  "name": "Full Name from resume",
  "contact": "email | phone | location | linkedin (from resume)",
  "summary": "3-4 sentence professional summary that aligns with the JD while reflecting real experience",
  "skills": ["real_skill_1", "real_skill_2", "ordered_by_jd_relevance"],
  "experience": [
    {
      "title": "Exact Job Title from resume",
      "company": "Exact Company Name from resume",
      "dates": "Exact dates from resume",
      "bullets": [
        "Rewritten bullet 1 — stronger verb, JD keywords woven in, metrics preserved",
        "Rewritten bullet 2",
        "Rewritten bullet 3"
      ]
    }
  ],
  "education": [
    {
      "degree": "Exact degree from resume",
      "school": "Exact school from resume",
      "year": "Year from resume"
    }
  ],
  "certifications": ["Exact certifications from resume"]
}`;

  try {
    setStatus("Generating optimized resume with AI...");
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    const text = data.content?.map((c) => c.text || "").join("") || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("AI generation failed, using fallback:", err);
    setStatus("Using local optimization...");
    return fallbackGenerate(bestResume, allResumes, jdData, scores, answers);
  }
}

function fallbackGenerate(bestResume, allResumes, jdData, scores, answers) {
  // Parse the best resume's actual content as best we can
  const text = bestResume.text;
  const lines = text.split("\n").filter((l) => l.trim());

  // Try to extract name from first meaningful line
  const name = lines.find((l) => l.trim().length > 2 && l.trim().length < 60 && !/[@|•\-*]/.test(l)) || "Your Name";

  // Try to find contact info
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/[\d()+\-.\s]{10,15}/);
  const contactParts = [emailMatch?.[0], phoneMatch?.[0]].filter(Boolean);
  const contact = contactParts.join(" | ") || "email@example.com";

  // Extract bullet points (lines starting with bullet-like chars)
  const bullets = lines
    .filter((l) => /^[\s]*[•\-*▪►]/.test(l) || /^\s*\d+[.)]\s/.test(l))
    .map((l) => l.trim().replace(/^[•\-*▪►]\s*/, "").replace(/^\d+[.)]\s*/, ""));

  // Extract non-bullet content lines that look like job titles or sections
  const sectionHeaders = lines.filter((l) => {
    const trimmed = l.trim();
    return trimmed.length > 3 && trimmed.length < 80 && !/^[•\-*]/.test(trimmed) && /[A-Z]/.test(trimmed);
  });

  // Build skills from matched + missing
  const skills = [...new Set([...scores.matchedSkills, ...scores.missingSkills.slice(0, 5)])];

  // Build experience preserving real bullets, enhanced with questionnaire answers
  const allBullets = [...bullets];
  if (answers.missing_skills) allBullets.push(answers.missing_skills);
  if (answers.achievements) allBullets.push(answers.achievements);
  if (answers.years_exp) allBullets.push(answers.years_exp);

  const summary = answers.unique_value
    ? `${answers.unique_value} Experienced in ${skills.slice(0, 4).join(", ")}.`
    : `Professional with expertise in ${skills.slice(0, 5).join(", ")}. ${allBullets[0] || "Proven track record of delivering results."}`;

  return {
    name: name.trim(),
    contact,
    summary,
    skills,
    experience: [{
      title: sectionHeaders.find((h) => /engineer|manager|director|developer|analyst|lead|consultant|specialist|coordinator/i.test(h)) || "Professional Experience",
      company: "",
      dates: "",
      bullets: allBullets.length > 0 ? allBullets.slice(0, 8) : ["Experience details — please verify and enhance"]
    }],
    education: [{ degree: "See original resume", school: "", year: "" }],
    certifications: answers.domain_exp ? [answers.domain_exp] : []
  };
}

function generatePDFFromData(resumeData) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth(); // 612
  const H = doc.internal.pageSize.getHeight(); // 792
  const mL = 46; // left margin
  const mR = 46; // right margin
  const mTop = 40;
  const mBot = 40;
  const contentW = W - mL - mR;
  let y = mTop;

  // ── Helpers ──

  const canFit = (needed) => y + needed <= H - mBot;

  const newPageIfNeeded = (needed) => {
    if (!canFit(needed)) { doc.addPage(); y = mTop; }
  };

  const drawText = (text, x, fontSize, style, color, maxWidth, align) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", style || "normal");
    doc.setTextColor(...(color || [40, 40, 40]));
    const lines = doc.splitTextToSize(String(text || ""), maxWidth || contentW);
    lines.forEach((line) => {
      newPageIfNeeded(fontSize * 1.2);
      if (align === "center") doc.text(line, W / 2, y, { align: "center" });
      else if (align === "right") doc.text(line, W - mR, y, { align: "right" });
      else doc.text(line, x, y);
      y += fontSize * 1.2;
    });
  };

  const sectionHeading = (title) => {
    newPageIfNeeded(20);
    y += 5;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 39, 68);
    doc.text(title.toUpperCase(), mL, y);
    y += 3.5;
    doc.setDrawColor(26, 39, 68);
    doc.setLineWidth(0.6);
    doc.line(mL, y, W - mR, y);
    y += 7;
  };

  const bulletPoint = (text, fontSize) => {
    const sz = fontSize || 8.5;
    const indent = mL + 8;
    const bMaxW = W - mR - indent;
    doc.setFontSize(sz);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(45, 45, 45);
    const lines = doc.splitTextToSize(String(text || ""), bMaxW);

    // Don't split a bullet across pages — if it won't fit, start a new page
    const totalHeight = lines.length * (sz * 1.2) + 1.5;
    newPageIfNeeded(totalHeight);

    lines.forEach((line, i) => {
      if (i === 0) {
        doc.setFontSize(5.5);
        doc.text("\u2022", mL + 1.5, y - 0.5);
        doc.setFontSize(sz);
      }
      doc.text(line, indent, y);
      y += sz * 1.2;
    });
    y += 1.5;
  };

  // ── Name ──
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 39, 68);
  doc.text(resumeData.name || "Name", W / 2, y, { align: "center" });
  y += 14;

  // ── Contact — split intelligently into multiple lines if needed ──
  if (resumeData.contact) {
    const raw = resumeData.contact;
    // Split on | or common delimiters, trim each part
    const parts = raw.split(/[|,]/).map(p => p.trim()).filter(Boolean);

    if (parts.length > 0) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);

      // Try to fit on one line; if too wide, split into two rows
      const oneLine = parts.join("  |  ");
      const oneLineWidth = doc.getTextWidth(oneLine);

      if (oneLineWidth <= contentW) {
        doc.text(oneLine, W / 2, y, { align: "center" });
        y += 10;
      } else {
        // Split roughly in half
        const mid = Math.ceil(parts.length / 2);
        const row1 = parts.slice(0, mid).join("  |  ");
        const row2 = parts.slice(mid).join("  |  ");
        doc.text(row1, W / 2, y, { align: "center" });
        y += 10;
        doc.text(row2, W / 2, y, { align: "center" });
        y += 10;
      }
    }
  }

  // ── Top divider ──
  y += 2;
  doc.setDrawColor(26, 39, 68);
  doc.setLineWidth(0.8);
  doc.line(mL, y, W - mR, y);
  y += 8;

  // ── Professional Summary ──
  if (resumeData.summary) {
    sectionHeading("Professional Summary");
    drawText(resumeData.summary, mL, 8.5, "normal", [45, 45, 45], contentW);
    y += 2;
  }

  // ── Skills — compact, wrapping naturally ──
  if (resumeData.skills?.length) {
    sectionHeading("Skills");
    const skillsLine = resumeData.skills.join("  \u2022  ");
    drawText(skillsLine, mL, 8.5, "normal", [45, 45, 45], contentW);
    y += 2;
  }

  // ── Experience ──
  if (resumeData.experience?.length) {
    sectionHeading("Experience");
    resumeData.experience.forEach((exp) => {
      // Estimate space needed for job header + at least one bullet
      newPageIfNeeded(40);

      // Title + Company
      const titleText = `${exp.title || ""}${exp.company ? " \u2014 " + exp.company : ""}`;
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);

      // Dates on the right
      if (exp.dates) {
        // Measure dates width to avoid overlap
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        const datesWidth = doc.getTextWidth(exp.dates);
        const titleMaxW = contentW - datesWidth - 12;

        // Draw title (possibly wrapped to avoid dates)
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        const titleLines = doc.splitTextToSize(titleText, titleMaxW);
        titleLines.forEach((line, i) => {
          doc.text(line, mL, y);
          if (i === 0) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(110, 110, 110);
            doc.text(exp.dates, W - mR, y, { align: "right" });
            doc.setFontSize(9.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 30, 30);
          }
          y += 11;
        });
      } else {
        doc.text(titleText, mL, y);
        y += 11;
      }

      y += 1;

      // Bullets
      if (exp.bullets?.length) {
        exp.bullets.forEach((b) => bulletPoint(b));
      }
      y += 3;
    });
  }

  // ── Education ──
  if (resumeData.education?.length) {
    sectionHeading("Education");
    resumeData.education.forEach((ed) => {
      newPageIfNeeded(14);
      const edText = `${ed.degree || ""}${ed.school ? " \u2014 " + ed.school : ""}${ed.year ? " (" + ed.year + ")" : ""}`;
      drawText(edText, mL, 8.5, "normal", [45, 45, 45], contentW);
      y += 1;
    });
  }

  // ── Certifications ──
  if (resumeData.certifications?.length && resumeData.certifications.some((c) => c)) {
    sectionHeading("Certifications");
    resumeData.certifications.filter((c) => c).forEach((cert) => {
      bulletPoint(cert, 8.5);
    });
  }

  doc.save("optimized_resume.pdf");
}

// ─── Styles ────────────────────────────────────────────────────────────────

const S = {
  app: { fontFamily: "'DM Sans', 'Segoe UI', sans-serif", minHeight: "100vh", background: "linear-gradient(165deg, #0a0e1a 0%, #111827 40%, #0f172a 100%)", color: "#e2e8f0", padding: 0, margin: 0 },
  header: { padding: "40px 32px 28px", textAlign: "center", position: "relative", overflow: "hidden" },
  headerBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% -20%, rgba(99,102,241,0.15) 0%, transparent 60%)", pointerEvents: "none" },
  logo: { fontSize: 36, fontWeight: 800, letterSpacing: "-1.5px", background: "linear-gradient(135deg, #818cf8, #6366f1, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#94a3b8", fontWeight: 400, letterSpacing: "0.5px" },
  main: { maxWidth: 1120, margin: "0 auto", padding: "0 24px 60px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 },
  card: { background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 16, padding: 28, position: "relative", overflow: "hidden" },
  cardGlow: (color) => ({ position: "absolute", top: -1, left: -1, right: -1, height: 3, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, borderRadius: "16px 16px 0 0" }),
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 },
  badge: (color) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: color, fontSize: 14 }),
  dropzone: (active) => ({
    border: `2px dashed ${active ? "#818cf8" : "rgba(148,163,184,0.25)"}`,
    borderRadius: 12, padding: "36px 20px", textAlign: "center", cursor: "pointer",
    background: active ? "rgba(129,140,248,0.08)" : "rgba(15,23,42,0.4)",
    transition: "all 0.2s ease"
  }),
  resumeChip: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, marginBottom: 8, fontSize: 13 },
  textarea: { width: "100%", minHeight: 200, background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 10, padding: 16, color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none", lineHeight: 1.6, boxSizing: "border-box" },
  btn: (variant) => ({
    padding: variant === "lg" ? "14px 32px" : "10px 20px",
    borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: variant === "lg" ? 15 : 13,
    fontFamily: "'DM Sans', sans-serif",
    background: variant === "ghost" ? "transparent" : "linear-gradient(135deg, #6366f1, #818cf8)",
    color: variant === "ghost" ? "#94a3b8" : "#fff",
    transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 8
  }),
  btnDanger: { padding: "4px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 12, fontFamily: "'DM Sans', sans-serif" },
  scoreCircle: (score) => ({
    width: 72, height: 72, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 22, fontWeight: 800, color: "#fff",
    background: `conic-gradient(${score >= 70 ? "#22c55e" : score >= 45 ? "#eab308" : "#ef4444"} ${score * 3.6}deg, rgba(51,65,85,0.5) 0deg)`,
    position: "relative"
  }),
  scoreInner: { position: "absolute", width: 56, height: 56, borderRadius: "50%", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" },
  input: { width: "100%", padding: "10px 14px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 8, color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" },
  progressBar: () => ({ width: "100%", height: 6, borderRadius: 3, background: "rgba(51,65,85,0.5)", overflow: "hidden", position: "relative" }),
  progressFill: (pct, color) => ({ position: "absolute", top: 0, left: 0, height: "100%", width: `${pct}%`, borderRadius: 3, background: color, transition: "width 0.6s ease" }),
  tag: (matched) => ({
    display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, margin: "2px 4px 2px 0",
    background: matched ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.1)",
    color: matched ? "#4ade80" : "#f87171",
    border: `1px solid ${matched ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.15)"}`
  }),
  stepIndicator: (active, done) => ({
    width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700,
    background: done ? "#22c55e" : active ? "#6366f1" : "rgba(51,65,85,0.6)",
    color: "#fff", transition: "all 0.3s", flexShrink: 0
  }),
  stepLine: (done) => ({ flex: 1, height: 2, background: done ? "#22c55e" : "rgba(51,65,85,0.4)", margin: "0 8px", borderRadius: 1 })
};

// ─── Sub-Components ────────────────────────────────────────────────────────

function ScoreRing({ score, size = 72 }) {
  const inner = size - 16;
  return (
    <div style={{ ...S.scoreCircle(score), width: size, height: size }}>
      <div style={{ ...S.scoreInner, width: inner, height: inner }}>{score}</div>
    </div>
  );
}

function ProgressBar({ value, color = "#6366f1" }) {
  return (<div style={S.progressBar()}><div style={S.progressFill(value, color)} /></div>);
}

function StepProgress({ step }) {
  const steps = ["Upload", "Paste JD", "Score", "Questions", "Generate"];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32, padding: "0 20px" }}>
      {steps.map((label, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={S.stepIndicator(step === i, step > i)}>{step > i ? "✓" : i + 1}</div>
            <span style={{ fontSize: 10, color: step >= i ? "#e2e8f0" : "#64748b", fontWeight: step === i ? 600 : 400 }}>{label}</span>
          </div>
          {i < steps.length - 1 && <div style={{ ...S.stepLine(step > i), marginTop: -16 }} />}
        </div>
      ))}
    </div>
  );
}

// ─── Suggestion Card ────────────────────────────────────────────────────────

function SuggestionCard({ suggestion, isSelected, onSelect }) {
  const confidenceColors = { high: "#22c55e", medium: "#eab308", low: "#94a3b8" };
  const confidenceLabels = { high: "Strong match", medium: "Inferred", low: "Template" };
  const confidenceIcons = { high: "◆", medium: "◈", low: "◇" };
  const color = confidenceColors[suggestion.confidence] || "#94a3b8";

  return (
    <div
      onClick={onSelect}
      style={{
        padding: "14px 16px", borderRadius: 10,
        border: `1.5px solid ${isSelected ? "#818cf8" : "rgba(148,163,184,0.12)"}`,
        background: isSelected ? "rgba(99,102,241,0.1)" : "rgba(15,23,42,0.35)",
        cursor: "pointer", transition: "all 0.2s ease", position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
          border: `2px solid ${isSelected ? "#818cf8" : "rgba(148,163,184,0.3)"}`,
          background: isSelected ? "#6366f1" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s"
        }}>
          {isSelected && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.65, marginBottom: 8 }}>
            {suggestion.text}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 600, color, letterSpacing: "0.3px",
              padding: "2px 8px", borderRadius: 4,
              background: `${color}15`, border: `1px solid ${color}30`
            }}>
              <span style={{ fontSize: 8 }}>{confidenceIcons[suggestion.confidence]}</span>
              {confidenceLabels[suggestion.confidence]}
            </span>
            <span style={{ fontSize: 10, color: "#64748b" }}>{suggestion.source}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Question Block with Suggestions ────────────────────────────────────────

function QuestionBlock({ question, index, suggestions, answer, onAnswerChange, isLoading }) {
  const [editing, setEditing] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const textareaRef = useRef(null);

  const handleSelect = (idx) => {
    setSelectedIdx(idx);
    setEditing(false);
    onAnswerChange(suggestions[idx].text);
  };

  const handleEditClick = () => {
    setEditing(true);
    setSelectedIdx(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleCustomEdit = () => {
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Skeleton shimmer bars
  const SkeletonSuggestion = ({ width1, width2 }) => (
    <div style={{
      padding: "14px 16px", borderRadius: 10,
      border: "1px solid rgba(148,163,184,0.06)", background: "rgba(15,23,42,0.25)"
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(148,163,184,0.1)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{
            height: 13, width: `${width1}%`, borderRadius: 4, marginBottom: 6,
            background: "linear-gradient(90deg, rgba(148,163,184,0.08), rgba(148,163,184,0.16), rgba(148,163,184,0.08))",
            backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite"
          }} />
          <div style={{
            height: 13, width: `${width1 - 15}%`, borderRadius: 4, marginBottom: 8,
            background: "linear-gradient(90deg, rgba(148,163,184,0.06), rgba(148,163,184,0.12), rgba(148,163,184,0.06))",
            backgroundSize: "200% 100%", animation: "shimmer 1.7s infinite"
          }} />
          <div style={{
            height: 10, width: `${width2}%`, borderRadius: 4,
            background: "linear-gradient(90deg, rgba(148,163,184,0.05), rgba(148,163,184,0.1), rgba(148,163,184,0.05))",
            backgroundSize: "200% 100%", animation: "shimmer 2s infinite"
          }} />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      background: "rgba(15,23,42,0.3)", border: "1px solid rgba(148,163,184,0.08)",
      borderRadius: 14, padding: 24, marginBottom: 20
    }}>
      {/* Question header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: "linear-gradient(135deg, #6366f1, #818cf8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: "#fff"
        }}>
          {index + 1}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.55 }}>
          {question.text}
        </div>
      </div>

      {/* Suggestion area */}
      <div style={{ paddingLeft: 40 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: "#818cf8", letterSpacing: "1.2px",
          marginBottom: 10, textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 6
        }}>
          <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: "rgba(99,102,241,0.2)", textAlign: "center", lineHeight: "14px", fontSize: 9 }}>
            {isLoading ? "⟳" : "✦"}
          </span>
          {isLoading ? "Analyzing your resumes..." : "AI-Suggested Answers"}
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            <SkeletonSuggestion width1={85} width2={35} />
            <SkeletonSuggestion width1={78} width2={42} />
            <SkeletonSuggestion width1={92} width2={30} />
          </div>
        )}

        {/* Actual suggestions */}
        {!isLoading && suggestions && suggestions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {suggestions.map((s, i) => (
              <SuggestionCard
                key={i}
                suggestion={s}
                isSelected={selectedIdx === i && !editing}
                onSelect={() => handleSelect(i)}
              />
            ))}
          </div>
        )}

        {/* Edit / Custom answer controls */}
        {!isLoading && (
          <>
            {!editing && selectedIdx !== null && (
              <button onClick={handleCustomEdit} style={{
                ...S.btn("ghost"), fontSize: 12, padding: "6px 14px",
                border: "1px dashed rgba(148,163,184,0.25)", borderRadius: 8, marginTop: 4
              }}>
                ✏️ Edit selected answer or write your own
              </button>
            )}

            {!editing && selectedIdx === null && (
              <button onClick={handleEditClick} style={{
                ...S.btn("ghost"), fontSize: 12, padding: "6px 14px",
                border: "1px dashed rgba(148,163,184,0.25)", borderRadius: 8, marginTop: 4
              }}>
                ✍️ Write a custom answer instead
              </button>
            )}

            {editing && (
              <div style={{ marginTop: 8 }}>
                <textarea
                  ref={textareaRef}
                  style={{
                    ...S.input, minHeight: 80, resize: "vertical", lineHeight: 1.6,
                    border: "1px solid rgba(99,102,241,0.4)",
                    background: "rgba(99,102,241,0.05)"
                  }}
                  placeholder={question.placeholder}
                  value={answer || ""}
                  onChange={(e) => { setSelectedIdx(null); onAnswerChange(e.target.value); }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                  <button onClick={() => { setEditing(false); if (!answer) setSelectedIdx(null); }}
                    style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>
                    Done editing
                  </button>
                </div>
              </div>
            )}

            {/* Answer confirmation */}
            {answer && !editing && (
              <div style={{
                marginTop: 10, padding: "10px 14px",
                background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)",
                borderRadius: 8, fontSize: 12, color: "#4ade80",
                display: "flex", alignItems: "center", gap: 8
              }}>
                <span>✓</span>
                <span style={{ color: "#94a3b8" }}>Answer saved ({answer.length} chars)</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────

export default function ResumeOptimizer() {
  const [resumes, setResumes] = useState([]);
  const [jdText, setJdText] = useState("");
  const [jdData, setJdData] = useState(null);
  const [scores, setScores] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [suggestions, setSuggestions] = useState({});
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [optimizedResume, setOptimizedResume] = useState(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    setPdfReady(true);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.resumes?.length) { setResumes(data.resumes); setStep(1); }
      }
    } catch (e) { /* no stored data */ }
  }, []);

  const saveResumes = useCallback((r) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ resumes: r, updatedAt: new Date().toISOString() })); } catch (e) { console.error("Storage save failed:", e); }
  }, []);

  const handleFiles = async (files) => {
    if (!pdfReady) { alert("PDF libraries still loading..."); return; }
    const pdfFiles = Array.from(files).filter((f) => f.type === "application/pdf").slice(0, MAX_RESUMES - resumes.length);
    if (!pdfFiles.length) return;
    setLoading(true); setStatus("Extracting text from PDFs...");
    const newResumes = [...resumes];
    for (const file of pdfFiles) {
      try {
        const text = await extractTextFromPDF(file);
        newResumes.push({ name: file.name, text, uploadedAt: new Date().toISOString(), id: Date.now() + Math.random() });
      } catch (e) { console.error("Failed:", file.name, e); }
    }
    setResumes(newResumes); await saveResumes(newResumes);
    if (newResumes.length > 0) setStep(1);
    setLoading(false); setStatus("");
  };

  const removeResume = async (id) => {
    const updated = resumes.filter((r) => r.id !== id);
    setResumes(updated); await saveResumes(updated);
    if (updated.length === 0) setStep(0);
  };

  const analyzeJD = () => {
    if (!jdText.trim()) return;
    const data = parseJD(jdText); setJdData(data);
    const scored = resumes.map((r) => ({ ...r, score: scoreResume(r.text, data) }));
    scored.sort((a, b) => b.score.overall - a.score.overall);
    setScores(scored); setStep(2);
  };

  const goToQuestions = async () => {
    if (!scores.length || !jdData) return;
    const qs = generateQuestions(jdData, scores[0].score);
    setQuestions(qs); setSuggestions({}); setAnswers({}); setStep(3);
    setSuggestionsLoading(true);
    try {
      const aiResult = await generateSuggestionsForQuestions(qs, resumes, jdData, scores[0].score);
      if (aiResult?.questions) {
        const m = {}; aiResult.questions.forEach((q) => { m[q.id] = q.suggestions; }); setSuggestions(m);
      } else { throw new Error("No AI result"); }
    } catch (e) {
      const fb = generateFallbackSuggestions(qs, resumes, jdData, scores[0].score);
      const m = {}; fb.questions.forEach((q) => { m[q.id] = q.suggestions; }); setSuggestions(m);
    }
    setSuggestionsLoading(false);
  };

  const handleGenerate = async () => {
    setLoading(true); setStep(4);
    try { const result = await generateOptimizedResume(scores[0], resumes, jdData, scores[0].score, answers, setStatus); setOptimizedResume(result); }
    catch (e) { console.error(e); setStatus("Generation failed."); }
    setLoading(false); setStatus("");
  };

  const downloadPDF = () => { if (optimizedResume) generatePDFFromData(optimizedResume); };

  const resetFlow = () => {
    setJdText(""); setJdData(null); setScores([]); setQuestions([]); setAnswers({});
    setSuggestions({}); setOptimizedResume(null); setStep(resumes.length > 0 ? 1 : 0);
  };

  const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length;

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      <header style={S.header}>
        <div style={S.headerBg} />
        <div style={{ position: "relative" }}>
          <div style={S.logo}>ResumeForge</div>
          <div style={S.subtitle}>AI-POWERED ATS OPTIMIZATION ENGINE</div>
        </div>
      </header>

      <div style={S.main}>
        <StepProgress step={step} />

        {/* Step 0/1: Upload & JD */}
        {step <= 1 && (
          <div style={S.grid}>
            <div style={S.card}>
              <div style={S.cardGlow("#6366f1")} />
              <div style={S.cardTitle}>
                <span style={S.badge("rgba(99,102,241,0.2)")}>📄</span>
                Baseline Resumes ({resumes.length}/{MAX_RESUMES})
              </div>
              {resumes.map((r) => (
                <div key={r.id} style={S.resumeChip}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{r.name}</span>
                  <span style={{ color: "#64748b", fontSize: 11, marginRight: 8 }}>{r.text.split(/\s+/).length} words</span>
                  <button style={S.btnDanger} onClick={() => removeResume(r.id)}>✕</button>
                </div>
              ))}
              {resumes.length < MAX_RESUMES && (
                <div
                  style={S.dropzone(dragOver)}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".pdf" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⬆</div>
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>{loading ? status : "Drop PDFs here or click to upload"}</div>
                  <div style={{ color: "#64748b", fontSize: 11, marginTop: 6 }}>Up to {MAX_RESUMES - resumes.length} more</div>
                </div>
              )}
              {resumes.length >= MAX_RESUMES && <div style={{ textAlign: "center", padding: 16, color: "#22c55e", fontSize: 13 }}>✓ Maximum resumes uploaded</div>}
            </div>
            <div style={S.card}>
              <div style={S.cardGlow("#22c55e")} />
              <div style={S.cardTitle}>
                <span style={S.badge("rgba(34,197,94,0.2)")}>📋</span>
                Job Description
              </div>
              <textarea style={S.textarea} placeholder={"Paste the full job description here...\n\nInclude the role title, requirements, qualifications, and preferred skills."} value={jdText} onChange={(e) => setJdText(e.target.value)} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>{jdText.split(/\s+/).filter(Boolean).length} words</span>
                <button style={{ ...S.btn("lg"), opacity: resumes.length > 0 && jdText.trim() ? 1 : 0.4 }} onClick={analyzeJD} disabled={resumes.length === 0 || !jdText.trim()}>Analyze &amp; Score →</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Scores */}
        {step === 2 && scores.length > 0 && (
          <div style={{ ...S.card, marginBottom: 24 }}>
            <div style={S.cardGlow("#eab308")} />
            <div style={S.cardTitle}><span style={S.badge("rgba(234,179,8,0.2)")}>📊</span> ATS Compatibility Scores</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {scores.map((r, i) => (
                <div key={r.id} style={{ display: "flex", gap: 24, alignItems: "flex-start", padding: 20, background: i === 0 ? "rgba(99,102,241,0.06)" : "rgba(15,23,42,0.3)", borderRadius: 12, border: i === 0 ? "1px solid rgba(99,102,241,0.2)" : "1px solid transparent" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <ScoreRing score={r.score.overall} />
                    {i === 0 && <span style={{ fontSize: 9, color: "#818cf8", fontWeight: 700, letterSpacing: "0.5px" }}>BEST MATCH</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{r.name}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                      {[["Keywords", r.score.keywordScore, "#6366f1"], ["Skills", r.score.skillScore, "#22c55e"], ["Action Verbs", r.score.actionScore, "#eab308"], ["Format", r.score.formatScore, "#f472b6"]].map(([label, val, color]) => (
                        <div key={label}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}><span>{label}</span><span style={{ fontWeight: 700 }}>{val}%</span></div>
                          <ProgressBar value={val} color={color} />
                        </div>
                      ))}
                    </div>
                    {i === 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Matched Keywords:</div>
                        <div style={{ display: "flex", flexWrap: "wrap" }}>{r.score.matchedKeywords.slice(0, 12).map((k) => <span key={k} style={S.tag(true)}>{k}</span>)}</div>
                        {r.score.missingKeywords.length > 0 && (<>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, marginTop: 10 }}>Missing Keywords:</div>
                          <div style={{ display: "flex", flexWrap: "wrap" }}>{r.score.missingKeywords.slice(0, 10).map((k) => <span key={k} style={S.tag(false)}>{k}</span>)}</div>
                        </>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button style={S.btn("ghost")} onClick={resetFlow}>← Start Over</button>
              <button style={S.btn("lg")} onClick={goToQuestions}>Continue to Questions →</button>
            </div>
          </div>
        )}

        {/* Step 3: Enhanced Questionnaire */}
        {step === 3 && (
          <div style={{ ...S.card, marginBottom: 24 }}>
            <div style={S.cardGlow("#a78bfa")} />
            <div style={S.cardTitle}><span style={S.badge("rgba(167,139,250,0.2)")}>🧠</span> Deep-Dive Questionnaire</div>

            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 18px", background: "rgba(99,102,241,0.06)",
              borderRadius: 10, marginBottom: 24, border: "1px solid rgba(99,102,241,0.12)"
            }}>
              <div>
                <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
                  {suggestionsLoading ? "🔍 Analyzing your resumes for personalized suggestions..." : "✨ AI suggestions ready — select, edit, or write your own"}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {suggestionsLoading ? "Mining experience, skills, and achievements across all uploads..." : `${answeredCount} of ${questions.length} questions answered`}
                </div>
              </div>
              {suggestionsLoading && (
                <div style={{ width: 100, height: 6, borderRadius: 3, overflow: "hidden", background: "rgba(99,102,241,0.15)" }}>
                  <div style={{ width: "100%", height: "100%", background: "linear-gradient(90deg, transparent, #818cf8, transparent)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                </div>
              )}
            </div>

            {questions.map((q, i) => (
              <QuestionBlock
                key={q.id}
                question={q}
                index={i}
                suggestions={suggestions[q.id] || []}
                answer={answers[q.id] || ""}
                onAnswerChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
                isLoading={suggestionsLoading}
              />
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button style={S.btn("ghost")} onClick={() => setStep(2)}>← Back to Scores</button>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>{answeredCount}/{questions.length} answered</span>
                <button style={{ ...S.btn("lg"), opacity: answeredCount > 0 ? 1 : 0.4 }} onClick={handleGenerate} disabled={answeredCount === 0}>Generate Optimized Resume →</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 4 && (
          <div style={{ ...S.card, marginBottom: 24 }}>
            <div style={S.cardGlow("#22c55e")} />
            <div style={S.cardTitle}><span style={S.badge("rgba(34,197,94,0.2)")}>✨</span> {loading ? "Generating..." : "Optimized Resume Ready"}</div>
            {loading && (
              <div style={{ textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 16, animation: "spin 1.5s linear infinite" }}>⚙️</div>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>{status || "Processing..."}</div>
              </div>
            )}
            {!loading && optimizedResume && (
              <div>
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 28, border: "1px solid rgba(148,163,184,0.08)", marginBottom: 20 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", textAlign: "center" }}>{optimizedResume.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 20 }}>{optimizedResume.contact}</div>
                  {optimizedResume.summary && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "1px", marginBottom: 6 }}>PROFESSIONAL SUMMARY</div>
                      <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{optimizedResume.summary}</div>
                    </div>
                  )}
                  {optimizedResume.skills?.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "1px", marginBottom: 6 }}>SKILLS</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {optimizedResume.skills.map((s, i) => <span key={i} style={{ padding: "3px 10px", background: "rgba(99,102,241,0.12)", borderRadius: 6, fontSize: 11, color: "#a5b4fc" }}>{s}</span>)}
                      </div>
                    </div>
                  )}
                  {optimizedResume.experience?.map((exp, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                      {i === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "1px", marginBottom: 6 }}>EXPERIENCE</div>}
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>{exp.title}{exp.company ? ` — ${exp.company}` : ""}</div>
                      {exp.dates && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{exp.dates}</div>}
                      {exp.bullets?.map((b, j) => (
                        <div key={j} style={{ fontSize: 12.5, color: "#cbd5e1", paddingLeft: 12, position: "relative", lineHeight: 1.6, marginBottom: 4 }}>
                          <span style={{ position: "absolute", left: 0, color: "#6366f1" }}>•</span>{b}
                        </div>
                      ))}
                    </div>
                  ))}
                  {optimizedResume.education?.map((ed, i) => (
                    <div key={i} style={{ marginBottom: i === 0 ? 8 : 4 }}>
                      {i === 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "1px", marginBottom: 6 }}>EDUCATION</div>}
                      <div style={{ fontSize: 13, color: "#cbd5e1" }}>{ed.degree} — {ed.school}{ed.year ? ` (${ed.year})` : ""}</div>
                    </div>
                  ))}
                  {optimizedResume.certifications?.filter((c) => c).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "1px", marginBottom: 6 }}>CERTIFICATIONS</div>
                      {optimizedResume.certifications.filter((c) => c).map((c, i) => <div key={i} style={{ fontSize: 13, color: "#cbd5e1" }}>• {c}</div>)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button style={S.btn("ghost")} onClick={resetFlow}>← New Job Description</button>
                  <button style={{ ...S.btn("lg"), background: "linear-gradient(135deg, #22c55e, #16a34a)" }} onClick={downloadPDF}>⬇ Download as PDF</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
