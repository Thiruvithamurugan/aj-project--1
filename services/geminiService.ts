import { GoogleGenAI, Type } from "@google/genai";
import { ParsedResume, LearningResource, QuizQuestion, JobListing } from "../types";

// Mutable instance to allow runtime updates
let ai: GoogleGenAI | null = null;

const MODEL_FLASH = 'gemini-2.5-flash';

// --- INITIALIZATION LOGIC ---
const initializeAI = () => {
  try {
    // 1. Try Local Storage (User entered key)
    const localKey = localStorage.getItem('gemini_api_key');
    if (localKey) {
      ai = new GoogleGenAI({ apiKey: localKey });
      return;
    }

    // 2. Try Environment Variable (Safe check for Node/Build process)
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
  } catch (e) {
    console.warn("Gemini API not initialized (Offline/Demo Mode active)");
  }
};

// Run immediately
initializeAI();

// --- PUBLIC CONFIGURATION API ---
export const updateApiKey = (key: string) => {
  if (!key) {
    ai = null;
    localStorage.removeItem('gemini_api_key');
  } else {
    try {
      ai = new GoogleGenAI({ apiKey: key });
      localStorage.setItem('gemini_api_key', key);
    } catch (e) {
      console.error("Failed to initialize AI with provided key");
    }
  }
};

export const hasApiKey = (): boolean => !!ai;


// --- MOCK DATA FOR OFFLINE/DEMO MODE ---
const MOCK_RESUME: ParsedResume = {
  fullName: "Alex Demo (Offline Mode)",
  summary: "This is a generated profile for the Demo Mode. The candidate is a skilled Frontend Engineer with experience in React and modern web technologies. (No API Key detected)",
  skills: ["React", "TypeScript", "Tailwind CSS", "Node.js", "System Design", "GraphQL"],
  yearsOfExperience: 4,
  suggestedRoles: [
    {
      title: "Senior Frontend Engineer",
      matchScore: 92,
      reasoning: "Excellent match based on strong React and TypeScript background demonstrated in the demo profile.",
      requiredSkills: ["Advanced React", "Performance Optimization", "Micro-frontends", "CI/CD"]
    },
    {
      title: "Full Stack Developer",
      matchScore: 85,
      reasoning: "Solid foundation for full stack, though stronger on the frontend. Good potential for growth.",
      requiredSkills: ["Node.js", "PostgreSQL", "AWS", "Docker"]
    },
    {
      title: "Product Engineer",
      matchScore: 78,
      reasoning: "Skills align well with product-focused roles that require both technical implementation and UX sensitivity.",
      requiredSkills: ["Product Analytics", "A/B Testing", "UX Research", "Agile Methodologies"]
    }
  ]
};

const MOCK_RESOURCES: LearningResource[] = [
  {
    title: "Advanced React Patterns & Performance",
    type: "Course",
    url: "https://react.dev/learn",
    description: "Deep dive into concurrency, suspense, and advanced hooks for building scalable applications."
  },
  {
    title: "The Total TypeScript Handbook",
    type: "Documentation",
    url: "https://www.typescriptlang.org/docs/",
    description: "Comprehensive guide to static typing, generics, and type manipulation."
  },
  {
    title: "System Design for Client-Side Engineers",
    type: "Article",
    url: "#",
    description: "Learn how to design large-scale frontend applications, focusing on caching, state management, and network performance."
  },
  {
    title: "Web Accessibility (A11y) Masterclass",
    type: "Video",
    url: "#",
    description: "Ensure your applications are usable by everyone. Covers ARIA, focus management, and screen readers."
  },
  {
    title: "Modern CSS Architecture",
    type: "Article",
    url: "#",
    description: "Strategies for scalable CSS using Tailwind, CSS Modules, or CSS-in-JS."
  }
];

