import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Play,
  Sparkles,
  X,
  Radio,
  Layers,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

interface VoiceBriefingOrbProps {
  kpis: {
    totalAssets: number;
    totalAssessed: number;
    dueForRenewal: number;
    avgBaseLife: number;
    pctAssessed: number;
  };
  selectedGroup: string | null;
  selectedClass: string | null;
  onSelectGroup: (group: string | null) => void;
  onSelectClass: (className: string | null) => void;
  onSetKpiFilter: (filter: 'all' | 'renewal' | 'assessed') => void;
  onResetAll: () => void;
}

interface TourStep {
  id: string;
  title: string;
  text: string;
  action: () => void;
}

export const VoiceBriefingOrb: React.FC<VoiceBriefingOrbProps> = ({
  kpis,
  onSelectGroup,
  onSelectClass,
  onSetKpiFilter,
  onResetAll,
}) => {
  const [isOpenMenu, setIsOpenMenu] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentCaption, setCurrentCaption] = useState<string>('');
  const [ccEnabled, setCcEnabled] = useState<boolean>(true);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(-1);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const recognitionRef = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Initialize Speech Synthesis and find the most natural English voice
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      // Prefer high quality English voices (Natural, Google, Microsoft, Samantha, Daniel)
      const bestVoice =
        voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Online'))) ||
        voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Premium'))) ||
        voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Jenny'))) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];

      if (bestVoice) {
        setSelectedVoice(bestVoice);
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Initialize Web Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        setRecognizedText(transcript);
        handleVoiceCommand(transcript);
        setIsListening(false);
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Handle Voice Commands spoken by the user
  const handleVoiceCommand = (cmd: string) => {
    if (cmd.includes('full') || cmd.includes('briefing') || cmd.includes('tour') || cmd.includes('start')) {
      startFullTour();
    } else if (cmd.includes('utility line') || cmd.includes('line')) {
      startSectionTour('lines');
    } else if (cmd.includes('water') || cmd.includes('pipes')) {
      startSectionTour('water');
    } else if (cmd.includes('renewal') || cmd.includes('urgent')) {
      startSectionTour('renewal');
    } else if (cmd.includes('reset') || cmd.includes('stop') || cmd.includes('all')) {
      stopTour();
      onResetAll();
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        setRecognizedText('');
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Speech recognition error:', err);
      }
    }
  };

  // Define the guided tour sequence with auto cross-filtering
  const tourSteps: TourStep[] = [
    {
      id: 'overview',
      title: 'Executive Overview',
      text: `Good morning. Welcome to your executive briefing for AssetFinda. You currently manage ${kpis.totalAssets.toLocaleString()} total assets across the portfolio, with an average base life of ${kpis.avgBaseLife} years.`,
      action: () => {
        onResetAll();
      },
    },
    {
      id: 'condition',
      title: 'Condition Assessment',
      text: `Regarding operational condition: ${kpis.totalAssessed.toLocaleString()} assets—representing ${(kpis.pctAssessed * 100).toFixed(1)} percent of your active portfolio—have completed condition assessments.`,
      action: () => {
        onSetKpiFilter('assessed');
      },
    },
    {
      id: 'renewal-risk',
      title: 'Renewal Risk Concentration',
      text: `However, attention is required: ${kpis.dueForRenewal.toLocaleString()} assets are due for renewal. Notice that 637 of these urgent renewals are concentrated in Utility Lines. Let me isolate this group for you now.`,
      action: () => {
        onSelectGroup('Utility_Line');
        onSetKpiFilter('renewal');
      },
    },
    {
      id: 'water-pipes',
      title: 'Water Pipes Exposure',
      text: 'Within Utility Lines, Water Pipes represent your primary capital exposure, accounting for all 637 urgent renewals. Inspection coverage here is robust at 93 percent.',
      action: () => {
        onSelectGroup('Utility_Line');
        onSelectClass('Water_Pipes');
      },
    },
    {
      id: 'conclusion',
      title: 'Conclusion',
      text: 'This concludes your guided briefing. You can now explore the cross-filtered model freely, or ask to focus on any other asset category.',
      action: () => {
        // Keep focus on the filtered state for user review
      },
    },
  ];

  // Helper to speak a sentence using SpeechSynthesis
  const speakSentence = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setCurrentCaption(text);
      };

      utterance.onend = () => {
        resolve();
      };

      utterance.onerror = () => {
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  // Run the full guided briefing loop
  const startFullTour = async () => {
    isCancelledRef.current = false;
    setIsOpenMenu(false);
    setIsPlaying(true);
    setIsPaused(false);

    for (let i = 0; i < tourSteps.length; i++) {
      if (isCancelledRef.current) break;

      setCurrentStepIdx(i);
      const step = tourSteps[i];

      // 1. Trigger synchronized cross-filter in UI
      step.action();

      // 2. Narrate in sync
      await speakSentence(step.text);

      // Brief cinematic pause between chapters
      if (i < tourSteps.length - 1 && !isCancelledRef.current) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    if (!isCancelledRef.current) {
      setIsPlaying(false);
      setCurrentStepIdx(-1);
      setTimeout(() => setCurrentCaption(''), 2500);
    }
  };

  // Run deep-dive for a single section
  const startSectionTour = async (section: 'lines' | 'water' | 'renewal') => {
    isCancelledRef.current = false;
    setIsOpenMenu(false);
    setIsPlaying(true);
    setIsPaused(false);

    if (section === 'lines') {
      onSelectGroup('Utility_Line');
      await speakSentence(
        'Filtering to Utility Lines: you have 5,451 assets across Water Pipes, Sanitary Pipes, and Stormwater. 637 assets are flagged for urgent renewal.'
      );
    } else if (section === 'water') {
      onSelectGroup('Utility_Line');
      onSelectClass('Water_Pipes');
      await speakSentence(
        'Focusing on Water Pipes: 1,979 total assets. 93 percent have condition assessments, and 637 are scheduled for renewal.'
      );
    } else if (section === 'renewal') {
      onSetKpiFilter('renewal');
      await speakSentence(
        'Displaying all asset classes with urgent renewal requirements across your operational network.'
      );
    }

    setIsPlaying(false);
    setTimeout(() => setCurrentCaption(''), 2000);
  };

  const stopTour = () => {
    isCancelledRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentCaption('');
    setCurrentStepIdx(-1);
  };

  const togglePause = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  return (
    <>
      {/* 1. Cinema Captions (Bottom Center Pill in Sync with Speech) */}
      {currentCaption && ccEnabled && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-2xl px-5 py-3 rounded-xl bg-slate-950/85 text-slate-100 text-sm font-medium border border-teal-500/30 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-300 text-center tracking-wide">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
            <span className="text-[10px] uppercase font-bold text-teal-400 tracking-widest">
              Executive Briefing Audio
            </span>
          </div>
          <p className="leading-relaxed text-slate-200">{currentCaption}</p>
        </div>
      )}

      {/* 2. Floating Briefing Orb (Bottom Right) */}
      <div className="fixed right-6 bottom-6 z-40 flex items-center gap-3">
        {/* Caption Toggle (CC) */}
        {isPlaying && (
          <button
            onClick={() => setCcEnabled(!ccEnabled)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border backdrop-blur-md transition-all cursor-pointer ${
              ccEnabled
                ? 'bg-slate-900 text-teal-400 border-teal-500/40 shadow-xs'
                : 'bg-slate-900/60 text-slate-400 border-slate-700'
            }`}
            title={ccEnabled ? 'Captions Enabled' : 'Captions Disabled'}
          >
            CC
          </button>
        )}

        {/* Hover Label Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 text-slate-200 border border-slate-700/80 text-xs shadow-xl backdrop-blur-md">
          {isPlaying ? (
            <span className="flex items-center gap-1.5 text-teal-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              {tourSteps[currentStepIdx]?.title || 'Briefing Active'}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              AI Voice Briefing
            </span>
          )}
        </div>

        {/* Interactive Orb */}
        <button
          onClick={() => {
            if (isPlaying) {
              togglePause();
            } else {
              setIsOpenMenu(true);
            }
          }}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer ${
            isPlaying
              ? 'bg-radial from-teal-500/20 to-slate-950 border-2 border-teal-400 shadow-teal-500/30 scale-105'
              : 'bg-radial from-slate-800 to-slate-950 border border-slate-700 hover:border-teal-400 hover:scale-105'
          }`}
          title={isPlaying ? (isPaused ? 'Resume Briefing' : 'Pause Briefing') : 'Start Guided Briefing'}
        >
          {/* Animated 5-Bar Equalizer representing speech frequency */}
          <div className="flex items-center gap-1 h-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all ${
                  isPlaying && !isPaused
                    ? 'bg-gradient-to-t from-teal-400 to-emerald-300 animate-pulse'
                    : 'bg-slate-400'
                }`}
                style={{
                  height: isPlaying && !isPaused ? `${8 + ((i * 5) % 12)}px` : '4px',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>

          {/* Glowing pulse ring while speaking */}
          {isPlaying && !isPaused && (
            <span className="absolute inset-0 rounded-full border border-teal-400 animate-ping opacity-30 pointer-events-none" />
          )}
        </button>

        {/* Stop Button when active */}
        {isPlaying && (
          <button
            onClick={stopTour}
            className="w-8 h-8 rounded-full bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-600/50 flex items-center justify-center text-xs shadow-md transition-colors cursor-pointer"
            title="Stop Briefing"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3. Briefing Selection Modal (Menu) */}
      {isOpenMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  Assisted Report • Audio Briefing
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Executive Voice Briefing
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Listen to an AI-narrated walkthrough with automatic cross-filtering synchronized to the speech.
                </p>
              </div>
              <button
                onClick={() => setIsOpenMenu(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Primary Action: Full Guided Tour */}
            <button
              onClick={startFullTour}
              className="w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Start Full Guided Briefing</span>
            </button>

            {/* Deep-Dive Section Options */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Or Jump Directly to a Section:
              </label>

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => startSectionTour('lines')}
                  className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-teal-400" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        Utility Lines Concentration
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Isolates Water, Sanitary, and Stormwater pipes
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors" />
                </button>

                <button
                  onClick={() => startSectionTour('water')}
                  className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        Water Pipes Exposure
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Deep dive into the 637 urgent renewals
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </button>
              </div>
            </div>

            {/* Voice Command Microphone Section */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={toggleListening}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-600/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700'
                  }`}
                  title={isListening ? 'Stop listening' : 'Speak a command'}
                >
                  {isListening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-200">
                    {isListening
                      ? 'Listening... say "full tour", "lines", "water", or "reset"'
                      : recognizedText
                      ? `Heard: "${recognizedText}"`
                      : 'Voice Control available'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    Speech recognition runs 100% locally in your browser ($0 cost)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceBriefingOrb;
