import type { ReactElement } from 'react';
import type { TranslationDictionary } from '../../i18n/translations.js';
import type { ChatMessage } from '../../types/index.js';
import { SafeMarkdown } from '../SafeMarkdown.js';

interface ChatMessageListProps {
  t: TranslationDictionary;
  messages: ChatMessage[];
  isStreaming: boolean;
  onContinue: (msgId: string) => void;
}

/**
 * Accessible scrollable ARIA live chat log rendering user questions, markdown answers,
 * error cards, and continuation controls when a reply hits the token limit.
 */
export function ChatMessageList({
  t,
  messages,
  isStreaming,
  onContinue,
}: Readonly<ChatMessageListProps>): ReactElement {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label={t.chatHistoryLabel}
      tabIndex={0}
      className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 min-h-[160px] max-h-[420px] overflow-y-auto focus-visible:outline-2 focus-visible:outline-teal-700 dark:focus-visible:outline-teal-400"
    >
      {messages.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">{t.chatEmptyHint}</p>
      ) : (
        messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg p-3.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'ml-auto max-w-2xl bg-teal-800 text-white dark:bg-teal-700'
                : msg.isError
                  ? 'mr-auto max-w-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-100'
                  : 'mr-auto max-w-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 space-y-2.5'
            }`}
          >
            {msg.role === 'user' ? (
              <p>{msg.content}</p>
            ) : msg.content ? (
              <>
                <SafeMarkdown text={msg.content} />
                {msg.isTruncated && !msg.isError && !isStreaming && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {t.chatTruncatedNotice}
                    </span>
                    <button
                      type="button"
                      onClick={() => onContinue(msg.id)}
                      aria-label={t.chatShowMoreLabel}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-teal-700 dark:border-teal-500 px-3.5 py-2 text-xs font-semibold text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/60 transition-colors"
                    >
                      {t.chatContinueBtn}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-600 dark:text-slate-400">{t.chatSendingBtn}</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
