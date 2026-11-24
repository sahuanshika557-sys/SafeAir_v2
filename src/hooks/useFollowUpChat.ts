import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
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
    setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
    setInput: (value: string) => void;
    setIsStreaming: Dispatch<SetStateAction<boolean>>;
  },
): Promise<void> {
  const validation = validateChatMessage(input, state.language);
  if (!validation.valid) {
    deps.setInputError(validation.error ?? state.t.chatEmptyError);
    deps.inputRef.current?.focus();
    return;
  }
  deps.setInputError(null);
  const userMsg: ChatMessage = {
    id: deps.nextId('u'),
    role: 'user',
    content: validation.sanitized,
    timestamp: new Date().toISOString(),
  };
  const assistantId = deps.nextId('a');
  const nextHistory = [...state.messages, userMsg];
  deps.setMessages([
    ...nextHistory,
    { id: assistantId, role: 'assistant', content: '', timestamp: new Date().toISOString() },
  ]);
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

async function dispatchChatContinue(
  targetMsgId: string,
  state: {
    t: TranslationDictionary;
    language: Language;
    messages: ChatMessage[];
    isStreaming: boolean;
  },
  deps: {
    buildContext: () => ReturnType<typeof buildChatRequestContext>;
    startRequestAbort: () => AbortController;
    setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
    setIsStreaming: Dispatch<SetStateAction<boolean>>;
    nextId: (prefix: string) => string;
  },
): Promise<void> {
  const targetIdx = state.messages.findIndex((m) => m.id === targetMsgId);
  const targetMessage = targetIdx >= 0 ? state.messages[targetIdx] : null;
  if (!targetMessage || state.isStreaming) {
    return;
  }
  deps.setIsStreaming(true);
  await executeContinueTruncatedReply(
    targetMsgId,
    targetMessage.content,
    state.messages.slice(0, targetIdx + 1),
    {
      t: state.t,
      language: state.language,
      context: deps.buildContext(),
      signal: deps.startRequestAbort().signal,
      setMessages: deps.setMessages,
      setIsStreaming: deps.setIsStreaming,
      nextErrorId: () => deps.nextId('a-err'),
    },
  );
}

function useChatIdAndAbort(): {
  nextId: (prefix: string) => string;
  startRequestAbort: () => AbortController;
} {
  const abortRef = useRef<AbortController | null>(null);
  const msgSeqRef = useRef<number>(1);
  useEffect(() => () => abortRef.current?.abort(), []);
  const nextId = useCallback(
    (p: string): string => `${p}-${Date.now()}-${msgSeqRef.current++}`,
    [],
  );
  const startRequestAbort = useCallback((): AbortController => {
    abortRef.current?.abort();
    const c = new AbortController();
    abortRef.current = c;
    return c;
  }, []);
  return { nextId, startRequestAbort };
}

function useChatState() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setters = useMemo(
    () => ({ setMessages, setInput, setInputError, setIsStreaming, inputRef }),
    [],
  );
  return { messages, input, inputError, isStreaming, setters };
}

/**
 * Manages scoped follow-up Q&A message state, streaming updates, abort cleanup, and continuation.
 */
export function useFollowUpChat(params: UseFollowUpChatParams): UseFollowUpChatResult {
  const { t, language, location, reading, plan } = params;
  const { messages, input, inputError, isStreaming, setters } = useChatState();
  const { nextId, startRequestAbort } = useChatIdAndAbort();
  const buildContext = useCallback(
    () =>
      buildChatRequestContext({ language, location, reading, plan, fallbackLabel: t.notAvailable }),
    [language, location, plan, reading, t.notAvailable],
  );
  const handleSubmit = useCallback(
    (e: SyntheticEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      return prepareAndSubmitQuestion(
        input,
        { t, language, messages },
        { ...setters, nextId, buildContext, startRequestAbort },
      );
    },
    [buildContext, input, language, messages, nextId, setters, startRequestAbort, t],
  );
  const handleContinueMessage = useCallback(
    (id: string): Promise<void> =>
      dispatchChatContinue(
        id,
        { t, language, messages, isStreaming },
        { ...setters, buildContext, startRequestAbort, nextId },
      ),
    [buildContext, isStreaming, language, messages, nextId, setters, startRequestAbort, t],
  );
  return {
    messages,
    input,
    setInput: setters.setInput,
    inputError,
    isStreaming,
    inputRef: setters.inputRef,
    handleSubmit,
    handleContinueMessage,
  };
}
