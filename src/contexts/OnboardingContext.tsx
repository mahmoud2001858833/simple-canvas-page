import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

// Page IDs for granular onboarding control
export type OnboardingPage = 'dashboard' | 'courses' | 'courseDetails' | 'lessonViewer';

// Map pages to their step IDs
export const pageStepIds: Record<OnboardingPage, string[]> = {
  dashboard: ['dashboard-overview', 'my-courses', 'weekly-schedule', 'custom-request'],
  courses: ['courses-search', 'courses-filters', 'courses-grid'],
  courseDetails: ['course-info', 'course-enroll', 'course-content', 'course-instructor'],
  lessonViewer: ['lesson-video', 'lesson-progress', 'lesson-list', 'lesson-complete'],
};

interface OnboardingStep {
  id: string;
  title: string;
  title_ar: string;
  description: string;
  description_ar: string;
  target: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingState {
  hasSeenWelcome: boolean;
  completedSteps: string[];
  currentStep: number;
  isOnboardingActive: boolean;
  disabledPages: OnboardingPage[];
}

interface OnboardingContextType {
  state: OnboardingState;
  steps: OnboardingStep[];
  currentStepData: OnboardingStep | null;
  showWelcomeModal: boolean;
  setShowWelcomeModal: (show: boolean) => void;
  startOnboarding: (pageSteps: OnboardingStep[]) => void;
  completeStep: (stepId: string) => void;
  skipOnboarding: () => void;
  skipAllOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  markWelcomeSeen: () => void;
  isStepCompleted: (stepId: string) => boolean;
  resetOnboarding: () => void;
  isPageDisabled: (page: OnboardingPage) => boolean;
  togglePageOnboarding: (page: OnboardingPage) => void;
  resetPageOnboarding: (page: OnboardingPage) => void;
}

const STORAGE_KEY = 'jasorkom_onboarding';

const defaultState: OnboardingState = {
  hasSeenWelcome: false,
  completedSteps: [],
  currentStep: 0,
  isOnboardingActive: false,
  disabledPages: [],
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>(defaultState);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Load state from localStorage
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setState(parsed);
          
          // Show welcome modal for first-time users
          if (!parsed.hasSeenWelcome) {
            setShowWelcomeModal(true);
          }
        } catch {
          // If parsing fails, show welcome for new users
          setShowWelcomeModal(true);
        }
      } else {
        // New user - show welcome
        setShowWelcomeModal(true);
      }
    }
  }, [user]);

  // Save state to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem(`${STORAGE_KEY}_${user.id}`, JSON.stringify(state));
    }
  }, [state, user]);

  const startOnboarding = (pageSteps: OnboardingStep[]) => {
    // Check if any of these steps belong to a disabled page
    const belongsToDisabledPage = pageSteps.some(step => {
      for (const [page, stepIds] of Object.entries(pageStepIds)) {
        if (stepIds.includes(step.id) && state.disabledPages.includes(page as OnboardingPage)) {
          return true;
        }
      }
      return false;
    });

    if (belongsToDisabledPage) return;

    // Filter out already completed steps
    const incompleteSteps = pageSteps.filter(
      step => !state.completedSteps.includes(step.id)
    );
    
    if (incompleteSteps.length > 0) {
      setSteps(incompleteSteps);
      setState(prev => ({ ...prev, isOnboardingActive: true, currentStep: 0 }));
    }
  };

  const completeStep = (stepId: string) => {
    setState(prev => ({
      ...prev,
      completedSteps: [...prev.completedSteps, stepId],
    }));
  };

  const skipOnboarding = () => {
    // Mark all current steps as completed
    const stepIds = steps.map(s => s.id);
    setState(prev => ({
      ...prev,
      completedSteps: [...prev.completedSteps, ...stepIds],
      isOnboardingActive: false,
      currentStep: 0,
    }));
    setSteps([]);
  };

  // All known onboarding step IDs
  const allKnownStepIds = [
    // Dashboard steps
    'dashboard-overview', 'my-courses', 'weekly-schedule', 'custom-request',
    // Courses page steps
    'courses-search', 'courses-filters', 'courses-grid',
    // Course details steps
    'course-info', 'course-enroll', 'course-content', 'course-instructor',
    // Lesson viewer steps
    'lesson-video', 'lesson-progress', 'lesson-list', 'lesson-complete',
  ];

  const skipAllOnboarding = () => {
    // Mark ALL onboarding steps as completed permanently
    setState(prev => ({
      ...prev,
      hasSeenWelcome: true,
      completedSteps: allKnownStepIds,
      isOnboardingActive: false,
      currentStep: 0,
    }));
    setSteps([]);
    setShowWelcomeModal(false);
  };

  const nextStep = () => {
    if (state.currentStep < steps.length - 1) {
      completeStep(steps[state.currentStep].id);
      setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
    } else {
      // Last step - complete and end onboarding
      completeStep(steps[state.currentStep].id);
      setState(prev => ({ ...prev, isOnboardingActive: false, currentStep: 0 }));
      setSteps([]);
    }
  };

  const prevStep = () => {
    if (state.currentStep > 0) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const markWelcomeSeen = () => {
    setState(prev => ({ ...prev, hasSeenWelcome: true }));
    setShowWelcomeModal(false);
  };

  const isStepCompleted = (stepId: string) => {
    return state.completedSteps.includes(stepId);
  };

  const resetOnboarding = () => {
    setState(defaultState);
    if (user) {
      localStorage.removeItem(`${STORAGE_KEY}_${user.id}`);
    }
  };

  const isPageDisabled = (page: OnboardingPage) => {
    return state.disabledPages.includes(page);
  };

  const togglePageOnboarding = (page: OnboardingPage) => {
    setState(prev => ({
      ...prev,
      disabledPages: prev.disabledPages.includes(page)
        ? prev.disabledPages.filter(p => p !== page)
        : [...prev.disabledPages, page],
    }));
  };

  const resetPageOnboarding = (page: OnboardingPage) => {
    const stepIds = pageStepIds[page];
    setState(prev => ({
      ...prev,
      completedSteps: prev.completedSteps.filter(id => !stepIds.includes(id)),
      disabledPages: prev.disabledPages.filter(p => p !== page),
    }));
  };

  const currentStepData = state.isOnboardingActive && steps.length > 0 
    ? steps[state.currentStep] 
    : null;

  return (
    <OnboardingContext.Provider
      value={{
        state,
        steps,
        currentStepData,
        showWelcomeModal,
        setShowWelcomeModal,
        startOnboarding,
        completeStep,
        skipOnboarding,
        skipAllOnboarding,
        nextStep,
        prevStep,
        markWelcomeSeen,
        isStepCompleted,
        resetOnboarding,
        isPageDisabled,
        togglePageOnboarding,
        resetPageOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    // Return safe defaults instead of throwing - prevents crashes during HMR or lazy loading
    return {
      state: { hasSeenWelcome: true, completedSteps: [], currentStep: 0, isOnboardingActive: false, disabledPages: [] as OnboardingPage[] },
      steps: [] as OnboardingStep[],
      currentStepData: undefined,
      nextStep: () => {},
      prevStep: () => {},
      skipOnboarding: () => {},
      markWelcomeSeen: () => {},
      startOnboarding: () => {},
      setSteps: () => {},
      disablePageOnboarding: () => {},
      enablePageOnboarding: () => {},
      isPageOnboardingEnabled: () => false,
    } as any;
  }
  return context;
};
