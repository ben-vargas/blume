/**
 * The "Was this page helpful?" rating (`PageFeedback.astro`). A rating is
 * sent as a `feedback` analytics event, the buttons give way to a thank-you,
 * and, with `feedback.comments` on, a box below asks the reader to say more.
 * A comment they send goes out as a `feedback_comment` event with the same
 * rating, path, and title, so the two line up in a dashboard.
 *
 * Runs on the initial load and again after every client-router swap, which
 * rebuilds the widget from server-rendered markup, so the handlers always
 * bind to the freshly swapped-in elements.
 */
import { track } from "./analytics-client.ts";

/** The longest comment the box takes. */
export const COMMENT_MAX_LENGTH = 1000;

/** Wire the page's rating, when it has one. */
export const initFeedback = (): void => {
  const root = document.querySelector("[data-blume-page-feedback]");
  if (!root) {
    return;
  }
  const actions = root.querySelector("[data-feedback-actions]");
  const thanks = root.querySelector<HTMLElement>("[data-feedback-thanks]");
  const form = root.querySelector<HTMLFormElement>("[data-feedback-form]");
  let helpful = "";
  const rate = (value: string) => {
    helpful = value;
    track("feedback", {
      helpful,
      path: location.pathname,
      title: document.title,
    });
    actions?.classList.add("hidden");
    thanks?.classList.remove("hidden");
    if (form) {
      form.hidden = false;
    }
    // The clicked button just disappeared under focus; hand focus to the
    // (live) thanks line so the reader isn't dropped at the top of the page.
    // The comment box is the next stop from there.
    thanks?.focus();
  };
  for (const button of root.querySelectorAll<HTMLElement>(
    "[data-feedback-value]"
  )) {
    button.addEventListener("click", () =>
      rate(button.dataset.feedbackValue ?? "")
    );
  }
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const comment = form.querySelector("textarea")?.value.trim() ?? "";
    if (comment) {
      track("feedback_comment", {
        comment: comment.slice(0, COMMENT_MAX_LENGTH),
        helpful,
        path: location.pathname,
        title: document.title,
      });
    }
    form.hidden = true;
    thanks?.focus();
  });
};
