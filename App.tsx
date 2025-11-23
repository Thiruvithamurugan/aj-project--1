import React, { useState, createContext, useContext, ReactNode, useRef, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ParsedResume, SuggestedRole, AppStep, LearningResource, QuizQuestion, JobListing } from './types';
import { parseResumeDocument, generateLearningPath, generateQuiz, generateAptitudePrep, generateFullMockTest, searchJobs, updateApiKey } from './services/geminiService';
import { useLiveInterview } from './hooks/useLiveInterview';
import { Upload, FileText, CheckCircle, BookOpen, Briefcase, Mic, ChevronRight, Play, Search, Award, Brain, Target, Camera, Hexagon, Save, Trash2, Settings, X, Key } from 'lucide-react';

// --- Context ---
interface AppContextType {
  resume: ParsedResume | null;
  setResume: (r: ParsedResume) => void;
  targetRole: SuggestedRole | null;
  setTargetRole: (r: SuggestedRole) => void;
  completedSteps: AppStep[];
  completeStep: (step: AppStep) => void;
  saveProgress: () => void;
  resetProgress: () => void;
  toggleSettings: () => void;
}

const AppContext = createContext<AppContextType>({
  resume: null,
  setResume: () => {},
  targetRole: null,
  setTargetRole: () => {},
  completedSteps: [],
  completeStep: () => {},
  saveProgress: () => {},
  resetProgress: () => {},
  toggleSettings: () => {},
});

const useApp = () => useContext(AppContext);

// --- Components ---
const Button: React.FC<{ 
  children: ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  className?: string;
  disabled?: boolean;
}> = ({ children, onClick, variant = 'primary', className = '', disabled = false }) => {
  const base = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
  const variants = {
    primary: "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-purple-200",
    secondary: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200",
    outline: "border-2 border-purple-600 text-purple-600 hover:bg-purple-50",
    danger: "bg-red-500 hover:bg-red-600 text-white",
    success: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
  };
  
  return (
    <button onClick={onClick} className={`${base} ${variants[variant]} ${className}`} disabled={disabled}>
      {children}
    </button>
  );
};