const MOCK_QUIZ: QuizQuestion[] = [
  {
    question: "In React, what is the main purpose of the `useEffect` cleanup function?",
    options: [
      "To clear the component's state",
      "To cancel subscriptions, timers, or listeners to prevent memory leaks",
      "To trigger a re-render",
      "To delete the component from the DOM immediately"
    ],
    correctAnswer: 1,
    explanation: "The cleanup function is called before the component unmounts or before the effect runs again, allowing you to clean up side effects like subscriptions.",
    category: "Technical"
  },
  {
    question: "Which HTTP status code indicates that the resource was not found on the server?",
    options: ["200 OK", "301 Moved Permanently", "404 Not Found", "500 Internal Server Error"],
    correctAnswer: 2,
    explanation: "404 indicates that the server cannot find the requested resource.",
    category: "Technical"
  },
  {
    question: "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?",
    options: ["$0.05", "$0.10", "$0.15", "$0.01"],
    correctAnswer: 0,
    explanation: "If Ball = x, then Bat = x + 1. Total = x + (x + 1) = 1.10. 2x = 0.10, so x = 0.05.",
    category: "Aptitude"
  },
  {
    question: "What does the 'C' in ACID properties of database transactions stand for?",
    options: ["Capacity", "Consistency", "Concurrency", "Durability"],
    correctAnswer: 1,
    explanation: "ACID stands for Atomicity, Consistency, Isolation, and Durability.",
    category: "Technical"
  },
  {
    question: "You have a disagreement with a senior engineer about a technical implementation. How do you handle it?",
    options: [
      "Do it their way immediately to avoid conflict",
      "Argue until they agree with you",
      "Present data and pros/cons for both approaches and discuss openly",
      "Escalate to the manager"
    ],
    correctAnswer: 2,
    explanation: "Focusing on data, trade-offs, and open discussion is the most professional and productive approach.",
    category: "Behavioral"
  }
];

const MOCK_JOBS: JobListing[] = [
  { title: "Senior Frontend Developer", company: "TechCorp (Demo)", location: "Remote", url: "#" },
  { title: "React Native Engineer", company: "AppStudio (Demo)", location: "New York, NY", url: "#" },
  { title: "UI Platform Engineer", company: "CloudScale (Demo)", location: "San Francisco, CA", url: "#" },
  { title: "Software Engineer, Frontend", company: "Streamline (Demo)", location: "London, UK", url: "#" },
  { title: "Full Stack Engineer", company: "StartupX (Demo)", location: "Austin, TX", url: "#" }
];

// Helper to clean Markdown JSON code blocks
const cleanJson = (text: string): string => {
  if (!text) return '{}';
  return text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
};

const handleOfflineError = (error: any, mockData: any, context: string) => {
  console.warn(`Gemini API Error in ${context} (or Offline Mode). Returning mock data.`, error);
  return mockData;
};

export const parseResumeDocument = async (base64Data: string, mimeType: string): Promise<ParsedResume> => {
  if (!ai) {
    console.info("Offline Mode: Returning mock resume.");
    await new Promise(r => setTimeout(r, 1500)); // Simulate processing delay
    return MOCK_RESUME;
  }

  try {
    const prompt = `
      Analyze this document. It could be a Resume, a CV, or an Employment Offer Letter.
      
      1. If it is a **Resume/CV**: Extract the candidate's details normally.
      2. If it is an **Offer Letter** or **Job Description**: 
         - Extract the candidate name (if present).
         - Treat the "Job Role" mentioned as a "Suggested Role".
         - Treat the "Required Skills" mentioned in the letter as the candidate's current or required skills.
         - Construct a summary based on the role offered.
      
      Return structured JSON with:
      1. Full Name
      2. A professional summary (max 50 words)
      3. Key skills (array of strings) - if an offer letter, list skills mentioned in the letter (e.g. ML, Deep Learning, Data Analysis).
      4. Total years of experience (number) - estimate or set to 0 if intern.
      5. Suggest 3 distinct job roles. If it's an offer letter, the FIRST role MUST be the one offered in the document.
         For each role, provide a match score (0-100), a brief reasoning, and a list of 5 required technical skills.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullName: { type: Type.STRING },
            summary: { type: Type.STRING },
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            yearsOfExperience: { type: Type.NUMBER },
            suggestedRoles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  matchScore: { type: Type.NUMBER },
                  reasoning: { type: Type.STRING },
                  requiredSkills: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(cleanJson(response.text || '{}')) as ParsedResume;
  } catch (error) {
    return handleOfflineError(error, MOCK_RESUME, "parseResumeDocument");
  }
};

export const generateLearningPath = async (role: string, currentSkills: string[]): Promise<LearningResource[]> => {
  if (!ai) {
    await new Promise(r => setTimeout(r, 1000));
    return MOCK_RESOURCES;
  }

  try {
    const prompt = `
      Create a study plan for a candidate targeting the role of "${role}".
      Their current skills are: ${currentSkills.join(', ')}.
      Provide a list of 5 high-quality learning resources (Courses, Articles, Documentation) to close skill gaps.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['Course', 'Article', 'Video', 'Documentation'] },
              url: { type: Type.STRING },
              description: { type: Type.STRING }
            }
          }
        }
      }
    });

    return JSON.parse(cleanJson(response.text || '[]')) as LearningResource[];
  } catch (error) {
    return handleOfflineError(error, MOCK_RESOURCES, "generateLearningPath");
  }
};

