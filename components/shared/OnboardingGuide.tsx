'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Calendar, Upload, CreditCard, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to ComplianceHub! 🎉',
    description:
      'Your one-stop platform for managing GST, PF, ESI, and Income Tax compliance. Let\'s take a quick tour of the key features.',
    icon: <FileCheck className="h-8 w-8 text-blue-900" />,
  },
  {
    title: 'Track Compliance Deadlines',
    description:
      'Your compliance timeline shows all upcoming statutory deadlines with color-coded urgency indicators. Never miss a filing date again.',
    icon: <Calendar className="h-8 w-8 text-blue-900" />,
  },
  {
    title: 'Secure Document Vault',
    description:
      'Upload, categorize, and securely store all your compliance documents. Auto-organized by type (GST, PF, ROC, Invoices) with full audit trails.',
    icon: <Upload className="h-8 w-8 text-blue-900" />,
  },
  {
    title: 'Upgrade for More Features',
    description:
      'Get WhatsApp alerts, more storage, and priority CA tools by upgrading to Pro or Enterprise plans. Start with the free plan and grow as you need.',
    icon: <CreditCard className="h-8 w-8 text-blue-900" />,
  },
];

const STORAGE_KEY = 'compliancehub_onboarding_complete';

interface OnboardingGuideProps {
  forceShow?: boolean;
}

export default function OnboardingGuide({ forceShow = false }: OnboardingGuideProps) {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      return;
    }
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Small delay to let the page render first
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!visible) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-1 bg-gradient-to-r from-blue-900 to-blue-600 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Close button */}
        <div className="flex justify-end p-3 pb-0">
          <button
            onClick={handleComplete}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 pb-6 text-center">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center mx-auto mb-4">
            {step.icon}
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h2>
          <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 pb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'w-8 bg-blue-900'
                  : i < currentStep
                  ? 'w-2 bg-blue-400'
                  : 'w-2 bg-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 pb-6">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="text-slate-600"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <Button
            onClick={handleNext}
            className="bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-800 hover:to-blue-600 text-white px-6"
          >
            {isLast ? 'Get Started' : 'Next'}
            {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>

        {/* Skip link */}
        <div className="text-center pb-4">
          <button
            onClick={handleComplete}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}