const Card: React.FC<{ children: ReactNode; className?: string; title?: string }> = ({ children, className = '', title }) => (
  <div className={`bg-white border border-gray-100 rounded-xl p-6 shadow-lg shadow-gray-200/50 ${className}`}>
    {title && <h3 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">{title}</h3>}
    {children}
  </div>
);

// --- Settings Modal ---
const SettingsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [key, setKey] = useState('');
  
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('gemini_api_key');
      if (saved) setKey(saved);
    }
  }, [isOpen]);

  const handleSave = () => {
    updateApiKey(key);
    onClose();
    // Optional: reload to ensure all services pick up fresh state if needed, 
    // though geminiService handles dynamic updates.
    alert("API Key saved. Live features are now enabled.");
  };

  const handleClear = () => {
    updateApiKey('');
    setKey('');
    alert("API Key cleared. Reverting to Demo Mode.");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
           <h3 className="font-bold text-gray-800 flex items-center gap-2"><Settings className="w-5 h-5"/> App Settings</h3>
           <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-4">
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
             <div className="relative">
               <input 
                 type="password" 
                 value={key}
                 onChange={(e) => setKey(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                 placeholder="Enter your API Key"
               />
               <Key className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
             </div>
             <p className="text-xs text-gray-500 mt-2">
               Leave empty to use <strong>Demo Mode</strong> (Mock Data). <br/>
               Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-purple-600 hover:underline">aistudio.google.com</a>.
             </p>
           </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
           <Button variant="secondary" onClick={handleClear}>Clear Key</Button>
           <Button variant="primary" onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
};

// --- Sidebar Journey Map ---
const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { completedSteps, resume, targetRole, saveProgress, resetProgress, toggleSettings } = useApp();

  const menu = [
    { step: AppStep.UPLOAD, path: '/', label: '1. Upload Document', icon: Upload },
    { step: AppStep.ANALYSIS, path: '/analysis', label: '2. Analysis & Roles', icon: Target, disabled: !resume },
    { step: AppStep.TECHNICAL_PREP, path: '/technical-prep', label: '3. Skill Prep', icon: BookOpen, disabled: !targetRole },
    { step: AppStep.TECHNICAL_QUIZ, path: '/technical-quiz', label: '4. Tech Quiz', icon: FileText, disabled: !completedSteps.includes(AppStep.TECHNICAL_PREP) && !targetRole },
    { step: AppStep.APTITUDE_JOBS, path: '/aptitude', label: '5. Aptitude & Jobs', icon: Brain, disabled: !completedSteps.includes(AppStep.TECHNICAL_QUIZ) },
    { step: AppStep.FULL_MOCK, path: '/full-mock', label: '6. Full Mock Test', icon: CheckCircle, disabled: !completedSteps.includes(AppStep.APTITUDE_JOBS) },
    { step: AppStep.HR_INTERVIEW, path: '/interview', label: '7. AI Interview', icon: Mic, disabled: !completedSteps.includes(AppStep.FULL_MOCK) },
  ];

  return (
    <div className="w-20 lg:w-72 bg-gradient-to-b from-purple-700 via-purple-600 to-pink-600 flex-shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto shadow-2xl z-20">
      <div className="p-6 flex items-center gap-3 border-b border-white/10">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
          <Hexagon className="text-purple-600 w-6 h-6 fill-current" />
        </div>
        <div className="hidden lg:block">
          <span className="text-lg font-bold text-white block leading-none">SHENTINELIX</span>
          <span className="text-xs text-purple-200 tracking-wider font-medium">SPHERE PREP</span>
        </div>
      </div>
      
      <div className="p-4 flex-1">
        <p className="hidden lg:block text-xs font-bold text-purple-200 uppercase tracking-wider mb-3 px-2 opacity-80">Your Roadmap</p>
        <nav className="space-y-2">
          {menu.map((item) => {
            const isCompleted = completedSteps.includes(item.step);
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => !item.disabled && navigate(item.path)}
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 relative group ${
                  isActive
                    ? 'bg-white text-purple-700 shadow-lg font-semibold'
                    : item.disabled 
                      ? 'opacity-40 cursor-not-allowed text-white' 
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-purple-600' : ''} ${isCompleted && !isActive ? 'text-emerald-300' : ''}`} />
                <div className="hidden lg:block flex-1">
                  <span className="text-sm">{item.label}</span>
                </div>
                {isCompleted && <CheckCircle className={`w-4 h-4 hidden lg:block ${isActive ? 'text-emerald-500' : 'text-emerald-300'}`} />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Persistent Actions */}
      <div className="p-4 border-t border-white/10 space-y-2 bg-black/10">
        <button 
          onClick={toggleSettings}
          className="w-full flex items-center gap-3 p-2 rounded-lg text-purple-100 hover:bg-white/20 hover:text-white transition-all"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden lg:inline text-sm font-medium">Settings</span>
        </button>
        {resume && (
          <>
            <button 
              onClick={saveProgress}
              className="w-full flex items-center gap-3 p-2 rounded-lg text-purple-100 hover:bg-white/20 hover:text-white transition-all"
            >
              <Save className="w-4 h-4" />
              <span className="hidden lg:inline text-sm font-medium">Save Progress</span>
            </button>
             <button 
              onClick={() => {
                if(window.confirm("Are you sure you want to reset your progress? This cannot be undone.")) {
                  resetProgress();
                }
              }}
              className="w-full flex items-center gap-3 p-2 rounded-lg text-purple-200 hover:bg-red-500/20 hover:text-red-200 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden lg:inline text-sm font-medium">Reset All</span>
            </button>
          </>
        )}
      </div>
      
      {targetRole && (
        <div className="p-4 hidden lg:block bg-black/20 backdrop-blur-sm">
          <p className="text-xs text-purple-200 uppercase tracking-wider mb-1 font-semibold">Target Role</p>
          <p className="text-sm font-bold text-white truncate">{targetRole.title}</p>
        </div>
      )}
    </div>
  );
};

// --- Pages ---

const ResumeUploadPage = () => {
  const { setResume, completeStep, resume } = useApp();
  const navigate = useNavigate();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const data = await parseResumeDocument(base64String, file.type);
        setResume(data);
        completeStep(AppStep.UPLOAD);
        setIsAnalyzing(false);
        navigate('/analysis');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze document. Please try a valid PDF, PNG, or JPG file.");
      setIsAnalyzing(false);
    }
  };

  if (resume && !isAnalyzing) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 text-center pt-10 animate-fade-in">
         <h1 className="text-4xl font-extrabold text-gray-900">Welcome Back!</h1>
         <Card className="py-10">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center">
                 <FileText className="w-10 h-10 text-purple-600" />
              </div>
              <div>
                  <p className="text-xl font-bold text-gray-800">Resume Loaded for {resume.fullName}</p>
                  <p className="text-gray-500">{resume.suggestedRoles?.length || 0} roles identified</p>
                  <p className="text-xs text-gray-400 mt-1">Progress loaded from saved session</p>
              </div>
              <div className="flex gap-4 mt-4">
                 <Button onClick={() => navigate('/analysis')}>Continue Journey <ChevronRight className="w-4 h-4"/></Button>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 w-full max-w-md">
                  <p className="text-xs text-gray-400 mb-2">Want to start over?</p>
                  <label className="text-sm text-purple-600 hover:text-purple-800 cursor-pointer font-medium relative">
                     Upload New Document
                     <input 
                       type="file" 
                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                       accept="image/png, image/jpeg, application/pdf" 
                       onChange={handleFileUpload} 
                     />
                  </label>
              </div>
            </div>
         </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 text-center pt-10 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-gray-900">Upload Your Document</h1>
        <p className="text-gray-500 text-lg">Upload your Resume, CV, or an Offer Letter to personalize your preparation.</p>
      </div>

      <Card className="border-dashed border-2 border-purple-200 bg-purple-50/50 py-20 hover:border-purple-500 transition-all cursor-pointer relative group">
        <input 
          type="file" 
          accept="image/png, image/jpeg, application/pdf" 
          onChange={handleFileUpload} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="flex flex-col items-center gap-4 group-hover:scale-105 transition-transform duration-300">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md group-hover:shadow-xl transition-shadow">
            <Upload className="w-10 h-10 text-purple-600" />
          </div>
          <div className="space-y-1">
            <p className="text-xl font-bold text-gray-800">Drop your Resume or Offer Letter</p>
            <p className="text-sm text-gray-500">PDF, PNG, JPG supported</p>
          </div>
        </div>
      </Card>

      {isAnalyzing && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-purple-700 font-semibold">Analyzing document context...</p>
        </div>
      )}
      {error && <p className="text-red-500 font-medium bg-red-50 py-2 rounded">{error}</p>}
    </div>
  );
};

