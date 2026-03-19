'use strict';

/**
 * Unit tests for the parseResponse function in Amazon-Reviews-Analyzer.user.js.
 *
 * Strategy: the userscript is a self-contained browser script, not a module.
 * We load it inside a vm sandbox backed by a fresh jsdom document so every
 * test gets isolated state (reviewData, idCount, etc.).
 */

const vm   = require('vm');
const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Strip the ==UserScript== metadata block – it is not valid JavaScript.
const SCRIPT_SOURCE = fs
  .readFileSync(path.join(__dirname, '..', 'Amazon-Reviews-Analyzer.user.js'), 'utf8')
  .replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/m, '');

/**
 * Build a fresh vm context backed by an isolated jsdom instance.
 * All browser-specific globals (GM_*, localStorage, canvas) are stubbed.
 * Returns the context object; context.parseResponse is the function under test.
 */
function buildContext() {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
  const { window } = dom;

  // jsdom has no canvas implementation – stub getContext so isEmojiSupported()
  // returns false for every emoji instead of throwing a TypeError.
  window.HTMLCanvasElement.prototype.getContext = () => ({
    fillText:     () => {},
    getImageData: () => ({ data: [0, 0, 0, 0] }),
  });

  // Minimal localStorage stub
  const store = {};
  const localStorage = {
    getItem:    (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear:      () => { Object.keys(store).forEach((k) => delete store[k]); },
  };

  const context = vm.createContext({
    document:          window.document,
    window,
    URL:               window.URL,
    localStorage,
    // Greasemonkey / Violentmonkey APIs
    GM_xmlhttpRequest: () => {},
    GM_info:           { script: { author: 'Test', version: '0.0.0' } },
    // Standard globals that are NOT automatically present in a vm sandbox
    console,
    alert: () => {},
  });

  // Executing the script makes its function declarations (parseResponse, etc.)
  // become properties on the context object (they are treated as var-like in
  // the vm module's global scope).
  vm.runInContext(SCRIPT_SOURCE, context);

  return context;
}

// ── HTML fixture helpers ──────────────────────────────────────────────────────

/**
 * Build a single review-card HTML string.
 *
 * @param {object} opts
 * @param {string}  opts.reviewId        - Review ID embedded in menu JSON + href
 * @param {string}  opts.asin            - ASIN embedded in menu JSON
 * @param {number}  opts.rating          - Star class suffix (1-5)
 * @param {string}  opts.votes           - Text content of the reaction-count span
 * @param {string}  opts.title           - Review title
 * @param {string}  opts.text            - Review body text
 * @param {boolean} opts.includeVoteSpan - Whether to include the vote span at all
 */
function reviewCard({
  reviewId        = 'R1TEST000',
  asin            = 'B000TEST01',
  rating          = 5,
  votes           = '0',
  title           = 'Sample Review',
  text            = 'Body text.',
  includeVoteSpan = true,
} = {}) {
  const editUrl  = `https://www.amazon.com/review/edit-review/?asin=${asin}&reviewID=${reviewId}`;
  const menuJson = JSON.stringify({ editUrl });
  const menuAttr = menuJson.replace(/"/g, '&quot;'); // encode for HTML attribute

  return `
    <div class="review-card-container">
      <span data-a-review-menu-ingress-display="${menuAttr}"></span>
      <a class="a-link-normal a-text-normal"
         href="https://www.amazon.com/gp/customer-reviews/${reviewId}">View</a>
      <span class="review-title a-text-bold">${title}</span>
      <span class="review-description">${text}</span>
      <i class="a-icon-star a-star-${rating}"></i>
      ${includeVoteSpan ? `<span class="review-reaction-count">${votes}</span>` : ''}
      <img class="review-product-thumbnail" src="https://example.com/img.jpg">
    </div>`;
}

/**
 * Wrap cards inside the expected response structure.
 *
 * @param {object}   opts
 * @param {string|null} opts.token - Value for the pageToken hidden input
 * @param {string[]} opts.cards    - Array of review-card HTML strings
 */
function page({ token = null, cards = [] } = {}) {
  const tokenInput = token ? `<input name="pageToken" value="${token}">` : '';
  return `${tokenInput}<div id="contentAjax">${cards.join('')}</div>`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('parseResponse', () => {
  test('extracts reviewId, asin, title, text, rating, and vote count', () => {
    const ctx  = buildContext();
    const html = page({
      cards: [reviewCard({
        reviewId: 'RABCDE12345',
        asin:     'B0TESTASIN1',
        rating:   4,
        votes:    '7',
        title:    'Great product',
        text:     'Really enjoyed it.',
      })],
    });

    const { reviews } = ctx.parseResponse(html);

    expect(reviews).toHaveLength(1);
    const [r] = reviews;
    expect(r.reviewId).toBe('RABCDE12345');
    expect(r.asin).toBe('B0TESTASIN1');
    expect(r.reviewRating).toBe(4);
    expect(r.reviewHelpfulVotes).toBe(7);
    expect(r.reviewTitle).toBe('Great product');
    expect(r.reviewText).toBe('Really enjoyed it.');
  });

  test('parses vote counts with thousands separators ("1,234" → 1234)', () => {
    const ctx  = buildContext();
    const html = page({ cards: [reviewCard({ votes: '1,234' })] });

    const { reviews } = ctx.parseResponse(html);

    expect(reviews[0].reviewHelpfulVotes).toBe(1234);
  });

  test('returns 0 helpful votes when the reaction-count span is absent', () => {
    const ctx  = buildContext();
    const html = page({ cards: [reviewCard({ includeVoteSpan: false })] });

    const { reviews } = ctx.parseResponse(html);

    expect(reviews[0].reviewHelpfulVotes).toBe(0);
  });

  test('returns 0 helpful votes when the span is present but empty', () => {
    const ctx  = buildContext();
    const html = page({ cards: [reviewCard({ votes: '' })] });

    const { reviews } = ctx.parseResponse(html);

    expect(reviews[0].reviewHelpfulVotes).toBe(0);
  });

  test('extracts the next page token', () => {
    const ctx  = buildContext();
    const html = page({ token: 'TOKEN_PAGE_2', cards: [] });

    const { nextPageToken } = ctx.parseResponse(html);

    expect(nextPageToken).toBe('TOKEN_PAGE_2');
  });

  test('returns null nextPageToken when the input element is not present', () => {
    const ctx  = buildContext();
    const html = page({ cards: [] });

    const { nextPageToken } = ctx.parseResponse(html);

    expect(nextPageToken).toBeNull();
  });

  test.each([1, 2, 3, 4, 5])('extracts %d-star rating correctly', (stars) => {
    const ctx  = buildContext();
    const html = page({ cards: [reviewCard({ rating: stars })] });

    const { reviews } = ctx.parseResponse(html);

    expect(reviews[0].reviewRating).toBe(stars);
  });

  test('half-star class (a-star-4-5) is truncated to integer by parseInt', () => {
    // Amazon uses e.g. a-star-4-5 for 4.5 stars.
    // parseInt('4-5', 10) === 4  →  current behaviour truncates to the lower star.
    const ctx  = buildContext();
    const card = reviewCard({ rating: 5 }).replace('a-star-5', 'a-star-4-5');
    const html = page({ cards: [card] });

    const { reviews } = ctx.parseResponse(html);

    expect(reviews[0].reviewRating).toBe(4); // documents truncation behaviour
  });

  test('returns an empty reviews array when #contentAjax is missing', () => {
    const ctx = buildContext();

    const { reviews } = ctx.parseResponse('<div>unexpected content</div>');

    expect(reviews).toHaveLength(0);
  });

  test('returns an empty reviews array for an empty HTML string', () => {
    const ctx = buildContext();

    const { reviews } = ctx.parseResponse('');

    expect(reviews).toHaveLength(0);
  });

  test('handles multiple review cards in a single response', () => {
    const ctx  = buildContext();
    const html = page({
      cards: [
        reviewCard({ reviewId: 'R001', votes: '5' }),
        reviewCard({ reviewId: 'R002', votes: '1,000' }),
        reviewCard({ reviewId: 'R003', votes: '0' }),
      ],
    });

    const { reviews } = ctx.parseResponse(html);

    expect(reviews).toHaveLength(3);
    expect(reviews[0].reviewHelpfulVotes).toBe(5);
    expect(reviews[1].reviewHelpfulVotes).toBe(1000);
    expect(reviews[2].reviewHelpfulVotes).toBe(0);
  });

  test('falls back to extracting reviewId from the URL path when data attribute is absent', () => {
    const ctx  = buildContext();
    const card = `
      <div class="review-card-container">
        <a class="a-link-normal a-text-normal"
           href="https://www.amazon.com/gp/customer-reviews/RFALLBACK999">View</a>
        <span class="review-title a-text-bold">Title</span>
        <i class="a-icon-star a-star-3"></i>
        <span class="review-reaction-count">2</span>
        <img class="review-product-thumbnail" src="x.jpg">
      </div>`;
    const html = page({ cards: [card] });

    const { reviews } = ctx.parseResponse(html);

    expect(reviews[0].reviewId).toBe('RFALLBACK999');
  });

  test('ts field is not set by parseResponse (only by compareProductData)', () => {
    const ctx  = buildContext();
    const html = page({ cards: [reviewCard()] });

    const { reviews } = ctx.parseResponse(html);

    expect(reviews[0].ts).toBeUndefined();
  });
});
