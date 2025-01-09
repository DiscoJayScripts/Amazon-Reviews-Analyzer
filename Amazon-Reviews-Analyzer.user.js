// ==UserScript==
// @name         Amazon Reviews Analyzer
// @namespace    https://violentmonkey.github.io
// @version      2.0.0
// @releaseDate  2025-01-09
// @description  Filters and sorts all helpful reviews of your own account
// @author       DiscoJay
// @license      GPL
// @match        *://www.amazon.*/gp/profile/amzn1.account.*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazon.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==

// ==================== Configuration ====================
const DEBUG_MODE = true;
const REVIEWS_PER_PAGE = 100; // Number of reviews per page
const MAX_ITERATIONS = 0; // Maximum number of pages to fetch (for testing purposes); Use 0 for no limit
const REQUEST_DELAY = 1100; // Delay between requests for not running into temporary IP bans
let reviewData = [];
let idCount = 1; // Unique identifier for each review entry
// ========================================================

const araContainer = document.createElement('div');
const araReviews = document.createElement('div');

window.addEventListener('load', createReviewsAnalyzerBlock);

function createReviewsAnalyzerBlock() {
    if (!document.querySelector('#shop-influencer-owner-view-section')) {
        log('Not my profile page');
        return;
    }

    const shopContentContainer = document.querySelector('#shopContentContainer');
    if (!shopContentContainer) {
        log('ERROR: #shopContentContainer not found!');
        return;
    }

    araContainer.id = 'araContainer';
    araContainer.classList.add('a-section', 'a-text-center', 'unified-search-container', 'border-rounded');

    araReviews.id = 'araReviews';

    const araHeader = document.createElement('div');
    araHeader.id = 'araHeader';
    araHeader.classList.add('navigation-container');

    const araButtons = document.createElement('div');
    araButtons.id = 'araButtons';
    araButtons.classList.add('navigation-tabs-container');

    const analyzeButton = document.createElement('div');
    analyzeButton.textContent = 'Analyze My Reviews';
    analyzeButton.id = 'analyzeReviewsButton';
    analyzeButton.classList.add('navBtn');

    const exportButton = document.createElement('div');
    exportButton.textContent = 'Export to CSV';
    exportButton.id = 'exportCsvButton';
    exportButton.classList.add('navBtn', 'disabled');

    const infoButton = document.createElement('div');
    infoButton.textContent = '🪩';
    infoButton.title = 'Amazon Reviews Analyzer - Info';
    infoButton.id = 'infoReviewsButton';
    infoButton.classList.add('emojiLink');
    infoButton.addEventListener('click', showInfoBox);

    const statsOverview = document.createElement('div');

    // Retrieve stored stats from localStorage
    const storedSettings = getStoredSettingsData();
    const totalReviews = storedSettings?.stats?.totalReviews || 0;
    const totalVotes = storedSettings?.stats?.totalVotes || 0;
    const lastScanDate = storedSettings?.stats?.lastScanDate || null;

    // Display "-" instead of "0" and omit date if never scanned
    const displayTotalReviews = totalReviews > 0 ? totalReviews : '-';
    const displayTotalVotes = totalVotes > 0 ? totalVotes : '-';
    const displayLastScanDate = lastScanDate ? `(${lastScanDate})` : '';

    statsOverview.innerHTML = `📝 Reviews: <b>${displayTotalReviews}</b>&nbsp;&nbsp;&nbsp;❤️ Hearts: <b>${displayTotalVotes}</b>&nbsp;&nbsp;&nbsp;<span style="opacity:.2" title="Last scanned on">${displayLastScanDate}</span>`;
    statsOverview.id = 'statsReviewsOverview';

    analyzeButton.addEventListener('click', () => {
        analyzeButton.style.cursor = "not-allowed";
        analyzeButton.classList.add('disabled');
        araReviews.style.display = "block";
        processAndShowContent();
    });

    exportButton.addEventListener('click', exportToCSV);

    araButtons.append(analyzeButton, exportButton, statsOverview, infoButton);
    araHeader.appendChild(araButtons);
    araContainer.append(araHeader, araReviews);
    shopContentContainer.insertAdjacentElement('beforebegin', araContainer);
}

