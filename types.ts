export interface ParsedResume {
  fullName: string;
  summary: string;
  skills: string[];
  yearsOfExperience: number;
  suggestedRoles: SuggestedRole[];
}

export interface SuggestedRole {
  title: string;
  matchScore: number;
  reasoning: string;
  requiredSkills?: string[];
}

export interface LearningResource {
  title: string;
  type: 'Course' | 'Article' | 'Video' | 'Documentation';
  url: string;
  description: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // Index
  explanation: string;
  category?: 'Technical' | 'Aptitude' | 'Behavioral';
}

export interface JobListing {
  title: string;
  company: string;
  location: string;
  url: string;
}

export enum AppStep {
  UPLOAD = 'Upload',
  ANALYSIS = 'Analysis',
  ROLE_SELECTION = 'Role Selection',
  TECHNICAL_PREP = 'Technical Prep',
  TECHNICAL_QUIZ = 'Technical Quiz',
  APTITUDE_JOBS = 'Aptitude & Jobs',
  FULL_MOCK = 'Full Mock Test',
  HR_INTERVIEW = 'HR Interview'
}

// For Live API
export type AudioWorkletNode = any;