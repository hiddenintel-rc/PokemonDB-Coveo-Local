"use client";

import type { GeneratedAnswer, GeneratedAnswerState } from "@coveo/headless";

/**
 * Coveo RGA (Relevance Generative Answering) panel.
 * Renders only when the model produces (or is producing) an answer.
 * Silent fallback when RGA isn't configured — stays null.
 */
export function GeneratedAnswerPanel({
  controller,
  state,
}: {
  controller: GeneratedAnswer;
  state: GeneratedAnswerState;
}) {
  const hasAnswer = Boolean(state.answer && state.answer.trim().length > 0);
  const isThinking = state.isLoading || state.isStreaming;
  const hasError = Boolean(state.error?.message);

  if (!hasAnswer && !isThinking && !hasError) return null;
  if (state.cannotAnswer && !hasAnswer) return null;

  return (
    <section
      aria-label="AI generated answer"
      data-region="generated-answer"
      className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm"
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
            <path d="M12 2l1.8 4.6L18 8l-4.2 1.4L12 14l-1.8-4.6L6 8l4.2-1.4L12 2zM5 14l1 2.6L8 17l-2 .4L5 20l-1-2.6L2 17l2-.4L5 14zm14 0l1 2.6L22 17l-2 .4L19 20l-1-2.6L16 17l2-.4L19 14z" />
          </svg>
          AI-generated answer
          {isThinking && (
            <span className="ml-1 inline-flex items-center gap-1 text-xs font-normal text-emerald-600/80">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              {state.isStreaming ? "answering…" : "thinking…"}
            </span>
          )}
        </div>
      </header>

      {hasAnswer && (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
          {state.answer}
        </div>
      )}

      {hasError && !hasAnswer && (
        <div className="text-sm text-text-secondary">
          Generated answer unavailable.
          {state.error?.isRetryable && (
            <button
              type="button"
              onClick={() => controller.retry()}
              className="ml-2 underline hover:text-emerald-700"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {state.citations.length > 0 && (
        <ol className="mt-4 flex flex-wrap gap-2">
          {state.citations.map((c, idx) => {
            const href = c.clickUri ?? c.uri;
            return (
              <li key={c.id}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    state.answerId
                      ? controller.logCitationClick(c.id, state.answerId)
                      : controller.logCitationClick(c.id)
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs text-emerald-800 shadow-sm hover:bg-emerald-50"
                >
                  <span className="font-semibold">[{idx + 1}]</span>
                  <span className="max-w-[20ch] truncate">{c.title}</span>
                </a>
              </li>
            );
          })}
        </ol>
      )}

      {hasAnswer && !isThinking && (
        <footer className="mt-4 flex items-center gap-2 text-xs text-text-muted">
          <span>Was this helpful?</span>
          <button
            type="button"
            onClick={() => controller.like()}
            disabled={state.feedbackSubmitted}
            aria-pressed={state.liked}
            className={`rounded-md px-2 py-1 transition-colors ${
              state.liked
                ? "bg-emerald-100 text-emerald-800"
                : "hover:bg-surface-overlay"
            }`}
          >
            👍
          </button>
          <button
            type="button"
            onClick={() => controller.dislike()}
            disabled={state.feedbackSubmitted}
            aria-pressed={state.disliked}
            className={`rounded-md px-2 py-1 transition-colors ${
              state.disliked
                ? "bg-rose-100 text-rose-800"
                : "hover:bg-surface-overlay"
            }`}
          >
            👎
          </button>
          {state.feedbackSubmitted && (
            <span className="ml-1 text-emerald-700">Thanks!</span>
          )}
        </footer>
      )}
    </section>
  );
}
