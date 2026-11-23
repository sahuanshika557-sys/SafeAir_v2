import type { ReactElement } from 'react';
import { MAX_FREE_TEXT_LENGTH } from '../constants/index.js';
import { useFollowUpChat } from '../hooks/useFollowUpChat.js';
import type { TranslationDictionary } from '../i18n/translations.js';
import type { ActionPlan, AirQualityReading, Language, LocationData } from '../types/index.js';
import { ChatMessageList } from './chat/ChatMessageList.js';

interface FollowUpChatProps {
  t: TranslationDictionary;
  language: Language;
  location: LocationData;
  reading: AirQualityReading | null;
  plan: ActionPlan | null;
}

/**
 * Safe follow-up chat assistant scoped strictly to air quality, health protection, and sustainability.
 * Uses the custom HTML-free SafeMarkdown renderer and shows a localized Continue control when truncated.
 */
export function FollowUpChat({
  t,
  language,
  location,
  reading,
  plan,
}: Readonly<FollowUpChatProps>): ReactElement {
  const {
    messages,
    input,
    setInput,
    inputError,
    isStreaming,
    inputRef,
    handleSubmit,
    handleContinueMessage,
  } = useFollowUpChat({ t, language, location, reading, plan });

  return (
    <section
      id="ask-saathi"
      aria-labelledby="chat-section-heading"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-5"
    >
      <div>
        <h2
          id="chat-section-heading"
          className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100"
        >
          {t.chatTitle}
        </h2>
        <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-300">
          {t.chatSubtitle}
        </p>
      </div>

      <ChatMessageList
        t={t}
        messages={messages}
        isStreaming={isStreaming}
        onContinue={(msgId) => {
          void handleContinueMessage(msgId);
        }}
      />

      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="chat-question-input"
            className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            {t.chatInputLabel}
          </label>
          <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
            {input.length}/{MAX_FREE_TEXT_LENGTH}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            ref={inputRef}
            id="chat-question-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.chatPlaceholder}
            autoComplete="off"
            aria-invalid={Boolean(inputError)}
            aria-describedby={inputError ? 'chat-input-error' : undefined}
            className="min-h-[44px] flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-600 dark:placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={isStreaming}
            aria-busy={isStreaming}
            className="inline-flex min-h-[44px] min-w-[96px] items-center justify-center rounded-lg bg-teal-800 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {isStreaming ? t.chatSendingBtn : t.chatSendBtn}
          </button>
        </div>

        {inputError && (
          <p
            id="chat-input-error"
            role="alert"
            className="text-sm font-medium text-red-700 dark:text-red-300"
          >
            {inputError}
          </p>
        )}
      </form>
    </section>
  );
}

export default FollowUpChat;
