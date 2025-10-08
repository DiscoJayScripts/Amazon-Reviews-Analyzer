# Suggested Follow-up Tasks

## Typo Correction
- **Location:** `Amazon-Reviews-Analyzer.user.js`, configuration comment for `OUTPUT_ALL`.
- **Issue:** The inline comment begins with `//Beta;` without the expected space after the slashes, which reads like a typo compared with the surrounding comments.
- **Suggested Fix:** Insert the missing space so the comment reads `// Beta; ...` for consistent formatting.

## Bug Fix
- **Location:** `Amazon-Reviews-Analyzer.user.js`, `parseResponse` function when extracting `reviewHelpfulVotes`.
- **Issue:** The helpful vote count is parsed with `parseInt(reviewHelpfulVotesElement.textContent.trim(), 10)`. Amazon displays thousands with commas (e.g., `1,234`), and `parseInt` stops at the comma, so votes above 999 are truncated.
- **Suggested Fix:** Strip non-digit characters (except possibly handling localized formats) before converting to an integer to maintain accurate vote counts.

## Documentation/Comment Correction
- **Location:** `README.md`, installation steps list.
- **Issue:** The ordered list jumps from step 2 to 5, then 7, 8, 9, which is confusing even if Markdown renders sequential numbers.
- **Suggested Fix:** Renumber the steps consecutively (or use `1.` for all items) so the Markdown source reflects the intended order.

## Test Improvement
- **Location:** Add a new test module (e.g., `tests/parseResponse.test.js`).
- **Issue:** The repository currently lacks automated coverage for parsing logic. The `parseResponse` helper is critical and has subtle cases like thousands separators and optional fields.
- **Suggested Enhancement:** Introduce a unit test that feeds representative HTML snippets into `parseResponse` and asserts correct extraction of vote counts, review IDs, ratings (including half stars), and timestamps. This guards against regressions when Amazon adjusts their markup.
