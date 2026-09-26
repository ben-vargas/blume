---
"blume": patch
---

Add written feedback. `feedback: { comments: true }` offers a box after the "Was this page helpful?" rating where the reader can say what worked or what's missing. A comment is sent as a `feedback_comment` event, with the rating, path, title, and the comment (up to 1,000 characters), through every analytics adapter with an event API and as a `blume:track` event. With `consent` set, the box only opens for readers who allowed analytics. The box's label and button are UI strings, translated in every built-in language. `feedback: true` and `false` work as before, and the `Feedback` layout slot now receives a `comments` prop.