function createTextLink(review) {
    const textLink = document.createElement('a');
    textLink.href = review.reviewLink;
    textLink.target = '_blank';
    textLink.textContent = sanitizeHTML(review.productTitle);
    return textLink;
}

function createAnchorLink(review) {
    const anchorLink = document.createElement('a');
    anchorLink.href = `#review-${review.reviewId}`;
    anchorLink.textContent = ' ⤵️';
    anchorLink.title = 'Jump to review details';
    anchorLink.classList.add('emojiLink');
    return anchorLink;
}

function visualizeReviewData(reviewData, newReviews) {
    const totalReviews = reviewData.length;
    const totalVotes = reviewData.reduce((sum, review) => sum + (review.reviewHelpfulVotes || 0), 0);

    const displayTotalReviews = totalReviews > 0 ? totalReviews : '-';
    const displayTotalVotes = totalVotes > 0 ? totalVotes : '-';

    document.getElementById('exportCsvButton').classList.remove('disabled');

    const fragment = document.createDocumentFragment();

    if (newReviews.length > 0) {
        const newReviewsDiv = document.createElement('div');
        newReviewsDiv.innerHTML = `<h3>🆕 New votes since last scan:</h3>`;
        newReviewsDiv.id = 'araChangedList';
        newReviews.forEach(review => {
            const reviewElement = document.createElement('div');
            reviewElement.classList.add('new');

            let voteChange = review.newVotes - review.oldVotes;
            let voteChangeText = voteChange > 0 ? `(+${voteChange})` : `(${voteChange})`;
            let voteChangeColor = voteChange > 0 ? 'green' : 'red';

            // Create external link for the product title
            const textLink = createTextLink(review);

            // Create internal link for the ⤵️ symbol with tooltip
            const anchorLink = createAnchorLink(review);

            // Assemble the product element
            reviewElement.innerHTML = `❤️${review.newVotes} <span style="color: ${voteChangeColor}">${voteChangeText}</span> ${'⭐'.repeat(review.reviewRating)}${'▫️'.repeat(5 - review.reviewRating)} `;
            reviewElement.appendChild(textLink);
            reviewElement.appendChild(anchorLink);

            newReviewsDiv.appendChild(reviewElement);
        });
        const hr2 = document.createElement('hr');
        hr2.style.margin = '20px 0';
        newReviewsDiv.appendChild(hr2);
        fragment.appendChild(newReviewsDiv);
    }

    // Add the section for the 10 last updated reviews
    const recentReviews = reviewData
        .filter(review => review.ts) // Filter reviews that have a ts field
        .sort((a, b) => new Date(b.ts) - new Date(a.ts)) // Sort by ts in descending order
        .slice(0, 10); // Get the 10 most recent reviews

    if (recentReviews.length > 0) {
        const recentReviewsDiv = document.createElement('div');
        recentReviewsDiv.innerHTML = `<h3>🕒 Recently updated votes:</h3>`;
        recentReviewsDiv.id = 'araRecentList';
        recentReviews.forEach(review => {
            const reviewElement = document.createElement('div');
            reviewElement.classList.add('latest');

            // Create external link for the product title
            const textLink = createTextLink(review);

            // Create internal link for the ⤵️ symbol with tooltip
            const anchorLink = createAnchorLink(review);

            // Assemble the review element
            reviewElement.innerHTML = `❤️${review.reviewHelpfulVotes} ${'⭐'.repeat(review.reviewRating)}${'▫️'.repeat(5 - review.reviewRating)} `;
            reviewElement.appendChild(textLink);
            reviewElement.appendChild(anchorLink);
            reviewElement.innerHTML += ` <span style="opacity:.2">(${sanitizeHTML(review.ts)})</span>`;

            recentReviewsDiv.appendChild(reviewElement);
        });
        const hr3 = document.createElement('hr');
        hr3.style.margin = '20px 0';
        recentReviewsDiv.appendChild(hr3);
        fragment.appendChild(recentReviewsDiv);
    }

    // Add the section for the most helpful reviews
    const helpfulReviews = document.createElement("div");
    helpfulReviews.id = 'araHelpfulList';
    helpfulReviews.innerHTML = `<h3>🏆 Most helpful reviews:</h3>`;
    fragment.appendChild(helpfulReviews);

    const sortedReviews = reviewData
        .filter(review => review.reviewHelpfulVotes > 0)
        .sort((a, b) => b.reviewHelpfulVotes - a.reviewHelpfulVotes);

    sortedReviews.forEach(review => {
        const container = document.createElement("div");
        container.id = `review-${review.reviewId}`;

        // Product Image
        const imageContainer = document.createElement("img");
        imageContainer.classList.add('productImage');
        imageContainer.src = review.productImage && !review.productImage.includes('transparent-pixel')
            ? review.productImage.replace('.jpg', '.US100.jpg')
            : `https://m.media-amazon.com/images/G/01/x-site/icons/no-img-lg.gif`;
        imageContainer.alt = sanitizeHTML(review.productTitle);

        // Product Image with Link to Product Page
        if (review.asin) {
            const imageLinkElement = document.createElement("a");
            imageLinkElement.href = `https://${document.location.hostname}/dp/${review.asin}`;
            imageLinkElement.target = "_blank";
            imageLinkElement.title = review.asin;
            imageLinkElement.appendChild(imageContainer);
            container.appendChild(imageLinkElement);
        } else {
            container.appendChild(imageContainer);
        }

        // Review Details
        const containerInner = document.createElement("div");
        containerInner.innerHTML = `❤️${sanitizeHTML(review.reviewHelpfulVotes)} ${'⭐'.repeat(review.reviewRating)}${'▫️'.repeat(5 - review.reviewRating)} `;

        const linkElement = document.createElement("a");
        linkElement.href = review.reviewLink;
        linkElement.target = "_blank";
        linkElement.textContent = sanitizeHTML(review.reviewTitle);
        containerInner.appendChild(linkElement);

        // Review Text
        const shortSpan = document.createElement("div");
        shortSpan.id = `shortText${review.id}`;
        shortSpan.classList.add('shortText');
        shortSpan.innerHTML = sanitizeHTML(review.reviewText ? (review.reviewText.slice(0, 250) + (review.reviewText.length > 250 ? '...' : '')) : '');

        const longSpan = document.createElement("div");
        longSpan.id = `fullText${review.id}`;
        longSpan.style.display = "none";
        longSpan.innerHTML = sanitizeHTML(review.reviewText);

        // Toggle Button
        const button = document.createElement("button");
        button.id = `expandText${review.id}`;
        button.style.border = "none";
        button.style.background = "none";
        button.style.cursor = "pointer";
        button.textContent = "[ + ]";
        button.setAttribute('aria-label', 'Expand review text');
        button.title = "Toggle full review text";
        button.addEventListener('click', () => toggleText(review.id));

        if (review.reviewImage) {
            var reviewImage = document.createElement("img");
            reviewImage.classList.add('reviewImage');
            reviewImage.src = review.reviewImage;
            containerInner.appendChild(reviewImage);
        }

        containerInner.append(shortSpan, longSpan, button);
        container.appendChild(containerInner);
        helpfulReviews.appendChild(container);
    });

    araReviews.innerHTML = '';
    araReviews.appendChild(fragment);

    // Store totalReviews, totalVotes, and lastScanDate to localStorage under "stats"
    const currentDate = new Date().toISOString().split('T')[0];
    storeSettingsData({ stats: { totalReviews, totalVotes, lastScanDate: currentDate }, options: {} });

    // Update the statsOverview in the header
    const statsOverviewElement = document.getElementById('statsReviewsOverview');
    if (statsOverviewElement) {
        statsOverviewElement.innerHTML = `📝 Reviews: <b>${displayTotalReviews}</b>&nbsp;&nbsp;&nbsp;❤️ Hearts: <b>${displayTotalVotes}</b>&nbsp;&nbsp;&nbsp;<span style="opacity:.2" title="Last scanned on">${currentDate ? `(${currentDate})` : ''}</span>`;
    }
}

