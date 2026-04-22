const searchForm = document.getElementById("book-search-form");
const searchInput = document.getElementById("book-search-input");
const genreInput = document.getElementById("book-genre-input");
const searchStatus = document.getElementById("search-status");
const resultsContainer = document.getElementById("book-results");
const topBooksStatus = document.getElementById("top-books-status");
const topBooksContainer = document.getElementById("top-books-results");
const refreshTopBooksButton = document.getElementById("refresh-top-books");

const modal = document.getElementById("book-modal");
const modalBody = document.getElementById("modal-body");
const modalCloseBtn = document.getElementById("modal-close");

const SEARCH_LIMIT = 24;
const TOP_BOOKS_LIMIT = 10;
const GOOGLE_SEARCH_LIMIT = 40;
const NO_COVER_SRC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect fill='%239B7A5C' width='200' height='300'/%3E%3Ctext x='100' y='145' font-family='Arial' font-size='14' fill='%23FFF6E8' text-anchor='middle'%3ENo Cover%3C/text%3E%3C/svg%3E";
let modalRequestId = 0;

function beginLoad(message) {
    if (window.SiteLoader && typeof window.SiteLoader.begin === "function") {
        window.SiteLoader.begin(message);
    }
}

function endLoad() {
    if (window.SiteLoader && typeof window.SiteLoader.end === "function") {
        window.SiteLoader.end();
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

function setStatus(message) {
    searchStatus.textContent = message;
}

function createBookCard(doc) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "book-card";
    button.dataset.key = doc.key || "";

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

    button.append(cover, title, author, year);
    button.addEventListener("click", () => openBookModal(doc));

    return button;
}

function renderCards(docs) {
    clearResults();

    if (!docs.length) {
        setStatus("No books found. Try a different search term.");
        return;
    }

    const fragment = document.createDocumentFragment();
    docs.forEach((doc) => {
        fragment.appendChild(createBookCard(doc));
    });

    resultsContainer.appendChild(fragment);
    setStatus(`Showing ${docs.length} result${docs.length === 1 ? "" : "s"}.`);
}

function setTopBooksStatus(message) {
    if (topBooksStatus) {
        topBooksStatus.textContent = message;
    }
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

function normalizeGoogleBookItem(item) {
    const volumeInfo = item.volumeInfo || {};
    const saleInfo = item.saleInfo || {};
    const accessInfo = item.accessInfo || {};
    const matchedYear = String(volumeInfo.publishedDate || "").match(/\d{4}/);
    const imageLinks = volumeInfo.imageLinks || {};
    const industryIdentifiers = Array.isArray(volumeInfo.industryIdentifiers)
        ? volumeInfo.industryIdentifiers
        : [];
    const isbnValues = industryIdentifiers.map((entry) => entry.identifier).filter(Boolean);

    const rawCover = imageLinks.thumbnail || imageLinks.smallThumbnail || "";
    const secureCover = rawCover.startsWith("http://") ? rawCover.replace("http://", "https://") : rawCover;

    return {
        source: "google",
        key: `/google/${item.id || ""}`,
        googleVolumeId: item.id || "",
        title: volumeInfo.title || "Untitled",
        author_name: Array.isArray(volumeInfo.authors) ? volumeInfo.authors : [],
        first_publish_year: matchedYear ? Number(matchedYear[0]) : "Not available",
        first_publish_date: volumeInfo.publishedDate || "",
        edition_count: volumeInfo.pageCount || "Not available",
        language: volumeInfo.language ? [volumeInfo.language] : [],
        publisher: volumeInfo.publisher ? [volumeInfo.publisher] : [],
        isbn: isbnValues,
        subject: Array.isArray(volumeInfo.categories) ? volumeInfo.categories : [],
        description: volumeInfo.description || "",
        cover_url: secureCover,
        average_rating: typeof volumeInfo.averageRating === "number" ? volumeInfo.averageRating : 0,
        ratings_count: typeof volumeInfo.ratingsCount === "number" ? volumeInfo.ratingsCount : 0,
        preview_link: volumeInfo.previewLink || "",
        info_link: volumeInfo.infoLink || "",
        page_count: typeof volumeInfo.pageCount === "number" ? volumeInfo.pageCount : 0,
        saleability: saleInfo.saleability || "",
        viewability: accessInfo.viewability || ""
    };
}

function getGoogleBookQualityScore(book) {
    const publishYear = getPublishYear(book) || 0;
    const recencyScore = Math.max(0, publishYear - 2000);
    const ratingSignal = Math.min(book.ratings_count || 0, 500);
    const averageRatingScore = Math.round((book.average_rating || 0) * 12);

    let score = 0;

    if (book.cover_url) {
        score += 120;
    }
    if (book.description) {
        score += 35;
    }
    if (book.publisher && book.publisher.length) {
        score += 20;
    }
    if (book.author_name && book.author_name.length) {
        score += 15;
    }
    if (book.subject && book.subject.length) {
        score += 12;
    }
    if (book.preview_link) {
        score += 10;
    }
    if (book.page_count >= 120) {
        score += 8;
    }
    if (book.viewability && book.viewability !== "NO_PAGES") {
        score += 8;
    }
    if (book.saleability && book.saleability !== "NOT_FOR_SALE") {
        score += 4;
    }

    score += recencyScore;
    score += averageRatingScore;
    score += Math.min(40, Math.round(ratingSignal / 10));

    return score;
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

async function fetchGoogleSearchResults(query, genre) {
    const queryParts = [];

    if (query) {
        queryParts.push(`(${query})`);
    }

    if (genre) {
        queryParts.push(`subject:${genre}`);
    }

    if (!queryParts.length) {
        return [];
    }

    const params = new URLSearchParams({
        q: queryParts.join(" "),
        maxResults: String(GOOGLE_SEARCH_LIMIT),
        orderBy: "newest",
        printType: "books",
        projection: "full",
        langRestrict: "en"
    });

    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`);

    if (!response.ok) {
        throw new Error("Google search failed");
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];

    const books = items
        .map(normalizeGoogleBookItem);

    return books
        .sort((left, right) => getGoogleBookQualityScore(right) - getGoogleBookQualityScore(left))
        .slice(0, SEARCH_LIMIT);
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

async function fetchGoogleTopBooks() {
    try {
        // Search for recent releases across multiple genres to get variety
        const genres = ["romance", "mystery", "sci-fi", "fantasy", "thriller"];
        const allBooks = [];

        for (const genre of genres) {
            const params = new URLSearchParams({
                q: `${genre}`,
                maxResults: "8",
                orderBy: "newest",
                printType: "books"
            });

            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`);

            if (response.ok) {
                const data = await response.json();
                const items = Array.isArray(data.items) ? data.items : [];
                items.forEach(item => {
                    allBooks.push(normalizeGoogleBookItem(item));
                });
            }
        }

        // Remove duplicates and return top 10
        const uniqueBooks = [];
        const seenIds = new Set();
        
        for (const book of allBooks) {
            if (!seenIds.has(book.googleVolumeId)) {
                uniqueBooks.push(book);
                seenIds.add(book.googleVolumeId);
                if (uniqueBooks.length >= TOP_BOOKS_LIMIT) break;
            }
        }

        return uniqueBooks.slice(0, TOP_BOOKS_LIMIT);
    } catch (error) {
        return [];
    }
}

