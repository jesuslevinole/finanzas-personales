import { useCallback, useEffect, useRef, useState } from 'react';

/** Tipos mínimos de la Web Speech API (no vienen en lib.dom estándar). */
interface SpeechRecognitionAlternative { transcript: string; confidence: number }
interface SpeechRecognitionResult { 0: SpeechRecognitionAlternative; isFinal: boolean; length: number }
interface SpeechRecognitionResultList { length: number; [index: number]: SpeechRecognitionResult }
interface SpeechRecognitionEventLike { results: SpeechRecognitionResultList; resultIndex: number }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const getRecognition = (): SpeechRecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Dictado por voz en español. `supported` es false en navegadores sin la API. */
export function useVoiceInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const ref = useRef<SpeechRecognitionLike | null>(null);
  const supported = getRecognition() !== null;

  useEffect(() => () => ref.current?.stop(), []);

  const toggle = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    if (listening) { ref.current?.stop(); setListening(false); return; }

    const recognition = new Ctor();
    recognition.lang = 'es-VE';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      if (text) onText(text);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    ref.current = recognition;
    setListening(true);
  }, [listening, onText]);

  return { listening, supported, toggle };
}
