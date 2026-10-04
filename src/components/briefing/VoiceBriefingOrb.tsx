import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Layers, Mic, Play, Radio, Sparkles, X } from 'lucide-react';
import { useLatestRef } from '../../hooks/useLatestRef';
import type { DashboardSnapshot } from '../../lib/dax/types';
import type { FocusTarget } from '../../store/filters';
import {
  FULL_BRIEFING,
  SECTION_BRIEFINGS,
  parseVoiceCommand,
  type BriefingSection,
  type BriefingStep,
} from './briefingScript';
import {
  cancelSpeech,
  createRecognition,
  firstTranscript,
  pauseSpeech,
  pickVoice,
  recognitionSupported,
  speak,
  speechSupported,
  type Recognition,
} from './speech';

interface VoiceBriefingOrbProps {
  /** Applies the filters and resolves once the DAX for them has returned. */
  onFocus: (target: FocusTarget) => Promise<DashboardSnapshot>;
  onResetAll: () => void;
}

type Phase = { status: 'idle' } | { status: 'loading' | 'speaking'; title: string };

const CHAPTER_PAUSE_MS = 600;
const CAPTION_LINGER_MS = 2500;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const VoiceBriefingOrb: React.FC<VoiceBriefingOrbProps> = ({ onFocus, onResetAll }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ status: 'idle' });
  const [caption, setCaption] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [ccEnabled, setCcEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');

  // Every run gets an id; bumping it invalidates whichever run is in flight
  const runIdRef = useRef(0);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  // Always-fresh callbacks for the async loop and speech events
  const onFocusRef = useLatestRef(onFocus);
  const onResetAllRef = useLatestRef(onResetAll);

  const isPlaying = phase.status !== 'idle';

  const stop = () => {
    runIdRef.current += 1;
    cancelSpeech();
    setPhase({ status: 'idle' });
    setIsPaused(false);
    setCaption('');
  };

  const run = async (steps: BriefingStep[]) => {
    const runId = ++runIdRef.current;
    const isCurrent = () => runIdRef.current === runId;

    cancelSpeech();
    setIsMenuOpen(false);
    setIsPaused(false);

    const history: Record<string, DashboardSnapshot> = {};

    for (const [index, step] of steps.entries()) {
      let text: string;

      if (step.target) {
        const target = step.target(history);
        if (target === null) continue;

        setPhase({ status: 'loading', title: step.title });
        let snapshot: DashboardSnapshot | null = null;
        try {
          snapshot = await onFocusRef.current(target);
        } catch {
          // Narrated below as a skipped chapter
        }
        if (!isCurrent()) return;

        if (snapshot) {
          text = step.narrate(snapshot, history);
          history[step.id] = snapshot;
        } else {
          text = `I couldn't load the data for ${step.title}, so let's move on.`;
        }
      } else {
        text = step.narrate();
      }

      setPhase({ status: 'speaking', title: step.title });
      setCaption(text);
      await speak(text, voiceRef.current);
      if (!isCurrent()) return;

      if (index < steps.length - 1) {
        await delay(CHAPTER_PAUSE_MS);
        if (!isCurrent()) return;
      }
    }

    setPhase({ status: 'idle' });
  };

  const startFull = () => void run(FULL_BRIEFING);
  const startSection = (section: BriefingSection) => void run(SECTION_BRIEFINGS[section]);

  const handleVoiceCommand = (transcript: string) => {
    const command = parseVoiceCommand(transcript);
    if (!command) return;
    if (command.type === 'full') startFull();
    else if (command.type === 'section') startSection(command.section);
    else {
      stop();
      onResetAllRef.current();
    }
  };
  const handleVoiceCommandRef = useLatestRef(handleVoiceCommand);

  // Pick the most natural English voice (voices load asynchronously in Chrome)
  useEffect(() => {
    if (!speechSupported()) return;
    const synth = window.speechSynthesis;
    const update = () => {
      voiceRef.current = pickVoice(synth.getVoices());
    };
    update();
    synth.addEventListener('voiceschanged', update);
    return () => synth.removeEventListener('voiceschanged', update);
  }, []);

  // Web Speech Recognition, wired once; handlers read the latest callbacks through refs
  useEffect(() => {
    const recognition = createRecognition();
    if (!recognition) return;

    recognition.onresult = (event) => {
      const transcript = firstTranscript(event);
      setRecognizedText(transcript);
      setIsListening(false);
      handleVoiceCommandRef.current(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [handleVoiceCommandRef]);

  // Stop narrating if the orb unmounts (e.g. the user leaves the visuals view)
  useEffect(() => {
    const runs = runIdRef;
    return () => {
      runs.current += 1;
      cancelSpeech();
    };
  }, []);

  // Let the last caption linger briefly after the briefing ends
  useEffect(() => {
    if (isPlaying || !caption) return;
    const timer = setTimeout(() => setCaption(''), CAPTION_LINGER_MS);
    return () => clearTimeout(timer);
  }, [isPlaying, caption]);

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }
    try {
      setRecognizedText('');
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error('Speech recognition error:', err);
    }
  };

  const togglePause = () => {
    if (phase.status !== 'speaking') return;
    pauseSpeech(!isPaused);
    setIsPaused(!isPaused);
  };

  const isSpeaking = phase.status === 'speaking' && !isPaused;
  const hasRecognition = recognitionSupported();

  return (
    <>
      {/* 1. Cinema Captions (Bottom Center Pill in Sync with Speech) */}
      {caption && ccEnabled && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-2xl px-5 py-3 rounded-xl bg-slate-950/85 text-slate-100 text-sm font-medium border border-teal-500/30 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-300 text-center tracking-wide">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
            <span className="text-[10px] uppercase font-bold text-teal-400 tracking-widest">
              Executive Briefing Audio
            </span>
          </div>
          <p className="leading-relaxed text-slate-200">{caption}</p>
        </div>
      )}

      {/* 2. Floating Briefing Orb (Bottom Right) */}
      <div className="fixed right-6 bottom-6 z-40 flex items-center gap-3">
        {isPlaying && (
          <button
            type="button"
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

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 text-slate-200 border border-slate-700/80 text-xs shadow-xl backdrop-blur-md">
          {phase.status === 'idle' ? (
            <span className="flex items-center gap-1 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              AI Voice Briefing
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-teal-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              {phase.title}
              {phase.status === 'loading' && <span className="font-normal text-slate-400">· querying model</span>}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => (isPlaying ? togglePause() : setIsMenuOpen(true))}
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
                  isSpeaking ? 'bg-gradient-to-t from-teal-400 to-emerald-300 animate-pulse' : 'bg-slate-400'
                }`}
                style={{
                  height: isSpeaking ? `${8 + ((i * 5) % 12)}px` : '4px',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>

          {isSpeaking && (
            <span className="absolute inset-0 rounded-full border border-teal-400 animate-ping opacity-30 pointer-events-none" />
          )}
        </button>

        {isPlaying && (
          <button
            type="button"
            onClick={stop}
            className="w-8 h-8 rounded-full bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-600/50 flex items-center justify-center text-xs shadow-md transition-colors cursor-pointer"
            title="Stop Briefing"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3. Briefing Selection Modal (Menu) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200 p-4">
          <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  Assisted Report • Audio Briefing
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">Executive Voice Briefing</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Listen to an AI-narrated walkthrough with automatic cross-filtering synchronized to the speech.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
                aria-label="Close briefing menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={startFull}
              className="w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Start Full Guided Briefing</span>
            </button>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Or Jump Directly to a Section:
              </span>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => startSection('lines')}
                  className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-teal-400" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        Utility Lines Concentration
                      </div>
                      <div className="text-[11px] text-slate-400">Inventory and renewals across Utility Lines</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors" />
                </button>

                <button
                  type="button"
                  onClick={() => startSection('water')}
                  className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        Water Pipes Exposure
                      </div>
                      <div className="text-[11px] text-slate-400">Renewals and inspection coverage for Water Pipes</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={!hasRecognition}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-600/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700'
                  }`}
                  title={isListening ? 'Stop listening' : 'Speak a command'}
                >
                  <Mic className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-200">
                    {!hasRecognition
                      ? 'Voice control is not supported in this browser'
                      : isListening
                        ? 'Listening... say "full tour", "lines", "water", "renewals" or "reset"'
                        : recognizedText
                          ? `Heard: "${recognizedText}"`
                          : 'Voice Control available'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    Speech recognition runs in your browser via the Web Speech API
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