function storeProductData(productData) {
    try {
        const existingData = getStoredProductData();
        const mergedData = {};

        // Convert existing data to a map for quick access
        existingData.forEach(item => {
            mergedData[item.id] = item;
        });

        // Merge new data
        productData.forEach(product => {
            mergedData[product.reviewId] = {
                id: product.reviewId,
                asin: product.asin,
                votes: product.reviewHelpfulVotes,
                ts: product.ts || mergedData[product.reviewId]?.ts || null
            };
        });

        // Convert back to an array
        const mergedDataArray = Object.values(mergedData);

        localStorage.setItem('AmazonReviewsAnalyzer_Products', JSON.stringify(mergedDataArray));
    } catch (e) {
        log('Error storing product data:', e);
    }
}

function getStoredProductData() {
    const storedData = localStorage.getItem('AmazonReviewsAnalyzer_Products');
    return storedData ? JSON.parse(storedData) : [];
}

function storeSettingsData(settingsData) {
    try {
        localStorage.setItem('AmazonReviewsAnalyzer_Settings', JSON.stringify(settingsData));
    } catch (e) {
        log('Error storing settings data:', e);
    }
}

function getStoredSettingsData() {
    const storedData = localStorage.getItem('AmazonReviewsAnalyzer_Settings');
    return storedData ? JSON.parse(storedData) : {};
}

