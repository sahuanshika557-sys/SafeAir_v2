import type { Dispatch, SetStateAction } from 'react';
import { SEVERE_AQI_THRESHOLD } from '../constants/index.js';
import type { TranslationDictionary } from '../i18n/translations.js';
import { streamFollowUpChat } from '../services/gemini.js';
import type {
  ActionPlan,
  AirQualityReading,
  ChatMessage,
  Language,
  LocationData,
} from '../types/index.js';
import { isAbortError } from '../utils/network.js';

/** Builds compact active location/AQI context sent alongside follow-up chat requests. */
export function buildChatRequestContext(params: {
  language: Language;
  location: LocationData;
  reading: AirQualityReading | null;
  plan: ActionPlan | null;
  fallbackLabel: string;
}): {
  locationName: string;
  usAqi: number;
  categoryLabel: string;
  planSummary?: string;
} {
  const { language, location, reading, plan, fallbackLabel } = params;
  const categoryLabel = reading
    ? language === 'hi'
      ? reading.category.labelHi
      : reading.category.labelEn
    : fallbackLabel;
  return {
    locationName: [location.name, location.country].filter(Boolean).join(', '),
    usAqi: reading?.usAqi ?? SEVERE_AQI_THRESHOLD,
    categoryLabel,
    planSummary: plan?.summary,
  };
}

function updateChatMessageById(
  messages: readonly ChatMessage[],
  targetId: string,
  updater: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  return messages.map((msg) => (msg.id === targetId ? updater(msg) : msg));
}

function appendContinuedReply(
  baseContent: string,
  continuation: string,
  joinPrefix: string,
): string {
  return continuation ? `${baseContent}${joinPrefix}${continuation}` : baseContent;
}

function createAssistantErrorEntry(id: string, message: string): ChatMessage {
  return {
    id,
    role: 'assistant',
    content: message,
    timestamp: new Date().toISOString(),
    isError: true,
  };
}

function resolveChatErrorMessage(err: unknown, t: TranslationDictionary): string {
  return err instanceof Error ? err.message : t.chatUnavailableError;
}

interface ChatExecutionDeps {
  t: TranslationDictionary;
  language: Language;
  context: ReturnType<typeof buildChatRequestContext>;
  signal: AbortSignal;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  nextErrorId: () => string;
}

function finalizeQuestionSuccess(
  finalText: string,
  completedTruncated: boolean,
  assistantId: string,
  deps: Pick<ChatExecutionDeps, 'setMessages' | 't'>,
): void {
  if (!finalText.trim()) {
    deps.setMessages((prev) =>
      updateChatMessageById(prev, assistantId, (m) => ({
        ...m,
        content: deps.t.chatIncompleteError,
        isError: true,
        isTruncated: false,
      })),
    );
  } else if (completedTruncated) {
    deps.setMessages((prev) =>
      updateChatMessageById(prev, assistantId, (m) => ({ ...m, isTruncated: true })),
    );
  }
}

/** Streams a newly submitted user question and updates the placeholder assistant bubble. */
export async function executeSubmittedQuestion(
  sanitizedQuestion: string,
  assistantId: string,
  nextHistory: readonly ChatMessage[],
  deps: ChatExecutionDeps,
): Promise<void> {
  let completedTruncated = false;
  try {
    const finalText = await streamFollowUpChat({
      message: sanitizedQuestion,
      history: nextHistory,
      context: deps.context,
      language: deps.language,
      signal: deps.signal,
      onToken: (acc) =>
        deps.setMessages((prev) =>
          updateChatMessageById(prev, assistantId, (m) => ({ ...m, content: acc })),
        ),
      onComplete: ({ truncated }) => {
        completedTruncated = truncated;
      },
    });
    finalizeQuestionSuccess(finalText, completedTruncated, assistantId, deps);
  } catch (err: unknown) {
    if (!isAbortError(err)) {
      const message = resolveChatErrorMessage(err, deps.t);
      deps.setMessages((prev) =>
        updateChatMessageById(prev, assistantId, (m) => ({
          ...m,
          content: message,
          isError: true,
          isTruncated: false,
        })),
      );
    }
  } finally {
    deps.setIsStreaming(false);
  }
}

function handleContinueChatError(
  err: unknown,
  targetMsgId: string,
  deps: Pick<ChatExecutionDeps, 'setMessages' | 'nextErrorId' | 't'>,
): void {
  if (isAbortError(err)) {
    return;
  }
  const errEntry = createAssistantErrorEntry(
    deps.nextErrorId(),
    resolveChatErrorMessage(err, deps.t),
  );
  deps.setMessages((prev) =>
    updateChatMessageById(prev, targetMsgId, (m) => ({ ...m, isTruncated: false })).concat(
      errEntry,
    ),
  );
}

/** Streams continuation text onto a previously truncated assistant message. */
export async function executeContinueTruncatedReply(
  targetMsgId: string,
  baseContent: string,
  historyUpToMessage: readonly ChatMessage[],
  deps: ChatExecutionDeps,
): Promise<void> {
  let continuationTruncated = false;
  const joinPrefix = baseContent && !baseContent.endsWith('\n') ? '\n\n' : '';
  try {
    const continuationText = await streamFollowUpChat({
      message: deps.t.chatContinuePrompt,
      history: historyUpToMessage,
      context: deps.context,
      language: deps.language,
      signal: deps.signal,
      onToken: (acc) =>
        deps.setMessages((prev) =>
          updateChatMessageById(prev, targetMsgId, (m) => ({
            ...m,
            content: appendContinuedReply(baseContent, acc, joinPrefix),
          })),
        ),
      onComplete: ({ truncated }) => {
        continuationTruncated = truncated;
      },
    });
    deps.setMessages((prev) =>
      updateChatMessageById(prev, targetMsgId, (m) => ({
        ...m,
        content: appendContinuedReply(baseContent, continuationText.trim(), joinPrefix),
        isTruncated: continuationTruncated,
      })),
    );
  } catch (err: unknown) {
    handleContinueChatError(err, targetMsgId, deps);
  } finally {
    deps.setIsStreaming(false);
  }
}