const AnalysisPage = () => {
  const { resume, setTargetRole, completeStep } = useApp();
  const navigate = useNavigate();

  if (!resume) return <div>No document loaded.</div>;

  const handleSelectRole = (role: SuggestedRole) => {
    setTargetRole(role);
    completeStep(AppStep.ANALYSIS);
    completeStep(AppStep.ROLE_SELECTION);
    navigate('/technical-prep');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Welcome, {resume.fullName || 'Candidate'}</h1>
          <p className="text-gray-600">{resume.summary}</p>
        </div>
        <div className="bg-white px-5 py-3 rounded-xl border border-gray-100 shadow-sm">
           <span className="text-gray-400 text-xs uppercase font-bold tracking-wider">Experience</span>
           <div className="text-2xl font-bold text-purple-600">{resume.yearsOfExperience} Years</div>
        </div>
      </div>

      <Card title="Key Skills Detected">
        <div className="flex flex-wrap gap-2">
          {resume.skills.map((skill, idx) => (
            <span key={idx} className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg text-sm font-medium">{skill}</span>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Recommended Career Paths</h2>
        <div className="grid gap-6">
          {resume.suggestedRoles.map((role, idx) => (
            <Card key={idx} className="hover:shadow-xl transition-all relative overflow-hidden group border-l-4 border-l-purple-500">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
                 <Briefcase className="w-32 h-32" />
              </div>
              <div className="flex flex-col md:flex-row justify-between items-start gap-6 relative z-10">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-700 transition-colors">{role.title}</h3>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-bold">{role.matchScore}% Match</span>
                  </div>
                  <p className="text-gray-600 mb-4 leading-relaxed">{role.reasoning}</p>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Requirements</p>
                    <div className="flex flex-wrap gap-2">
                      {role.requiredSkills?.map((s, i) => (
                        <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-200">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 min-w-[200px]">
                  <Button onClick={() => handleSelectRole(role)}>
                    Select Path <ChevronRight className="w-4 h-4" />
                  </Button>
                  <button 
                    onClick={() => {
                        setTargetRole(role);
                        completeStep(AppStep.ANALYSIS);
                        completeStep(AppStep.ROLE_SELECTION);
                        completeStep(AppStep.TECHNICAL_PREP);
                        completeStep(AppStep.TECHNICAL_QUIZ);
                        navigate('/aptitude');
                    }}
                    className="text-xs text-gray-400 hover:text-purple-600 underline mt-1 text-center transition-colors"
                  >
                    Skip learning, go to practice
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

const TechnicalPrepPage = () => {
  const { targetRole, resume, completeStep } = useApp();
  const navigate = useNavigate();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (targetRole && resume && resources.length === 0) {
      setLoading(true);
      generateLearningPath(targetRole.title, resume.skills)
        .then(setResources)
        .finally(() => setLoading(false));
    }
  }, [targetRole, resume]);

  if (!targetRole) return <div>Select a role first.</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 mb-1">Skill Gap Analysis</h1>
           <p className="text-gray-500 text-sm">Preparing for: <span className="font-semibold text-purple-600">{targetRole.title}</span></p>
        </div>
        <Button onClick={() => { completeStep(AppStep.TECHNICAL_PREP); navigate('/technical-quiz'); }} variant="success">
           Mark Complete <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card title="Focus Areas">
             <ul className="space-y-3">
               {targetRole.requiredSkills?.map((skill, i) => (
                 <li key={i} className="flex items-center gap-3 text-gray-700">
                   <div className="w-2 h-2 bg-purple-500 rounded-full shadow shadow-purple-200"></div> 
                   <span className="font-medium">{skill}</span>
                 </li>
               ))}
             </ul>
          </Card>
        </div>
        <div className="md:col-span-2">
           <Card title="Curated Learning Resources">
             {loading ? (
               <div className="flex items-center gap-2 text-gray-500 py-10 justify-center">
                 <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                 Generating personalized content...
               </div>
             ) : (
               <div className="space-y-4">
                 {resources.map((res, idx) => (
                   <div key={idx} className="p-5 bg-gray-50 rounded-xl border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide mb-2 inline-block ${res.type === 'Course' ? 'bg-indigo-100 text-indigo-700' : 'bg-pink-100 text-pink-700'}`}>{res.type}</span>
                          <h4 className="font-bold text-gray-900 group-hover:text-purple-700 transition-colors">{res.title}</h4>
                          <p className="text-sm text-gray-500 mt-2 leading-relaxed">{res.description}</p>
                        </div>
                        {res.url && <a href={res.url} target="_blank" rel="noreferrer" className="text-purple-600 hover:text-purple-800 text-sm font-bold whitespace-nowrap ml-4">Start Learning &rarr;</a>}
                      </div>
                   </div>
                 ))}
               </div>
             )}
           </Card>
        </div>
      </div>
    </div>
  );
};

const TechnicalQuizPage = () => {
  const { targetRole, completeStep } = useApp();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);

  const startQuiz = () => {
    setLoading(true);
    generateQuiz(targetRole!.title, 'Medium')
      .then(setQuiz)
      .finally(() => setLoading(false));
  };

  const handleAnswer = (idx: number) => {
    if (idx === quiz[currentQ].correctAnswer) setScore(s => s + 1);
    if (currentQ < quiz.length - 1) {
      setCurrentQ(c => c + 1);
    } else {
      setFinished(true);
      completeStep(AppStep.TECHNICAL_QUIZ);
    }
  };

  if (!targetRole) return <div>Select a role first.</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Technical Proficiency Test</h1>
        <p className="text-gray-500">Role: {targetRole.title}</p>
      </div>

      <Card className="min-h-[400px] flex flex-col justify-center">
        {!quiz.length ? (
           <div className="text-center">
             <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
               <Brain className="w-10 h-10 text-purple-600" />
             </div>
             <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to begin?</h3>
             <p className="text-gray-500 mb-8 max-w-md mx-auto">This quiz contains 5 technical questions tailored to your target role. No time limit.</p>
             <Button onClick={startQuiz} className="mx-auto px-8" disabled={loading}>
               {loading ? 'Generating Questions...' : 'Start Assessment'}
             </Button>
           </div>
        ) : finished ? (
           <div className="text-center">
             <h3 className="text-2xl font-bold text-gray-900 mb-2">Assessment Completed</h3>
             <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-4 py-2">{Math.round((score / quiz.length) * 100)}%</div>
             <p className="text-gray-500 mb-8">You answered {score} out of {quiz.length} questions correctly.</p>
             <div className="flex justify-center gap-4">
                <Button onClick={() => { setQuiz([]); setFinished(false); setScore(0); setCurrentQ(0); }} variant="secondary">Retry Quiz</Button>
                <Button onClick={() => navigate('/aptitude')} variant="primary">Next Step <ChevronRight className="w-4 h-4" /></Button>
             </div>
           </div>
        ) : (
           <div>
             <div className="flex justify-between text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
               <span>Question {currentQ + 1} / {quiz.length}</span>
               <span>Score: {score}</span>
             </div>
             <div className="w-full bg-gray-100 h-2 rounded-full mb-8 overflow-hidden">
               <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500 ease-out" style={{ width: `${((currentQ + 1) / quiz.length) * 100}%` }}></div>
             </div>
             <h3 className="text-xl font-bold text-gray-900 mb-8 leading-snug">{quiz[currentQ].question}</h3>
             <div className="space-y-3">
               {quiz[currentQ].options.map((opt, i) => (
                 <button key={i} onClick={() => handleAnswer(i)} className="w-full p-4 text-left rounded-xl bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-200 transition-all text-gray-700 font-medium">
                   {opt}
                 </button>
               ))}
             </div>
           </div>
        )}
      </Card>
    </div>
  );
};

const AptitudePage = () => {
  const { targetRole, completeStep } = useApp();
  const navigate = useNavigate();
  const [aptitudeRes, setAptitudeRes] = useState<LearningResource[]>([]);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (aptitudeRes.length === 0) {
      setLoading(true);
      Promise.all([
        generateAptitudePrep(),
        searchJobs(targetRole?.title || 'Software Engineer')
      ]).then(([res, jobs]) => {
        setAptitudeRes(res);
        setJobs(jobs);
      }).finally(() => setLoading(false));
    }
  }, [targetRole]);

  const handleFinish = () => {
      completeStep(AppStep.APTITUDE_JOBS);
      navigate('/full-mock');
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Aptitude & Market Opportunities</h1>
          <p className="text-gray-500 text-sm">Master logical reasoning and explore current openings.</p>
        </div>
        <Button onClick={handleFinish} variant="success">
           Mark Complete <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
             <div className="p-2 bg-pink-100 rounded-lg"><Brain className="w-5 h-5 text-pink-600"/></div>
             <h2 className="text-xl font-bold text-gray-800">Aptitude Prep</h2>
          </div>
          
          {loading ? <div className="text-gray-400 animate-pulse">Loading resources...</div> : (
            <div className="space-y-4">
               {aptitudeRes.map((res, i) => (
                 <a href={res.url} target="_blank" rel="noreferrer" key={i} className="block p-5 bg-white rounded-xl border border-gray-100 hover:border-pink-300 hover:shadow-lg transition-all group shadow-sm">
                    <h4 className="font-bold text-gray-800 group-hover:text-pink-600 mb-1">{res.title}</h4>
                    <p className="text-sm text-gray-500">{res.description}</p>
                 </a>
               ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
             <div className="p-2 bg-purple-100 rounded-lg"><Briefcase className="w-5 h-5 text-purple-600"/></div>
             <h2 className="text-xl font-bold text-gray-800">Live Job Openings</h2>
          </div>

          {loading ? <div className="text-gray-400 animate-pulse">Searching jobs...</div> : (
            <div className="space-y-4">
               {jobs.map((job, i) => (
                 <a href={job.url} target="_blank" rel="noreferrer" key={i} className="block p-5 bg-white rounded-xl border border-gray-100 hover:border-purple-300 hover:shadow-lg transition-all group shadow-sm">
                    <h4 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors">{job.title}</h4>
                    <div className="flex justify-between mt-3 text-sm text-gray-500 font-medium">
                       <span className="bg-gray-100 px-2 py-1 rounded">{job.company}</span>
                       <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div> {job.location}</span>
                    </div>
                 </a>
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FullMockPage = () => {
  const { targetRole, completeStep } = useApp();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (questions.length === 0 && targetRole) {
      setLoading(true);
      generateFullMockTest(targetRole.title)
        .then(setQuestions)
        .finally(() => setLoading(false));
    }
  }, [targetRole]);

  const handleAnswer = () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
    } else {
      setFinished(true);
      completeStep(AppStep.FULL_MOCK);
    }
  };

  if (!targetRole) return <div>Select Role</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Comprehensive Mock Test</h1>
        <p className="text-gray-500">Technical • Aptitude • Behavioral</p>
      </div>

      <Card className="min-h-[400px] flex flex-col justify-center">
         {loading ? (
           <div className="py-12 text-center text-gray-400">Generating comprehensive test suite...</div>
         ) : finished ? (
           <div className="text-center py-8">
             <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
               <CheckCircle className="w-12 h-12 text-emerald-600" />
             </div>
             <h3 className="text-2xl font-bold text-gray-900 mb-4">You are Ready!</h3>
             <p className="text-gray-500 mb-8 max-w-md mx-auto">You have completed the preparation roadmap. It's time for the final interview.</p>
             <Button onClick={() => navigate('/interview')} className="mx-auto px-8 py-3" variant="success">
               Start AI Video Interview <ChevronRight className="w-5 h-5" />
             </Button>
           </div>
         ) : questions.length > 0 ? (
           <div>
              <div className="flex justify-between items-center mb-8">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Question {current + 1}/{questions.length}</span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-bold uppercase">{questions[current].category}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-8 leading-snug">{questions[current].question}</h3>
              <div className="space-y-3">
                 {questions[current].options.map((opt, i) => (
                   <button key={i} onClick={handleAnswer} className="w-full text-left p-4 rounded-xl bg-gray-50 hover:bg-white border border-gray-200 hover:border-purple-400 hover:shadow-md transition-all text-gray-700 font-medium">
                     {opt}
                   </button>
                 ))}
              </div>
           </div>
         ) : null}
      </Card>
    </div>
  );
};

const InterviewPage = () => {
  const { targetRole } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { connect, disconnect, isConnected, isSpeaking, error, logs } = useLiveInterview(targetRole?.title || 'General', videoRef);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI HR Video Interview</h1>
        <p className="text-gray-500">Real-time simulation for {targetRole?.title}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 relative bg-black rounded-2xl overflow-hidden aspect-video border-4 border-gray-900 shadow-2xl">
           {/* User Camera Feed */}
           <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay muted playsInline />
           
           <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-full flex items-center gap-2 backdrop-blur-md border border-white/10">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-xs text-white font-medium tracking-wide">{isConnected ? 'LIVE CONNECTION' : 'OFFLINE'}</span>
           </div>

           {/* AI Avatar Overlay / Status */}
           <div className="absolute bottom-6 left-6 right-6 bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all ${isSpeaking ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)] bg-emerald-500/20' : 'border-white/30 bg-white/10'}`}>
                 <Mic className={`w-6 h-6 ${isSpeaking ? 'text-emerald-400' : 'text-white/70'}`} />
              </div>
              <div className="flex-1">
                 <p className="text-sm font-bold text-white">AI Interviewer</p>
                 <p className="text-xs text-white/60 font-medium">{isSpeaking ? 'Speaking...' : isConnected ? 'Listening...' : 'Ready to connect'}</p>
              </div>
              {!isConnected ? (
                <Button onClick={connect} variant="success" className="text-sm py-2 px-6 rounded-full shadow-lg shadow-emerald-500/20">Start Interview</Button>
              ) : (
                <Button onClick={disconnect} variant="danger" className="text-sm py-2 px-6 rounded-full shadow-lg shadow-red-500/20">End Call</Button>
              )}
           </div>
        </div>

        <div className="md:col-span-1 space-y-4 h-[500px] md:h-auto">
          <Card className="h-full flex flex-col bg-white border-gray-200">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Transcript Log</h3>
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 text-xs font-medium max-h-[400px] pr-2 custom-scrollbar">
              {error && <p className="text-red-500 bg-red-50 p-2 rounded">{error}</p>}
              {logs.length === 0 && <p className="text-gray-400 italic text-center mt-10">Conversation will appear here...</p>}
              {logs.map((log, i) => (
                <div key={i} className="flex flex-col gap-1 animate-fade-in">
                   <span className="text-gray-400 text-[10px] uppercase">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                   <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-gray-700">
                     {log}
                   </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- Layout & Root ---

const AppLayout = () => {
  const { toggleSettings } = useApp();
  const [showSettings, setShowSettings] = useState(false);

  // We wrap the context toggler to our local state
  // Actually, we need to pass this state down via context or lift it up.
  // Let's implement it in the main App component and pass via Context.
  
  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden font-sans selection:bg-purple-200">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative scroll-smooth">
        <Routes>
          <Route path="/" element={<ResumeUploadPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/technical-prep" element={<TechnicalPrepPage />} />
          <Route path="/technical-quiz" element={<TechnicalQuizPage />} />
          <Route path="/aptitude" element={<AptitudePage />} />
          <Route path="/full-mock" element={<FullMockPage />} />
          <Route path="/interview" element={<InterviewPage />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => {
  const [resume, setResume] = useState<ParsedResume | null>(() => {
    try {
      const saved = localStorage.getItem('prepAiState');
      return saved ? JSON.parse(saved).resume : null;
    } catch(e) { return null; }
  });
  
  const [targetRole, setTargetRole] = useState<SuggestedRole | null>(() => {
    try {
      const saved = localStorage.getItem('prepAiState');
      return saved ? JSON.parse(saved).targetRole : null;
    } catch(e) { return null; }
  });

  const [completedSteps, setCompletedSteps] = useState<AppStep[]>(() => {
    try {
      const saved = localStorage.getItem('prepAiState');
      return saved ? JSON.parse(saved).completedSteps : [];
    } catch(e) { return []; }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const completeStep = useCallback((step: AppStep) => {
    setCompletedSteps(prev => Array.from(new Set([...prev, step])));
  }, []);

  const saveProgress = useCallback(() => {
    try {
        const state = { resume, targetRole, completedSteps };
        localStorage.setItem('prepAiState', JSON.stringify(state));
        alert("Progress saved successfully! You can resume later.");
    } catch (e) {
        alert("Failed to save progress. Storage might be full.");
    }
  }, [resume, targetRole, completedSteps]);

  const resetProgress = useCallback(() => {
    localStorage.removeItem('prepAiState');
    setResume(null);
    setTargetRole(null);
    setCompletedSteps([]);
    window.location.hash = '/';
  }, []);

  const toggleSettings = useCallback(() => setIsSettingsOpen(prev => !prev), []);

  return (
    <AppContext.Provider value={{ resume, setResume, targetRole, setTargetRole, completedSteps, completeStep, saveProgress, resetProgress, toggleSettings }}>
      <HashRouter>
        <AppLayout />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </HashRouter>
    </AppContext.Provider>
  );
};

export default App;