async function exportToCSV() {
    if (reviewData.length !== 0) {
        downloadCSV(reviewData, 'Amazon-Reviews-Analyzer.csv');
    } else {
        alert('No reviews found!');
    }

    function convertToCSV(data) {
        if (data.length === 0) return '';
        const headers = Object.keys(data[0]);
        const headerRow = headers.join(';') + '\n';

        const csvRows = data.map(row => {
            return headers.map(header => `"${sanitizeCSV(row[header])}"`).join(';');
        });

        return '\uFEFF' + headerRow + csvRows.join('\n'); // Prefix with BOM character
    }

    function downloadCSV(data, filename) {
        const csv = convertToCSV(data);

        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
    }
}

function getStarRating(wrapper) {
    for (let i = 5; i >= 1; i--) {
        if (wrapper.querySelector(`.a-star-${i}`)) {
            return '⭐'.repeat(i) + '▫️'.repeat(5 - i);
        }
    }
    return '▫️▫️▫️▫️▫️'; // Return empty stars if no rating found
}

function toggleText(index) {
    const shortText = document.getElementById(`shortText${index}`);
    const fullText = document.getElementById(`fullText${index}`);
    const expandButton = document.getElementById(`expandText${index}`);

    if (shortText.style.display === 'none') {
        shortText.style.display = 'block';
        fullText.style.display = 'none';
        expandButton.textContent = '[ + ]';
    } else {
        shortText.style.display = 'none';
        fullText.style.display = 'block';
        expandButton.textContent = '[ - ]';
    }
}

// ==================== Info Box Functionality ====================

/**
 * Function to display the Info Box when the 🪩 icon is clicked.
 */
