const searchForm = document.getElementById("book-search-form");
const searchInput = document.getElementById("book-search-input");
const genreInput = document.getElementById("book-genre-input");
const sortInput = document.getElementById("book-sort-input");
const searchStatus = document.getElementById("search-status");
const resultsContainer = document.getElementById("book-results");
const modal = document.getElementById("book-modal");
const modalBody = document.getElementById("modal-body");
const modalCloseBtn = document.getElementById("modal-close");

const SEARCH_LIMIT = 24;
const NO_COVER_SRC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect fill='%239B7A5C' width='200' height='300'/%3E%3Ctext x='100' y='145' font-family='Arial' font-size='14' fill='%23FFF6E8' text-anchor='middle'%3ENo Cover%3C/text%3E%3C/svg%3E";
const PAGES_TURNED_STORAGE_KEY = "turningPagesBookshelf";
const TBR_STORAGE_KEY = "turningPagesTBR";
let modalRequestId = 0;
let latestResults = [];
let pendingRedirectTimer = 0;

function beginLoad(message) {
    if (typeof SiteLoader !== "undefined" && typeof SiteLoader.begin === "function") {
        SiteLoader.begin(message);
    }
}

function endLoad() {
    if (typeof SiteLoader !== "undefined" && typeof SiteLoader.end === "function") {
        SiteLoader.end();
    }
}

