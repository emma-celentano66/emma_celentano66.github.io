const PAGES_TURNED_STORAGE_KEY = "turningPagesBookshelf";
const REVIEW_STORAGE_KEY = "turning-pages-reviews";
const NO_COVER_SRC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect fill='%239B7A5C' width='200' height='300'/%3E%3Ctext x='100' y='145' font-family='Arial' font-size='14' fill='%23FFF6E8' text-anchor='middle'%3ENo Cover%3C/text%3E%3C/svg%3E";

const shelfContainer = document.getElementById("pages-turned-shelf");
const shelfStatus = document.getElementById("pages-turned-status");
const reviewModal = document.getElementById("shelf-review-modal");
const reviewModalBody = document.getElementById("shelf-review-body");
const reviewModalClose = document.getElementById("shelf-review-close");

function getStoredBooks() {
    try {
        const raw = localStorage.getItem(PAGES_TURNED_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function safeText(value, fallback = "Not available") {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }
    return String(value);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeForComparison(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getStoredReviews() {
    try {
        const raw = localStorage.getItem(REVIEW_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function ratingToStars(rating) {
    const value = Number(rating || 0);
    if (!value) {
        return "No rating";
    }

    let stars = "";
    for (let index = 1; index <= 5; index += 1) {
        if (value >= index) {
            stars += "★";
        } else if (value >= index - 0.5) {
            stars += "☆";
        } else {
            stars += "✩";
        }
    }
    return `${stars} (${value.toFixed(1)}/5)`;
}

function findMatchingReview(book) {
    const allReviews = getStoredReviews();
    if (!allReviews.length) {
        return null;
    }

    const bookTitle = normalizeForComparison(book.title);
    const bookAuthor = normalizeForComparison(book.author);
    const bookAuthorParts = bookAuthor.split(" ").filter(Boolean);

    const titleMatches = allReviews
        .slice()
        .reverse()
        .filter((review) => normalizeForComparison(review.title) === bookTitle);

    if (!titleMatches.length) {
        return null;
    }

    const strictAuthorMatch = titleMatches.find((review) => {
        const reviewAuthor = normalizeForComparison(review.author);
        if (!bookAuthor || !reviewAuthor) {
            return false;
        }

        return (
            bookAuthor.includes(reviewAuthor) ||
            reviewAuthor.includes(bookAuthor) ||
            bookAuthorParts.some((part) => part.length > 2 && reviewAuthor.includes(part))
        );
    });

    return strictAuthorMatch || titleMatches[0];
}

function reviewLinkForBook(book) {
    const params = new URLSearchParams({
        title: safeText(book.title, ""),
        author: safeText(book.author, ""),
        cover: safeText(book.cover, "")
    });
    return `reviews.html?${params.toString()}`;
}

function deleteBookFromShelf(bookId) {
    if (!confirm("Remove this book from your shelf?")) return;
    const stored = getStoredBooks().filter((b) => b.id !== bookId);
    localStorage.setItem(PAGES_TURNED_STORAGE_KEY, JSON.stringify(stored));
    closeReviewModal();
    renderShelf();
}

function openReviewModal(book) {
    if (!reviewModal || !reviewModalBody) {
        return;
    }

    const review = findMatchingReview(book);
    const safeTitle = escapeHtml(safeText(book.title, "Untitled"));
    const safeAuthor = escapeHtml(safeText(book.author, "Unknown Author"));
    const safeCover = escapeHtml(safeText(book.cover, NO_COVER_SRC));

    if (!review) {
        reviewModalBody.innerHTML = `
            <article class="shelf-review-detail">
                <img src="${safeCover}" alt="Cover of ${safeTitle}" class="detail-cover" onerror="this.src='${NO_COVER_SRC}'">
                <div>
                    <h2 id="shelf-review-title">${safeTitle}</h2>
                    <p class="shelf-review-author">${safeAuthor}</p>
                    <p>No saved review yet for this book.</p>
                    <a class="review-link-button" href="${reviewLinkForBook(book)}">Write a Review</a>
                    <button class="review-delete-btn modal-delete-btn" type="button">Remove from Shelf</button>
                </div>
            </article>
        `;
    } else {
        const safeReviewAuthor = escapeHtml(safeText(review.author, "Unknown Author"));
        const safeReviewText = escapeHtml(safeText(review.text, "No review text."));
        const safeReviewDate = escapeHtml(safeText(review.date, ""));
        const safeStars = escapeHtml(ratingToStars(review.rating));

        reviewModalBody.innerHTML = `
            <article class="shelf-review-detail">
                <img src="${safeCover}" alt="Cover of ${safeTitle}" class="detail-cover" onerror="this.src='${NO_COVER_SRC}'">
                <div>
                    <h2 id="shelf-review-title">${safeTitle}</h2>
                    <p class="shelf-review-author">${safeReviewAuthor}</p>
                    <p class="shelf-review-rating">${safeStars}</p>
                    <p class="shelf-review-text">${safeReviewText}</p>
                    <p class="shelf-review-date">${safeReviewDate}</p>
                    <a class="review-link-button" href="${reviewLinkForBook(book)}">Edit in Reviews</a>
                    <button class="review-delete-btn modal-delete-btn" type="button">Remove from Shelf</button>
                </div>
            </article>
        `;
    }

    const deleteBtn = reviewModalBody.querySelector(".modal-delete-btn");
    if (deleteBtn) {
        deleteBtn.addEventListener("click", () => deleteBookFromShelf(book.id));
    }

    reviewModal.classList.add("open");
    reviewModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeReviewModal() {
    if (!reviewModal) {
        return;
    }
    reviewModal.classList.remove("open");
    reviewModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

function createShelfCard(book) {
    const card = document.createElement("article");
    card.className = "shelf-book-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `View your review for ${safeText(book.title, "this book")}`);

    const cover = document.createElement("img");
    cover.className = "shelf-book-cover";
    cover.src = safeText(book.cover, NO_COVER_SRC);
    cover.alt = `Cover of ${safeText(book.title, "Untitled")}`;
    cover.loading = "lazy";
    cover.onerror = function() {
        this.src = NO_COVER_SRC;
    };

    const title = document.createElement("h3");
    title.textContent = safeText(book.title, "Untitled");

    const author = document.createElement("p");
    author.className = "shelf-book-author";
    author.textContent = `Author: ${safeText(book.author, "Unknown Author")}`;

    const year = document.createElement("p");
    year.className = "shelf-book-year";
    year.textContent = `First published: ${safeText(book.publishYear)}`;

    card.addEventListener("click", () => openReviewModal(book));
    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openReviewModal(book);
        }
    });

    card.append(cover, title, author, year);
    return card;
}

function renderShelf() {
    if (!shelfContainer || !shelfStatus) {
        return;
    }

    const books = getStoredBooks();
    shelfContainer.innerHTML = "";

    if (!books.length) {
        shelfStatus.textContent = "Your bookshelf is empty. Add books from Discover.";
        return;
    }

    const fragment = document.createDocumentFragment();
    books.forEach((book) => {
        fragment.appendChild(createShelfCard(book));
    });

    shelfContainer.appendChild(fragment);
    shelfStatus.textContent = `Showing ${books.length} saved book${books.length === 1 ? "" : "s"}.`;
}

renderShelf();

if (reviewModalClose) {
    reviewModalClose.addEventListener("click", closeReviewModal);
}

if (reviewModal) {
    reviewModal.addEventListener("click", (event) => {
        if (event.target === reviewModal) {
            closeReviewModal();
        }
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && reviewModal && reviewModal.classList.contains("open")) {
        closeReviewModal();
    }
});

const TBR_STORAGE_KEY = "turningPagesTBR";

const tbrContainer = document.getElementById("tbr-shelf");
const tbrStatus = document.getElementById("tbr-status");
const tbrModal = document.getElementById("tbr-modal");
const tbrModalBody = document.getElementById("tbr-modal-body");
const tbrModalClose = document.getElementById("tbr-modal-close");

function getStoredTBRBooks() {
    try {
        const raw = localStorage.getItem(TBR_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function deleteTBRBook(bookId) {
    if (!confirm("Remove this book from your TBR list?")) return;
    const stored = getStoredTBRBooks().filter((b) => b.id !== bookId);
    localStorage.setItem(TBR_STORAGE_KEY, JSON.stringify(stored));
    closeTBRModal();
    renderTBR();
}

function moveToPagesTurned(book) {
    // Add to Pages Turned shelf
    const shelf = getStoredBooks();
    const existingIndex = shelf.findIndex((b) => b.id === book.id);
    const shelfBook = { ...book, addedAt: new Date().toISOString() };
    if (existingIndex >= 0) shelf.splice(existingIndex, 1);
    shelf.unshift(shelfBook);
    localStorage.setItem(PAGES_TURNED_STORAGE_KEY, JSON.stringify(shelf));

    // Remove from TBR
    const tbr = getStoredTBRBooks().filter((b) => b.id !== book.id);
    localStorage.setItem(TBR_STORAGE_KEY, JSON.stringify(tbr));

    closeTBRModal();
    renderShelf();
    renderTBR();
}

function openTBRModal(book) {
    if (!tbrModal || !tbrModalBody) return;

    const safeTitle = escapeHtml(safeText(book.title, "Untitled"));
    const safeAuthor = escapeHtml(safeText(book.author, "Unknown Author"));
    const safeCover = escapeHtml(safeText(book.cover, NO_COVER_SRC));

    tbrModalBody.innerHTML = `
        <article class="shelf-review-detail">
            <img src="${safeCover}" alt="Cover of ${safeTitle}" class="detail-cover" onerror="this.src='${NO_COVER_SRC}'">
            <div>
                <h2 id="tbr-modal-title">${safeTitle}</h2>
                <p class="shelf-review-author">${safeAuthor}</p>
                <p class="shelf-book-year">First published: ${escapeHtml(safeText(book.publishYear))}</p>
                <button class="review-link-button move-to-shelf-btn" type="button">Move to Pages Turned</button>
                <button class="modal-delete-btn tbr-delete-btn" type="button">Remove from TBR</button>
            </div>
        </article>
    `;

    tbrModalBody.querySelector(".tbr-delete-btn").addEventListener("click", () => deleteTBRBook(book.id));
    tbrModalBody.querySelector(".move-to-shelf-btn").addEventListener("click", () => moveToPagesTurned(book));

    tbrModal.classList.add("open");
    tbrModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeTBRModal() {
    if (!tbrModal) return;
    tbrModal.classList.remove("open");
    tbrModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

function createTBRCard(book) {
    const card = document.createElement("article");
    card.className = "shelf-book-card tbr-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `View TBR details for ${safeText(book.title, "this book")}`);

    const cover = document.createElement("img");
    cover.className = "shelf-book-cover";
    cover.src = safeText(book.cover, NO_COVER_SRC);
    cover.alt = `Cover of ${safeText(book.title, "Untitled")}`;
    cover.loading = "lazy";
    cover.onerror = function () { this.src = NO_COVER_SRC; };

    const title = document.createElement("h3");
    title.textContent = safeText(book.title, "Untitled");

    const author = document.createElement("p");
    author.className = "shelf-book-author";
    author.textContent = `Author: ${safeText(book.author, "Unknown Author")}`;

    const year = document.createElement("p");
    year.className = "shelf-book-year";
    year.textContent = `First published: ${safeText(book.publishYear)}`;

    card.addEventListener("click", () => openTBRModal(book));
    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openTBRModal(book);
        }
    });

    card.append(cover, title, author, year);
    return card;
}

function renderTBR() {
    if (!tbrContainer || !tbrStatus) return;

    const books = getStoredTBRBooks();
    tbrContainer.innerHTML = "";

    if (!books.length) {
        tbrStatus.textContent = "Your TBR list is empty. Add books from Discover.";
        return;
    }

    const fragment = document.createDocumentFragment();
    books.forEach((book) => fragment.appendChild(createTBRCard(book)));
    tbrContainer.appendChild(fragment);
    tbrStatus.textContent = `Showing ${books.length} book${books.length === 1 ? "" : "s"} to be read.`;
}

renderTBR();

if (tbrModalClose) {
    tbrModalClose.addEventListener("click", closeTBRModal);
}

if (tbrModal) {
    tbrModal.addEventListener("click", (event) => {
        if (event.target === tbrModal) closeTBRModal();
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && tbrModal && tbrModal.classList.contains("open")) {
        closeTBRModal();
    }
});