async function fetchTopBooks() {
    if (!topBooksContainer) {
        return;
    }

    topBooksContainer.innerHTML = "";
    setTopBooksStatus("Loading top books...");

    beginLoad("Loading top books...");

    try {
        // Try Google Books first
        let books = await fetchGoogleTopBooks();
        let usedSource = "google";

        // Fall back to Open Library trending if Google has no results
        if (!books.length) {
            const trendingResponse = await fetch(
                `https://openlibrary.org/trending/daily.json?limit=${TOP_BOOKS_LIMIT}`
            );

            if (trendingResponse.ok) {
                const trendingData = await trendingResponse.json();
                books = Array.isArray(trendingData.works)
                    ? trendingData.works.slice(0, TOP_BOOKS_LIMIT).map(normalizeTrendingWork)
                    : [];
                usedSource = "openlibrary-trending";
            }
        }

        // Fall back to Open Library bestseller search if still no results
        if (!books.length) {
            const fallbackResponse = await fetch(
                `https://openlibrary.org/search.json?q=bestseller&limit=${TOP_BOOKS_LIMIT}`
            );

            if (!fallbackResponse.ok) {
                throw new Error("Top books failed");
            }

            const fallbackData = await fallbackResponse.json();
            const fallbackDocs = Array.isArray(fallbackData.docs) ? fallbackData.docs : [];
            books = fallbackDocs.slice(0, TOP_BOOKS_LIMIT).map(normalizeOpenLibraryDoc);
            usedSource = "openlibrary-bestseller";
        }

        if (!books.length) {
            setTopBooksStatus("No top books available right now.");
            return;
        }

        const fragment = document.createDocumentFragment();
        books.forEach((book) => {
            fragment.appendChild(createBookCard(book));
        });
        topBooksContainer.appendChild(fragment);

        if (usedSource === "google") {
            setTopBooksStatus("Showing the current Top 10 from Google Books bestsellers.");
        } else if (usedSource === "openlibrary-trending") {
            setTopBooksStatus("Showing the current Top 10 from Open Library trending data.");
        } else {
            setTopBooksStatus("Showing a bestseller-style list from Open Library.");
        }
    } catch (error) {
        setTopBooksStatus("Could not load top books right now. Please try again shortly.");
    } finally {
        endLoad();
    }
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
                <a class="review-link-button" href="${reviewLink}">Leave a Review</a>
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

async function getGoogleVolumeDetails(volumeId) {
    if (!volumeId) {
        return null;
    }

    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(volumeId)}`);
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
        if (doc.source === "google") {
            const volumeDetails = await getGoogleVolumeDetails(doc.googleVolumeId);

            if (requestId !== modalRequestId || !modal.classList.contains("open")) {
                return;
            }

            const volumeInfo = volumeDetails?.volumeInfo || {};
            const description = volumeInfo.description || doc.description || "No description available.";
            const subjectList = Array.isArray(volumeInfo.categories)
                ? volumeInfo.categories.slice(0, 12)
                : asArray(doc.subject).slice(0, 12);

            const detailDoc = {
                ...doc,
                publisher: volumeInfo.publisher ? [volumeInfo.publisher] : doc.publisher,
                language: volumeInfo.language ? [volumeInfo.language] : doc.language,
                subject: subjectList
            };

            renderModalContent(detailDoc, description, subjectList);
            return;
        }

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