export const generateQuiz = async (role: string, difficulty: 'Easy' | 'Medium' | 'Hard', topic: string = 'Technical'): Promise<QuizQuestion[]> => {
  if (!ai) {
    await new Promise(r => setTimeout(r, 1000));
    return MOCK_QUIZ;
  }

  try {
    const prompt = `
      Generate a ${difficulty} ${topic} quiz for a "${role}" interview.
      Create 5 multiple-choice questions.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              category: { type: Type.STRING, enum: ['Technical', 'Aptitude', 'Behavioral'] }
            }
          }
        }
      }
    });

    return JSON.parse(cleanJson(response.text || '[]')) as QuizQuestion[];
  } catch (error) {
    return handleOfflineError(error, MOCK_QUIZ, "generateQuiz");
  }
};

export const generateAptitudePrep = async (): Promise<LearningResource[]> => {
  if (!ai) {
    await new Promise(r => setTimeout(r, 1000));
    return MOCK_RESOURCES;
  }

  try {
    const prompt = `
      Provide 5 general aptitude and logical reasoning preparation topics and resources for a job interview.
      Focus on quantitative aptitude, logical reasoning, and verbal ability.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['Article', 'Video', 'Documentation'] },
              url: { type: Type.STRING },
              description: { type: Type.STRING }
            }
          }
        }
      }
    });

    return JSON.parse(cleanJson(response.text || '[]')) as LearningResource[];
  } catch (error) {
    return handleOfflineError(error, MOCK_RESOURCES, "generateAptitudePrep");
  }
};

export const generateFullMockTest = async (role: string): Promise<QuizQuestion[]> => {
  if (!ai) {
    await new Promise(r => setTimeout(r, 1500));
    // Return a longer list for mock test by duplicating
    return [...MOCK_QUIZ, ...MOCK_QUIZ]; 
  }

  try {
    const prompt = `
      Create a comprehensive 10-question mock test for a "${role}" candidate.
      Include:
      - 5 Technical questions related to the role
      - 3 Aptitude/Logic questions
      - 2 Behavioral/Situational questions
      Return as a JSON array.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              category: { type: Type.STRING, enum: ['Technical', 'Aptitude', 'Behavioral'] }
            }
          }
        }
      }
    });

    return JSON.parse(cleanJson(response.text || '[]')) as QuizQuestion[];
  } catch (error) {
    return handleOfflineError(error, [...MOCK_QUIZ, ...MOCK_QUIZ], "generateFullMockTest");
  }
};

export const searchJobs = async (role: string, location: string = "Remote"): Promise<JobListing[]> => {
  if (!ai) {
    await new Promise(r => setTimeout(r, 1000));
    return MOCK_JOBS;
  }

  try {
    const prompt = `Find 5 recent job listings for "${role}" in "${location}". Return the results using the Google Search tool.`;

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const listings: JobListing[] = chunks
      .filter(c => c.web?.uri && c.web?.title)
      .map(c => ({
        title: c.web?.title || "Job Opening",
        company: "Source: Web",
        location: location,
        url: c.web?.uri || "#"
      }))
      .slice(0, 6);
    
    // Fallback if no chunks found (rare but possible if model just chats)
    if (listings.length === 0) {
        return [
            { title: `${role} - Search Results`, company: "Google Search", location, url: `https://www.google.com/search?q=${encodeURIComponent(role + ' jobs')}` }
        ];
    }

    return listings;
  } catch (error) {
    return handleOfflineError(error, MOCK_JOBS, "searchJobs");
  }
};