export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Prefers high quality English voices (Natural, Google, Microsoft, Samantha, Daniel). */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.startsWith('en'));
  const byName = (...names: string[]) => english.find((v) => names.some((n) => v.name.includes(n)));
  return (
    byName('Natural', 'Online') ??
    byName('Google', 'Premium') ??
    byName('Samantha', 'Daniel', 'Jenny') ??
    english[0] ??
    voices[0] ??
    null
  );
}

// Chrome can garbage-collect an utterance mid-speech and never fire `onend`; keep a reference.
let activeUtterance: SpeechSynthesisUtterance | null = null;

/** Resolves when the sentence finishes, errors, or is cancelled. */
export function speak(text: string, voice: SpeechSynthesisVoice | null): Promise<void> {
  if (!speechSupported()) return Promise.resolve();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const done = () => {
      if (activeUtterance === utterance) activeUtterance = null;
      resolve();
    };
    utterance.onend = done;
    utterance.onerror = done;

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  });
}

export function cancelSpeech(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export function pauseSpeech(paused: boolean): void {
  if (!speechSupported()) return;
  if (paused) window.speechSynthesis.pause();
  else window.speechSynthesis.resume();
}

// Web Speech Recognition is not part of the TypeScript DOM lib yet
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const recognitionSupported = () => recognitionConstructor() !== undefined;

export function createRecognition(lang = 'en-US'): Recognition | null {
  const Ctor = recognitionConstructor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false;
  return recognition;
}

export const firstTranscript = (event: RecognitionResultEvent): string =>
  event.results[0]?.[0]?.transcript.toLowerCase().trim() ?? '';