function showToast(message) {
    if (typeof SiteToast !== "undefined" && typeof SiteToast.show === "function") {
        SiteToast.show(message);
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function asArray(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (value === undefined || value === null || value === "") {
        return [];
    }
    return [value];
}

function sanitizeText(value) {
    if (value === undefined || value === null || value === "") {
        return "Not available";
    }
    if (Array.isArray(value)) {
        return value.length ? value.join(", ") : "Not available";
    }
    return String(value);
}

function coverUrlFromDoc(doc, size = "L") {
    if (doc.cover_url && doc.cover_url.trim()) {
        return doc.cover_url;
    }

    if (doc.cover_i) {
        return `https://covers.openlibrary.org/b/id/${doc.cover_i}-${size}.jpg`;
    }

    if (doc.isbn && Array.isArray(doc.isbn)) {
        const usableIsbn = doc.isbn.find((value) => value && String(value).trim());
        if (usableIsbn) {
            return `https://covers.openlibrary.org/b/isbn/${usableIsbn}-${size}.jpg`;
        }
    }

    return NO_COVER_SRC;
}

function clearResults() {
    resultsContainer.innerHTML = "";
}

function getStoredPagesTurnedBooks() {
    try {
        const raw = localStorage.getItem(PAGES_TURNED_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function getStoredTBRBooks() {
    try {
        const raw = localStorage.getItem(TBR_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function normalizeBookId(doc) {
    if (doc.key) {
        return `openlibrary:${doc.key}`;
    }

    const title = String(doc.title || "untitled").toLowerCase().trim();
    const author = String(asArray(doc.author_name)[0] || "unknown").toLowerCase().trim();
    return `fallback:${title}::${author}`;
}

function saveBookToPagesTurned(doc) {
    const stored = getStoredPagesTurnedBooks();
    const bookId = normalizeBookId(doc);
    const alreadyExists = stored.some((book) => book.id === bookId);

    if (alreadyExists) {
        return false;
    }

    const shelfBook = {
        id: bookId,
        title: sanitizeText(doc.title),
        author: sanitizeText(asArray(doc.author_name).join(", ")),
        publishYear: sanitizeText(getPublishYear(doc) || doc.first_publish_year),
        cover: coverUrlFromDoc(doc, "M"),
        addedAt: new Date().toISOString()
    };

    stored.unshift(shelfBook);
    localStorage.setItem(PAGES_TURNED_STORAGE_KEY, JSON.stringify(stored));
    return true;
}

function addToPagesTurnedAndRedirect(doc) {
    const wasAdded = saveBookToPagesTurned(doc);

    if (!wasAdded) {
        showToast("Already in Pages Turned");
        window.clearTimeout(pendingRedirectTimer);
        return;
    }

    showToast("Added to Pages Turned");
    window.clearTimeout(pendingRedirectTimer);
    pendingRedirectTimer = window.setTimeout(() => {
        window.location.href = "pagesTurned.html";
    }, 550);
}

function saveBookToTBR(doc) {
    const stored = getStoredTBRBooks();
    const bookId = normalizeBookId(doc);
    const alreadyExists = stored.some((book) => book.id === bookId);

    if (alreadyExists) {
        return false;
    }

    const tbrBook = {
        id: bookId,
        title: sanitizeText(doc.title),
        author: sanitizeText(asArray(doc.author_name).join(", ")),
        publishYear: sanitizeText(getPublishYear(doc) || doc.first_publish_year),
        cover: coverUrlFromDoc(doc, "M"),
        addedAt: new Date().toISOString()
    };

    stored.unshift(tbrBook);
    localStorage.setItem(TBR_STORAGE_KEY, JSON.stringify(stored));
    return true;
}

function addToTBRAndRedirect(doc) {
    const wasAdded = saveBookToTBR(doc);

    if (!wasAdded) {
        showToast("Already in TBR");
        window.clearTimeout(pendingRedirectTimer);
        return;
    }

    showToast("Added to TBR");
    window.clearTimeout(pendingRedirectTimer);
    pendingRedirectTimer = window.setTimeout(() => {
        window.location.href = "pagesTurned.html";
    }, 550);
}

function setStatus(message) {
    searchStatus.textContent = message;
}

function getYearForSort(book) {
    const year = getPublishYear(book);
    return Number.isFinite(year) ? year : null;
}

function sortBooks(books) {
    const mode = sortInput ? sortInput.value : "relevance";
    if (mode === "newest") {
        return books.slice().sort((a, b) => (getYearForSort(b) || -Infinity) - (getYearForSort(a) || -Infinity));
    }
    if (mode === "oldest") {
        return books.slice().sort((a, b) => (getYearForSort(a) || Infinity) - (getYearForSort(b) || Infinity));
    }
    return books.slice();
}

function createBookCard(doc, index = 0) {
    const card = document.createElement("article");
    card.className = "book-card";
    card.dataset.key = doc.key || "";
    card.style.setProperty("--card-index", String(index));

    const cover = document.createElement("img");
    cover.src = coverUrlFromDoc(doc, "M");
    cover.alt = `Cover of ${sanitizeText(doc.title)}`;
    cover.loading = "lazy";
    cover.onerror = function() {
        this.src = NO_COVER_SRC;
    };

    const title = document.createElement("h3");
    title.textContent = sanitizeText(doc.title);

    const author = document.createElement("p");
    author.className = "card-author";
    author.textContent = `Author: ${sanitizeText(doc.author_name)}`;

    const year = document.createElement("p");
    year.className = "card-year";
    year.textContent = `First published: ${sanitizeText(doc.first_publish_year)}`;

    const actions = document.createElement("div");
    actions.className = "book-card-actions";

    const detailsButton = document.createElement("button");
    detailsButton.type = "button";
    detailsButton.className = "book-card-action";
    detailsButton.textContent = "View Details";
    detailsButton.addEventListener("click", () => openBookModal(doc));

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "book-card-action add-pages-turned-button";
    addButton.textContent = "Add to Pages Turned";
    addButton.addEventListener("click", () => addToPagesTurnedAndRedirect(doc));

    const tbrButton = document.createElement("button");
    tbrButton.type = "button";
    tbrButton.className = "book-card-action add-tbr-button";
    tbrButton.textContent = "Add to TBR";
    tbrButton.addEventListener("click", () => addToTBRAndRedirect(doc));

    actions.append(detailsButton, addButton, tbrButton);
    card.append(cover, title, author, year, actions);

    return card;
}

function renderCards(docs) {
    latestResults = docs.slice();
    clearResults();

    if (!docs.length) {
        setStatus("No books found. Try a different search term.");
        return;
    }

    const fragment = document.createDocumentFragment();
    const sortedDocs = sortBooks(docs);
    sortedDocs.forEach((doc, index) => {
        fragment.appendChild(createBookCard(doc, index));
    });

    resultsContainer.appendChild(fragment);
    setStatus(`Showing ${sortedDocs.length} result${sortedDocs.length === 1 ? "" : "s"}.`);
}

function normalizeTrendingWork(work) {
    return {
        source: "openlibrary",
        key: work.key || "",
        title: work.title || "Untitled",
        author_name: Array.isArray(work.author_name)
            ? work.author_name
            : Array.isArray(work.authors)
              ? work.authors.map((author) => author.name).filter(Boolean)
              : [],
        first_publish_year: work.first_publish_year || work.first_publish_date || "Not available",
        first_publish_date: work.first_publish_date || "",
        cover_i: work.cover_i || work.cover_id || null,
        subject: Array.isArray(work.subject) ? work.subject : [],
        language: [],
        publisher: [],
        isbn: [],
        edition_count: "Not available",
        description: ""
    };
}

function normalizeOpenLibraryDoc(doc) {
    return {
        source: "openlibrary",
        key: doc.key || "",
        title: doc.title || "Untitled",
        author_name: Array.isArray(doc.author_name) ? doc.author_name : [],
        first_publish_year: doc.first_publish_year || "Not available",
        first_publish_date: doc.first_publish_date || "",
        edition_count: doc.edition_count || "Not available",
        language: Array.isArray(doc.language) ? doc.language : [],
        publisher: Array.isArray(doc.publisher) ? doc.publisher : [],
        isbn: Array.isArray(doc.isbn) ? doc.isbn : [],
        subject: Array.isArray(doc.subject) ? doc.subject : [],
        cover_i: doc.cover_i || null,
        description: "",
        has_fulltext: Boolean(doc.has_fulltext),
        ebook_access: doc.ebook_access || ""
    };
}

function getPublishYear(book) {
    if (typeof book.first_publish_year === "number") {
        return book.first_publish_year;
    }

    const fromDate = String(book.first_publish_date || "").match(/\d{4}/);
    if (fromDate) {
        return Number(fromDate[0]);
    }

    return null;
}

function normalizeForComparison(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getOpenLibraryResultScore(book, query) {
    const normalizedQuery = normalizeForComparison(query);
    const normalizedTitle = normalizeForComparison(book.title);
    const normalizedAuthors = asArray(book.author_name)
        .map(normalizeForComparison)
        .join(" ");
    const normalizedSubjects = asArray(book.subject)
        .map(normalizeForComparison)
        .join(" ");

    let score = 0;

    if (normalizedQuery) {
        if (normalizedTitle === normalizedQuery) {
            score += 500;
        } else if (normalizedTitle.startsWith(normalizedQuery)) {
            score += 300;
        } else if (normalizedTitle.includes(normalizedQuery)) {
            score += 180;
        }

        if (normalizedAuthors.includes(normalizedQuery)) {
            score += 170;
        }

        if (normalizedSubjects.includes(normalizedQuery)) {
            score += 50;
        }
    }

    if (book.cover_i) {
        score += 40;
    }
    if (book.has_fulltext) {
        score += 20;
    }
    if (book.ebook_access && book.ebook_access !== "no_ebook") {
        score += 10;
    }
    if (typeof book.edition_count === "number") {
        score += Math.min(book.edition_count, 25);
    }

    const publishYear = getPublishYear(book);
    if (publishYear) {
        score += Math.max(0, 20 - Math.abs(publishYear - 2000) / 5);
    }

    return score;
}

function genreToSubjectSlug(genre) {
    return genre
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "_");
}

async function fetchSearchResults(query, genre) {
    return fetchOpenLibrarySearchResults(query, genre);
}

async function fetchOpenLibrarySearchResults(query, genre) {
    if (query) {
        const requestSets = [
            { title: query, limit: "20" },
            { author: query, limit: "20" },
            { q: query, limit: "30" }
        ];

        const responses = await Promise.all(
            requestSets.map(async (baseParams) => {
                const params = new URLSearchParams(baseParams);

                if (genre) {
                    params.set("subject", genre);
                }

                const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
                if (!response.ok) {
                    return [];
                }

                const data = await response.json();
                return Array.isArray(data.docs) ? data.docs : [];
            })
        );

        const uniqueBooks = new Map();

        responses.flat().forEach((doc) => {
            const normalized = normalizeOpenLibraryDoc(doc);

            if (!normalized.key) {
                return;
            }

            const existing = uniqueBooks.get(normalized.key);
            if (!existing || getOpenLibraryResultScore(normalized, query) > getOpenLibraryResultScore(existing, query)) {
                uniqueBooks.set(normalized.key, normalized);
            }
        });

        return Array.from(uniqueBooks.values())
            .sort((left, right) => getOpenLibraryResultScore(right, query) - getOpenLibraryResultScore(left, query))
            .slice(0, SEARCH_LIMIT);
    }

    const subjectSlug = genreToSubjectSlug(genre);
    const response = await fetch(
        `https://openlibrary.org/subjects/${encodeURIComponent(subjectSlug)}.json?limit=60`
    );

    if (!response.ok) {
        throw new Error("Genre search failed");
    }

    const data = await response.json();
    const works = Array.isArray(data.works) ? data.works : [];

    return works
        .map(normalizeTrendingWork)
        .sort((a, b) => (getPublishYear(b) || 0) - (getPublishYear(a) || 0))
        .slice(0, SEARCH_LIMIT);
}

function detailItem(label, value) {
    return `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(sanitizeText(value))}</li>`;
}

function reviewLinkForDoc(doc) {
    const params = new URLSearchParams({
        title: sanitizeText(doc.title),
        author: sanitizeText(asArray(doc.author_name).slice(0, 1)[0] || ""),
        cover: coverUrlFromDoc(doc, "M")
    });
    return `reviews.html?${params.toString()}`;
}

function renderModalContent(doc, description, subjectList) {
    const safeTitle = escapeHtml(sanitizeText(doc.title));
    const safeDescription = escapeHtml(sanitizeText(description));
    const safeSubjects = subjectList.length ? subjectList.join(", ") : "Not available";
    const reviewLink = reviewLinkForDoc(doc);
    const coverUrl = coverUrlFromDoc(doc, "L");

    modalBody.innerHTML = `
        <article class="book-detail">
            <img src="${coverUrl}" alt="Cover of ${safeTitle}" class="detail-cover">
            <div>
                <h2 id="modal-title">${safeTitle}</h2>
                <p>${safeDescription}</p>
                <ul class="detail-list">
                    ${detailItem("Author(s)", doc.author_name)}
                    ${detailItem("First publish year", doc.first_publish_year)}
                    ${detailItem("Edition count", doc.edition_count)}
                    ${detailItem("Language(s)", asArray(doc.language).slice(0, 6))}
                    ${detailItem("Publisher(s)", asArray(doc.publisher).slice(0, 6))}
                    ${detailItem("ISBN(s)", asArray(doc.isbn).slice(0, 5))}
                    ${detailItem("Subjects", safeSubjects)}
                </ul>
                <div class="discover-modal-actions">
                    <button class="review-link-button add-pages-turned-button modal-add-pages-turned" type="button">Add to Pages Turned</button>
                    <button class="review-link-button add-tbr-button modal-add-tbr" type="button">Add to TBR</button>
                    <a class="review-link-button" href="${reviewLink}">Leave a Review</a>
                </div>
            </div>
        </article>
    `;

    // Add onerror handler to modal cover image
    const modalCoverImg = modalBody.querySelector(".detail-cover");
    if (modalCoverImg) {
        modalCoverImg.onerror = function() {
            this.src = NO_COVER_SRC;
        };
    }

    const addToPagesTurnedButton = modalBody.querySelector(".modal-add-pages-turned");
    if (addToPagesTurnedButton) {
        addToPagesTurnedButton.addEventListener("click", () => addToPagesTurnedAndRedirect(doc));
    }

    const addToTBRButton = modalBody.querySelector(".modal-add-tbr");
    if (addToTBRButton) {
        addToTBRButton.addEventListener("click", () => addToTBRAndRedirect(doc));
    }
}

async function getWorkDetails(workKey) {
    if (!workKey) {
        return null;
    }

    try {
        const response = await fetch(`https://openlibrary.org${workKey}.json`);
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch (error) {
        return null;
    }
}

async function openBookModal(doc) {
    const requestId = ++modalRequestId;
    const initialDescription = doc.description || "Loading description...";
    renderModalContent(doc, initialDescription, asArray(doc.subject).slice(0, 12));
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    beginLoad("Opening book details...");

    try {
        const workDetails = await getWorkDetails(doc.key);

        if (requestId !== modalRequestId || !modal.classList.contains("open")) {
            return;
        }

        const description =
            typeof workDetails?.description === "string"
                ? workDetails.description
                : workDetails?.description?.value || "No description available.";

        const workSubjects = Array.isArray(workDetails?.subjects) ? workDetails.subjects.slice(0, 12) : [];
        const docSubjects = asArray(doc.subject).slice(0, 12);
        const subjectList = workSubjects.length ? workSubjects : docSubjects;

        renderModalContent(doc, description, subjectList);
    } finally {
        endLoad();
    }
}

function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    const genre = genreInput ? genreInput.value.trim() : "";

    if (!query && !genre) {
        setStatus("Please enter a search term, choose a genre, or both.");
        clearResults();
        return;
    }

    if (query && genre) {
        setStatus(`Searching for \"${query}\" in ${genre}...`);
    } else if (genre) {
        setStatus(`Searching ${genre} books...`);
    } else {
        setStatus(`Searching for \"${query}\"...`);
    }

    clearResults();
    beginLoad("Searching books...");

    try {
        const books = await fetchSearchResults(query, genre);
        renderCards(books);
    } catch (error) {
        setStatus("Something went wrong while searching. Please try again.");
    } finally {
        endLoad();
    }
});

modalCloseBtn.addEventListener("click", closeModal);

modal.addEventListener("click", (event) => {
    if (event.target === modal) {
        closeModal();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("open")) {
        closeModal();
    }
});

if (sortInput) {
    sortInput.addEventListener("change", () => {
        if (latestResults.length) {
            renderCards(latestResults);
        }
    });
}
