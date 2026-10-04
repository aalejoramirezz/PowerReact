import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, Layers, Mic, Play, Radio, Sparkles, X } from 'lucide-react';
import { useLatestRef } from '../../hooks/useLatestRef';
import { cx } from '../ui/cx';
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
  const orbButtonRef = useRef<HTMLButtonElement>(null);
  const dialogStartRef = useRef<HTMLButtonElement>(null);
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

  // Dialog: focus the primary action, close on Esc, give focus back to the orb afterwards
  useEffect(() => {
    if (!isMenuOpen) return;
    const orb = orbButtonRef.current;
    dialogStartRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      orb?.focus();
    };
  }, [isMenuOpen]);

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

  const layers = (
    <>
      {/* 1. Cinema captions, in sync with the speech */}
      {caption && ccEnabled && (
        <div
          className="u-anim-fade fixed bottom-20 left-1/2 z-50 max-w-2xl -translate-x-1/2 rounded-xl border border-u-panel-border bg-u-panel-bg px-5 py-3 text-center text-sm font-medium text-u-title backdrop-blur-xl"
          style={{ boxShadow: 'var(--u-modal-shadow)' }}
          role="status"
          aria-live="polite"
        >
          <div className="mb-1 flex items-center justify-center gap-2">
            <span className="u-status-dot" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-u-interaction">Executive Briefing Audio</span>
          </div>
          <p className="leading-relaxed text-u-text">{caption}</p>
        </div>
      )}

      {/* 2. Floating briefing orb (bottom right) */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        {isPlaying && (
          <button
            type="button"
            onClick={() => setCcEnabled(!ccEnabled)}
            className={cx(
              'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-[10px] font-bold backdrop-blur-md transition-colors',
              ccEnabled
                ? 'border-u-interaction bg-u-panel-bg text-u-interaction'
                : 'border-u-panel-border bg-u-panel-bg text-u-label'
            )}
            title={ccEnabled ? 'Captions Enabled' : 'Captions Disabled'}
            aria-pressed={ccEnabled}
          >
            CC
          </button>
        )}

        <div
          className="hidden items-center gap-1.5 rounded-full border border-u-panel-border bg-u-panel-bg px-3 py-1.5 text-xs text-u-text-soft backdrop-blur-md sm:flex"
          style={{ boxShadow: 'var(--u-panel-shadow)' }}
        >
          {phase.status === 'idle' ? (
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-u-interaction" />
              AI Voice Briefing
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold text-u-interaction">
              <span className="u-status-dot" aria-hidden="true" />
              {phase.title}
              {phase.status === 'loading' && <span className="font-normal text-u-label">· querying model</span>}
            </span>
          )}
        </div>

        <button
          ref={orbButtonRef}
          type="button"
          onClick={() => (isPlaying ? togglePause() : setIsMenuOpen(true))}
          className={cx(
            'relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border bg-u-panel-bg backdrop-blur-md transition-[transform,border-color] duration-300',
            isPlaying ? 'scale-105 border-2 border-u-interaction' : 'border-u-panel-border hover:scale-105 hover:border-u-interaction'
          )}
          style={{
            boxShadow: isPlaying
              ? '0 0 0 6px color-mix(in srgb, var(--u-primary) 16%, transparent), var(--u-panel-shadow)'
              : 'var(--u-panel-shadow)',
          }}
          title={isPlaying ? (isPaused ? 'Resume Briefing' : 'Pause Briefing') : 'Start Guided Briefing'}
        >
          {/* 5-bar equalizer: moves only while speaking (state, not decoration) */}
          <div className="flex h-5 items-center gap-1" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cx('w-1 rounded-full transition-[height,background-color] duration-150', isSpeaking ? 'animate-pulse bg-u-primary' : 'bg-u-label')}
                style={{
                  height: isSpeaking ? `${8 + ((i * 5) % 12)}px` : '4px',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </button>

        {isPlaying && (
          <button
            type="button"
            onClick={stop}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-u-bad/40 bg-u-bad-bg text-u-bad-text transition-colors"
            title="Stop Briefing"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 3. Briefing selection dialog */}
      {isMenuOpen && (
        <div
          className="u-anim-fade fixed inset-0 z-50 flex items-center justify-center bg-u-overlay p-4 backdrop-blur-md"
          data-testid="briefing-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMenuOpen(false);
          }}
        >
          <div
            className="u-anim-pop w-full max-w-md space-y-5 rounded-2xl border border-u-panel-border bg-u-panel-solid p-6 text-u-text"
            style={{ boxShadow: 'var(--u-modal-shadow)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="briefing-dialog-title"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.18em] text-u-interaction">
                  <Radio className="h-3.5 w-3.5" />
                  Assisted Report • Audio Briefing
                </span>
                <h3 id="briefing-dialog-title" className="font-display text-lg font-semibold tracking-tight text-u-title">
                  Executive Voice Briefing
                </h3>
                <p className="mt-1 text-xs text-u-label">
                  Listen to an AI-narrated walkthrough with automatic cross-filtering synchronized to the speech.
                </p>
              </div>
              <button type="button" onClick={() => setIsMenuOpen(false)} className="u-icon-btn" aria-label="Close briefing menu">
                <X className="h-4 w-4" />
              </button>
            </div>

            <button ref={dialogStartRef} type="button" onClick={startFull} className="u-btn h-11 w-full justify-center text-sm">
              <Play className="h-4 w-4 fill-current" />
              <span>Start Full Guided Briefing</span>
            </button>

            <div className="space-y-2">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-u-label">
                Or Jump Directly to a Section:
              </span>

              <div className="grid grid-cols-1 gap-2">
                <SectionButton
                  icon={<Layers className="h-4 w-4 text-u-interaction" />}
                  title="Utility Lines Concentration"
                  description="Inventory and renewals across Utility Lines"
                  onClick={() => startSection('lines')}
                />
                <SectionButton
                  icon={<AlertTriangle className="h-4 w-4 text-u-warn-text" />}
                  title="Water Pipes Exposure"
                  description="Renewals and inspection coverage for Water Pipes"
                  onClick={() => startSection('water')}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-u-ghost-border bg-u-ghost-bg p-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={!hasRecognition}
                  className={cx(
                    'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    isListening ? 'border-u-bad bg-u-bad text-white' : 'border-u-ghost-border bg-u-panel-solid text-u-interaction'
                  )}
                  title={isListening ? 'Stop listening' : 'Speak a command'}
                  aria-pressed={isListening}
                >
                  <Mic className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-u-title">
                    {!hasRecognition
                      ? 'Voice control is not supported in this browser'
                      : isListening
                        ? 'Listening... say "full tour", "lines", "water", "renewals" or "reset"'
                        : recognizedText
                          ? `Heard: "${recognizedText}"`
                          : 'Voice Control available'}
                  </div>
                  <div className="text-[10px] leading-snug text-u-label">Speech recognition runs in your browser via the Web Speech API</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // The report plane uses backdrop-filter, which makes it the containing block (and a stacking
  // context) for fixed descendants: the overlay would be clipped to the plane and sit under its
  // header. Rendering at body level keeps captions, orb and dialog viewport-wide and on top.
  return typeof document === 'undefined' ? layers : createPortal(layers, document.body);
};

const SectionButton: React.FC<{ icon: React.ReactNode; title: string; description: string; onClick: () => void }> = ({
  icon,
  title,
  description,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex cursor-pointer items-center justify-between rounded-lg border border-u-ghost-border bg-u-ghost-bg p-3 text-left transition-colors hover:bg-u-ghost-hover"
  >
    <div className="flex items-center gap-2.5">
      {icon}
      <div>
        <div className="text-xs font-semibold text-u-title">{title}</div>
        <div className="text-[11px] text-u-label">{description}</div>
      </div>
    </div>
    <ArrowRight className="h-3.5 w-3.5 text-u-label transition-colors group-hover:text-u-interaction" />
  </button>
);

export default VoiceBriefingOrb;
