import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import type { TranslationDictionary } from '../i18n/translations.js';
import type {
  ActionPlan,
  AirQualityReading,
  ChatMessage,
  Language,
  LocationData,
} from '../types/index.js';
import { validateChatMessage } from '../utils/validation.js';
import {
  buildChatRequestContext,
  executeContinueTruncatedReply,
  executeSubmittedQuestion,
} from './followUpChatHelpers.js';

interface UseFollowUpChatParams {
  t: TranslationDictionary;
  language: Language;
  location: LocationData;
  reading: AirQualityReading | null;
  plan: ActionPlan | null;
}

interface UseFollowUpChatResult {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  inputError: string | null;
  isStreaming: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  handleSubmit: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  handleContinueMessage: (targetMsgId: string) => Promise<void>;
}

async function prepareAndSubmitQuestion(
  input: string,
  state: { t: TranslationDictionary; language: Language; messages: ChatMessage[] },
  deps: {
    inputRef: RefObject<HTMLInputElement | null>;
    nextId: (prefix: string) => string;
    buildContext: () => ReturnType<typeof buildChatRequestContext>;
    startRequestAbort: () => AbortController;
    setInputError: (err: string | null) => void;
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    setInput: (value: string) => void;
    setIsStreaming: (val: boolean) => void;
  },
): Promise<void> {
  const validation = validateChatMessage(input, state.language);
  if (!validation.valid) {
    deps.setInputError(validation.error ?? state.t.chatEmptyError);
    deps.inputRef.current?.focus();
    return;
  }
  deps.setInputError(null);
  const userMsg: ChatMessage = { id: deps.nextId('u'), role: 'user', content: validation.sanitized, timestamp: new Date().toISOString() };
  const assistantId = deps.nextId('a');
  const nextHistory = [...state.messages, userMsg];
  deps.setMessages([...nextHistory, { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString() }]);
  deps.setInput('');
  deps.setIsStreaming(true);
  await executeSubmittedQuestion(validation.sanitized, assistantId, nextHistory, {
    t: state.t,
    language: state.language,
    context: deps.buildContext(),
    signal: deps.startRequestAbort().signal,
    setMessages: deps.setMessages,
    setIsStreaming: deps.setIsStreaming,
    nextErrorId: () => deps.nextId('a-err'),
  });
}

/**
 * Manages scoped follow-up Q&A message state, streaming updates, abort cleanup, and continuation.
 */
export function useFollowUpChat(params: UseFollowUpChatParams): UseFollowUpChatResult {
  const { t, language, location, reading, plan } = params;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const msgSeqRef = useRef<number>(1);

  useEffect(() => () => abortRef.current?.abort(), []);
  const nextId = useCallback((prefix: string): string => `${prefix}-${Date.now()}-${msgSeqRef.current++}`, []);
  const buildContext = useCallback(
    () => buildChatRequestContext({ language, location, reading, plan, fallbackLabel: t.notAvailable }),
    [language, location, plan, reading, t.notAvailable],
  );
  const startRequestAbort = useCallback((): AbortController => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  }, []);

  const handleSubmit = useCallback(
    (e: SyntheticEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      return prepareAndSubmitQuestion(
        input,
        { t, language, messages },
        { inputRef, nextId, buildContext, startRequestAbort, setInputError, setMessages, setInput, setIsStreaming },
      );
    },
    [buildContext, input, language, messages, nextId, startRequestAbort, t],
  );

  const handleContinueMessage = useCallback(
    async (targetMsgId: string): Promise<void> => {
      const targetIdx = messages.findIndex((m) => m.id === targetMsgId);
      const targetMessage = targetIdx >= 0 ? messages[targetIdx] : null;
      if (!targetMessage || isStreaming) {
        return;
      }
      setIsStreaming(true);
      await executeContinueTruncatedReply(targetMsgId, targetMessage.content, messages.slice(0, targetIdx + 1), {
        t, language, context: buildContext(), signal: startRequestAbort().signal, setMessages, setIsStreaming, nextErrorId: () => nextId('a-err'),
      });
    },
    [buildContext, isStreaming, language, messages, nextId, startRequestAbort, t],
  );

  return { messages, input, setInput, inputError, isStreaming, inputRef, handleSubmit, handleContinueMessage };
}