function showInfoBox() {
    // Check if the info box already exists
    if (document.getElementById('infoBoxOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'infoBoxOverlay';
    overlay.classList.add('info-overlay');

    const infoBox = document.createElement('div');
    infoBox.classList.add('info-box');

    const closeButton = document.createElement('span');
    closeButton.classList.add('close-button');
    closeButton.innerHTML = '&times;';
    closeButton.title = 'Close';
    closeButton.addEventListener('click', closeInfoBox);

    const contentContainer = document.createElement('div');
    contentContainer.classList.add('info-content');

    const emoji = document.createElement('div');
    emoji.classList.add('info-emoji');
    emoji.textContent = '🪩';

    const details = document.createElement('div');
    details.classList.add('info-details');

    const header = document.createElement('h2');
    header.textContent = 'Amazon Reviews Analyzer';

    const author = document.createElement('p');
    author.innerHTML = `<strong>Author:</strong> ${GM_info.script.author}`;

    const projectLink = document.createElement('p');
    projectLink.innerHTML = `<strong>Project:</strong> <a href="https://github.com/DiscoJayScripts/Amazon-Reviews-Analyzer" target="_blank">GitHub Repository</a>`;

    const version = document.createElement('p');
    version.innerHTML = `<strong>Version:</strong> ${GM_info.script.version}`;

    const releaseDateElem = document.createElement('p');
    releaseDateElem.innerHTML = `<strong>Release Date:</strong> ${GM_info.script.releaseDate}`;

    details.appendChild(header);
    details.appendChild(author);
    details.appendChild(projectLink);
    details.appendChild(version);
    details.appendChild(releaseDateElem);

    contentContainer.appendChild(emoji);
    contentContainer.appendChild(details);

    infoBox.appendChild(closeButton);
    infoBox.appendChild(contentContainer);

    overlay.appendChild(infoBox);
    document.body.appendChild(overlay);

    // Add event listener to close when clicking outside the info box
    overlay.addEventListener('click', function(event) {
        if (event.target === overlay) {
            closeInfoBox();
        }
    });
}

/**
 * Function to close the Info Box.
 */
function closeInfoBox() {
    const overlay = document.getElementById('infoBoxOverlay');
    if (overlay) {
        document.body.removeChild(overlay);
    }
}

/**
 * Utility function to log messages with a specific prefix for clarity.
 * @param  {...any} args - The messages or data to log.
 */
function log(...args) {
    if (DEBUG_MODE) {
        console.log(`[Amazon Reviews Analyzer]`, ...args);
    }
}

/**
 * Utility function to decode HTML entities.
 * @param {string} text - The text with HTML entities.
 * @returns {string} - The decoded text.
 */
function decodeHTMLEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

/**
 * Utility function to sanitize HTML to prevent XSS attacks.
 * @param {string} text - The text to sanitize.
 * @returns {string} - The sanitized text.
 */
function sanitizeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Utility function to sanitize CSV fields.
 * @param {string} text - The CSV field text.
 * @returns {string} - The sanitized CSV field.
 */
function sanitizeCSV(text) {
    if (typeof text === 'string') {
        return text.replace(/"/g, '""');
    }
    return text;
}

/**
 * Utility function to get the base URL (current URL without query parameters)
 * and transform it to the getReviews endpoint.
 * @returns {string} - The transformed base URL for getReviews.
 */
function getBaseUrl() {
    const url = new URL(window.location.href);
    url.search = ''; // Remove query parameters
    url.hash = ''; // Remove the hash/anchor

    // Transform the original profile URL to the getReviews endpoint
    // Original: https://www.amazon.com/gp/profile/amzn1.account.abc
    // Desired: https://www.amazon.com/shop/profile/amzn1.account.abc/getReviews

    const pathSegments = url.pathname.split('/');
    // Replace 'gp/profile' with 'shop/profile' and append 'getReviews'
    if (pathSegments.length >= 3 && pathSegments[1] === 'gp' && pathSegments[2] === 'profile') {
        pathSegments[1] = 'shop';
        pathSegments[2] = 'profile';
        pathSegments.push('getReviews');
    } else {
        log('Unexpected URL structure. Attempting to append /getReviews.');
        pathSegments.push('getReviews');
    }

    const transformedPath = pathSegments.join('/');
    url.pathname = transformedPath;
    log(`Transformed Base URL for getReviews: ${url.href}`);
    return url.href;
}

/**
 * Parses the HTML response to extract the next page token and review content.
 * @param {string} responseText - The HTML response text.
 * @returns {Object} - An object containing the nextPageToken and an array of review objects.
 */
function parseResponse(responseText) {
    // Create a temporary DOM element to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = responseText;

    // Extract the next page token from the hidden input
    const tokenInput = tempDiv.querySelector('input[name="pageToken"]');
    const nextPageToken = tokenInput ? tokenInput.value : null;

    // Extract the content from #contentAjax
    const contentDiv = tempDiv.querySelector('#contentAjax');
    if (!contentDiv) {
        log('No #contentAjax element found in the response.');
        return { nextPageToken: nextPageToken, reviews: [] };
    }

    // Extract all review cards
    const reviewCards = contentDiv.querySelectorAll('.review-card-container');
    const reviews = [];

    reviewCards.forEach((card) => {
        // Locate the <span> with data-a-review-menu-ingress-display inside the card
        const dataSpan = card.querySelector('span[data-a-review-menu-ingress-display]');
        const dataAttr = dataSpan ? dataSpan.getAttribute('data-a-review-menu-ingress-display') : null;
        let asin = null;
        let reviewId = null;

        if (dataAttr) {
            try {
                // Decode HTML entities to properly parse JSON
                const decodedDataAttr = decodeHTMLEntities(dataAttr);
                const parsedData = JSON.parse(decodedDataAttr);

                // Extract asin and reviewID from editUrl or deleteUrl
                const editUrl = parsedData.editUrl || null;
                const deleteUrl = parsedData.deleteUrl || null;

                if (editUrl) {
                    const url = new URL(editUrl);
                    asin = url.searchParams.get('asin') || null;
                    reviewId = url.searchParams.get('reviewID') || null;
                }

                // Fallback to deleteUrl if asin or reviewId not found
                if ((!asin || !reviewId) && deleteUrl) {
                    const url = new URL(deleteUrl);
                    asin = asin || url.searchParams.get('asin') || null;
                    reviewId = reviewId || url.searchParams.get('reviewID') || null;
                }
            } catch (e) {
                log(`Error parsing data-a-review-menu-ingress-display JSON: ${e}`);
            }
        }

        // Extract review link and clean it by removing query parameters
        const reviewLinkElement = card.querySelector('a.a-link-normal.a-text-normal');
        let reviewLink = reviewLinkElement ? reviewLinkElement.href : null;

        if (reviewLink) {
            try {
                const url = new URL(reviewLink);
                reviewLink = url.origin + url.pathname; // Remove query parameters
            } catch (e) {
                log(`Error parsing reviewLink URL: ${reviewLink} - ${e}`);
            }
        }

        // If reviewId wasn't extracted from data attributes, extract from reviewLink
        if (!reviewId && reviewLink) {
            try {
                const url = new URL(reviewLink);
                const pathSegments = url.pathname.split('/');
                reviewId = pathSegments[pathSegments.length - 1] || null;
            } catch (e) {
                log(`Error extracting reviewId from reviewLink: ${reviewLink} - ${e}`);
            }
        }

        // Extract product title
        const reviewTitleElement = card.querySelector('span.review-title.a-text-bold');
        const reviewTitle = reviewTitleElement ? reviewTitleElement.textContent.trim() : null;

        // Extract review description/text
        const reviewDescriptionElement = card.querySelector('span.review-description');
        const reviewText = reviewDescriptionElement ? reviewDescriptionElement.textContent.trim() : null;

        // Extract review rating
        const reviewRatingElement = card.querySelector('i.a-icon-star');
        let reviewRating = null;
        if (reviewRatingElement) {
            const classList = Array.from(reviewRatingElement.classList);
            const starClass = classList.find(cls => cls.startsWith('a-star-'));
            if (starClass) {
                reviewRating = parseInt(starClass.replace('a-star-', ''), 10);
            }
        }

        // Extract review helpful votes
        const reviewHelpfulVotesElement = card.querySelector('span.review-reaction-count');
        const reviewHelpfulVotes = reviewHelpfulVotesElement ? parseInt(reviewHelpfulVotesElement.textContent.trim(), 10) : 0;

        // Extract product image
        const productImageElement = card.querySelector('img.review-product-thumbnail');
        const productImage = productImageElement ? productImageElement.src : null;

        // Extract review image
        const reviewImageElement = card.querySelector('img.review-image');
        const reviewImage = reviewImageElement ? reviewImageElement.src : null;

        // Construct the review object with the specified field names
        const reviewObject = {
            asin: asin,
            id: idCount,
            productTitle: reviewTitle,
            productImage: productImage,
            reviewId: reviewId,
            reviewRating: reviewRating,
            reviewHelpfulVotes: reviewHelpfulVotes,
            reviewImage: reviewImage,
            reviewTitle: reviewTitle,
            reviewText: reviewText,
            reviewLink: reviewLink
        };

        // Push the review object to the reviews array
        reviews.push(reviewObject);

        // Also push to the global reviewData array
        reviewData.push(reviewObject);

        // Increment the unique identifier
        idCount++;
    });

    return { nextPageToken, reviews };
}

/**
 * Fetches the next page of reviews using the provided page token.
 * @param {string} baseUrl - The transformed base URL for getReviews.
 * @param {string} pageToken - The encoded page token. Empty string for the first fetch.
 * @returns {Promise<Object>} - A promise that resolves to the parsed response.
 */
function fetchNextPage(baseUrl, pageToken) {
    return new Promise((resolve, reject) => {
        // Construct the request URL
        let requestUrl = `${baseUrl}?pageSize=${REVIEWS_PER_PAGE}`;
        if (pageToken) {
            const encodedPageToken = encodeURIComponent(pageToken);
            requestUrl += `&pageToken=${encodedPageToken}`;
        }

        log(`Fetching URL: ${requestUrl}`);

        // Make the HTTP GET request using GM_xmlhttpRequest
        GM_xmlhttpRequest({
            method: "GET",
            url: requestUrl,
            headers: {
                "Content-Type": "text/html", // Expecting HTML response
                "Accept": "text/html"
            },
            onload: function(response) {
                if (response.status === 200) {
                    log(`Successfully fetched page with token: ${pageToken || 'Initial Fetch'}`);
                    const parsed = parseResponse(response.responseText);
                    if (parsed.nextPageToken) {
                        log(`Extracted Next Page Token: ${parsed.nextPageToken}`);
                    } else {
                        log('No nextPageToken found in the response.');
                    }
                    resolve(parsed);
                } else {
                    log(`Failed to fetch page. Status: ${response.status}`);
                    reject(new Error(`Status code: ${response.status}`));
                }
            },
            onerror: function(err) {
                log(`Error during GM_xmlhttpRequest: ${err}`);
                reject(err);
            }
        });
    });
}

/**
 * Main function to orchestrate the fetching of reviews.
 */
async function processAndShowContent() {
    try {
        log('Amazon Reviews Analyzer: Start');
        // Removed the preventScrollingEvents call as per user request
        reviewData = []; // Clear existing data

        const baseUrl = getBaseUrl();
        let currentToken = ''; // Start with an empty token for the initial fetch
        let iteration = 0;

        while (currentToken !== null && (MAX_ITERATIONS === 0 || iteration < MAX_ITERATIONS)) {
            log(`\n--- Iteration ${iteration + 1} ---`);
            const result = await fetchNextPage(baseUrl, currentToken);
            currentToken = result.nextPageToken || null;

            araReviews.innerHTML = `<div style="margin: 50px 0px">⏳ <b>Loading reviews, please wait... (Do not scroll down during the scan!)</b><br>Page: ${iteration + 1}, Reviews: ${reviewData.length}</div>`;

            // Adds a pause - Too frequent requests may result in temporary access bans
            await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));

            iteration++;
        }

        log('Finished fetching reviews.');

        // Calculate total number of reviews and total votes
        const totalReviews = reviewData.length;
        const totalVotes = reviewData.reduce((sum, review) => sum + (review.reviewHelpfulVotes || 0), 0);

        log(`Total number of reviews extracted: ${totalReviews}`);
        log(`Total number of helpful votes: ${totalVotes}`);
        if (DEBUG_MODE) console.log(reviewData);

        // Get the changed products
        const newReviews = compareProductData(reviewData);
        log("Changed products:", newReviews);

        // Update the stored data with the current data
        storeProductData(reviewData);

        // Store totalReviews, totalVotes, and lastScanDate to localStorage under "stats"
        const currentDate = new Date().toISOString().split('T')[0];
        storeSettingsData({ stats: { totalReviews, totalVotes, lastScanDate: currentDate }, options: {} });

        visualizeReviewData(reviewData, newReviews);
    } catch (error) {
        log('An error occurred during processing:', error);
        // Clear the scan progress message
        araReviews.innerHTML = `<div class="error">❌ An error occurred while analyzing reviews. Please check the console for details.</div>`;
    }
}

/**
 * Function to compare current data with stored data
 * @param {Array} currentData - The current array of review objects.
 * @returns {Array} - An array of changed products.
 */
function compareProductData(currentData) {
    const storedData = getStoredProductData();
    const newReviews = [];

    currentData.forEach(currentItem => {
        const storedItem = storedData.find(item => item.id === currentItem.reviewId);
        if (storedItem) {
            if (storedItem.votes !== currentItem.reviewHelpfulVotes) {
                // Add the current timestamp to the current item if votes have changed
                currentItem.ts = new Date().toISOString().split('T')[0];
                newReviews.push({
                    ...currentItem,
                    oldVotes: storedItem.votes,
                    newVotes: currentItem.reviewHelpfulVotes
                });
            } else {
                // Preserve the ts value if it exists in the stored data
                currentItem.ts = storedItem.ts;
            }
        }
    });

    return newReviews;
}

// ==================== Styling ====================

const style = document.createElement('style');
style.textContent = `
#araContainer {
  text-align: left !important;
  padding: 0;
  margin: 8px auto;
  overflow: hidden;
}

#araReviews {
  padding: 30px;
  display: none;
}

#araReviews > div > p {
  margin: 1em;
}

#araHeader {
  background-color: #e7e7e7;
  padding: 20px;
  margin: 0;
  position: relative;
}

#araButtons {
  display: flex;
}

#infoReviewsButton {
  font-size: 180%;
  position: absolute;
  right: 20px;
}

#statsReviewsOverview {
  flex: 1;
  display:inline-block;
  padding: 8px;
  font-size: 1.2em;
}

.productImage {
  height: 100px;
  width: 100px;
  object-fit: contain;
  float: left;
  margin-right: 10px;
  border: 1px solid lightgrey;
  border-radius: 5px;
}

.reviewImage {
  float: right;
  margin-left: 15px;
  border-radius: 5px;
  /*max-height: 100px;*/
  object-fit: cover;
  width: 100px;
  height: 100px;
}

#araReviews > div > div {
  border: 1px solid lightgrey;
  border-radius: 5px;
  padding: 10px;
  margin: 10px 0px;
  background-color: #f8f8f8;
  overflow: auto;
}

.new {
  background-color: #F2FFF2 !important;
}

.latest {
  background-color: #EDFDFF !important;
}

.disabled {
  pointer-events: none;
  cursor: not-allowed !important;
  color: gray !important;
  background: lightgrey !important;
}

.ara-toggle-container {
  display: flex;
  align-items: center;
  flex-direction: column;
}

.ara-toggle-label {
  line-height: 14px;
}

.ara-toggle-switch {
  position: relative;
  display: inline-block;
  width: 30px;
  height: 17px;
}

.ara-toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 34px;
}

.ara-toggle-slider:before {
  position: absolute;
  content: "";
  height: 13px;
  width: 13px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .ara-toggle-slider {
  background-color: #2196F3;
}

input:checked + .ara-toggle-slider:before {
  transform: translateX(13px);
}

.ara-input {
  display: none;
}

.shortText {
  max-width: 800px;
}

.emojiLink {
  cursor: pointer;
  text-decoration: none !important;
}

.emojiLink:hover {
  filter: brightness(110%);
}

/* Removed .stats styles as per user request */

.shop-influencer-profile-section {
  margin-top: 8px !important;
}

/* Styles for the Info Box */
.info-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.info-box {
  background-color: #fff;
  width: 500px; /* Updated width to 500px */
  max-width: 90%;
  border-radius: 10px;
  position: relative;
  display: flex;
  padding: 20px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}

.close-button {
  position: absolute;
  top: 10px;
  right: 15px;
  font-size: 24px;
  font-weight: bold;
  cursor: pointer;
}

.close-button:hover {
  color: red;
}

.info-content {
  display: flex;
  align-items: center; /* Vertically center the content */
}

.info-emoji {
  font-size: 60px;
  margin-right: 20px;
}

.info-details {
  flex: 1;
}

.info-details h2 {
  margin-top: 0;
  margin-bottom: 10px;
}

.info-details p {
  margin: 5px 0;
}
`;
document.head.appendChild(style);
