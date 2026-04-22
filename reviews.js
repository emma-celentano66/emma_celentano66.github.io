const REVIEW_STORAGE_KEY = "turning-pages-reviews";
const NO_COVER_SRC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect fill='%238686AC' width='200' height='300'/%3E%3Ctext x='100' y='145' font-family='Arial' font-size='14' fill='%23F4F5FF' text-anchor='middle'%3ENo Cover%3C/text%3E%3C/svg%3E";

const reviewForm = document.getElementById("review-form");
const prefillNote = document.getElementById("review-prefill-note");
const savedReviewsContainer = document.getElementById("saved-reviews");

const reviewIdInput = document.getElementById("review-id");
const coverUrlInput = document.getElementById("review-cover-url");
const titleInput = document.getElementById("review-book-title");
const authorInput = document.getElementById("review-book-author");
const ratingInput = document.getElementById("review-rating");
const reviewInput = document.getElementById("review-text");
const starButtons = Array.from(document.querySelectorAll(".star-btn"));
const starRatingStatus = document.getElementById("star-rating-status");
const submitButton = document.getElementById("review-submit-btn");
const cancelEditButton = document.getElementById("review-cancel-edit-btn");

function normalizeRating(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0.5 || parsed > 5) {
        return "";
    }

    // Only allow half-star increments: 0.5, 1.0, 1.5, ... 5.0
    const halfStep = Math.round(parsed * 2) / 2;
    if (Math.abs(halfStep - parsed) > 0.001) {
        return "";
    }

    return String(halfStep);
}

function setStarRating(value) {
    const normalized = normalizeRating(value);
    ratingInput.value = normalized;

    const current = Number(normalized || 0);
    starButtons.forEach((button, index) => {
        const starIndex = index + 1;
        let fillType = "empty";

        if (current >= starIndex) {
            fillType = "full";
        } else if (current >= starIndex - 0.5) {
            fillType = "half";
        }

        const buttonValue = Number(button.dataset.value || 0);
        button.textContent = "★";
        button.classList.remove("star-full", "star-half", "star-empty");
        button.classList.add(`star-${fillType}`);
        button.setAttribute("aria-pressed", buttonValue <= current ? "true" : "false");
    });

    if (starRatingStatus) {
        starRatingStatus.textContent = current ? `${current.toFixed(1)} out of 5 stars selected` : "No rating selected";
    }
}

function renderStarsHtml(value, className = "saved-star") {
    const normalized = normalizeRating(value);
    const count = Number(normalized || 0);
    const stars = [];

    for (let index = 1; index <= 5; index += 1) {
        let fillType = "empty";
        if (count >= index) {
            fillType = "full";
        } else if (count >= index - 0.5) {
            fillType = "half";
        }

        stars.push(`<span class="${className} ${className}-${fillType}" aria-hidden="true">★</span>`);
    }

    return stars.join("");
}

function createReviewId() {
    return `review-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function sanitizeReviewRecord(review) {
    return {
        id: review.id || createReviewId(),
        title: String(review.title || "").trim(),
        author: String(review.author || "").trim(),
        rating: normalizeRating(review.rating),
        text: String(review.text || "").trim(),
        date: String(review.date || new Date().toLocaleDateString()),
        coverUrl: String(review.coverUrl || "")
    };
}

function readReviews() {
    try {
        const raw = localStorage.getItem(REVIEW_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) {
            return [];
        }

        const normalized = parsed.map(sanitizeReviewRecord);
        const needsWriteBack = normalized.some((item, index) => {
            const original = parsed[index];
            return !original || !original.id || original.coverUrl === undefined;
        });

        if (needsWriteBack) {
            writeReviews(normalized);
        }

        return normalized;
    } catch (error) {
        return [];
    }
}

function writeReviews(reviews) {
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews));
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderSavedReviews() {
    const reviews = readReviews();

    if (!reviews.length) {
        savedReviewsContainer.innerHTML = "<p>No reviews saved yet.</p>";
        return;
    }

    savedReviewsContainer.innerHTML = reviews
        .slice()
        .reverse()
        .map((review) => {
            return `
                <article class="saved-review-card" data-review-id="${escapeHtml(review.id)}">
                    <img class="saved-review-cover" src="${escapeHtml(review.coverUrl || NO_COVER_SRC)}" alt="Cover for ${escapeHtml(review.title || "book")}" onerror="this.src='${NO_COVER_SRC}'">
                    <div class="saved-review-content">
                        <h3>${escapeHtml(review.title)}</h3>
                        <p class="saved-review-meta">${escapeHtml(review.author)}</p>
                        <p class="saved-review-stars" aria-label="${escapeHtml(review.rating || "0")} out of 5 stars">${renderStarsHtml(review.rating)}</p>
                        <p>${escapeHtml(review.text)}</p>
                        <p class="saved-review-date">${escapeHtml(review.date)}</p>
                        <div class="saved-review-actions">
                            <button type="button" class="review-edit-btn icon-action" data-review-id="${escapeHtml(review.id)}" aria-label="Edit review for ${escapeHtml(review.title || "book")}" title="Edit review">
                                <span aria-hidden="true">&#9998;</span>
                                <span class="sr-only">Edit review</span>
                            </button>
                            <button type="button" class="review-delete-btn icon-action" data-review-id="${escapeHtml(review.id)}" aria-label="Delete review for ${escapeHtml(review.title || "book")}" title="Delete review">
                                <span aria-hidden="true">&#128465;</span>
                                <span class="sr-only">Delete review</span>
                            </button>
                        </div>
                    </div>
                </article>
            `;
        })
        .join("");
}

function prefillFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const title = params.get("title");
    const author = params.get("author");
    const cover = params.get("cover");

    const hasTitle = title && title !== "Not available";
    const hasAuthor = author && author !== "Not available";

    if (hasTitle) {
        titleInput.value = title;
    }

    if (hasAuthor) {
        authorInput.value = author;
    }

    if (cover) {
        coverUrlInput.value = cover;
    }

    if (hasTitle || hasAuthor) {
        prefillNote.textContent = "Book details were filled in from your Discover selection.";
    }
}

function resetFormState() {
    reviewIdInput.value = "";
    coverUrlInput.value = "";
    reviewForm.reset();
    setStarRating("");
    submitButton.textContent = "Save Review";
    cancelEditButton.hidden = true;
}

function populateFormForEdit(reviewId) {
    const reviews = readReviews();
    const selected = reviews.find((item) => item.id === reviewId);

    if (!selected) {
        return;
    }

    reviewIdInput.value = selected.id;
    coverUrlInput.value = selected.coverUrl || "";
    titleInput.value = selected.title;
    authorInput.value = selected.author;
    setStarRating(selected.rating);
    reviewInput.value = selected.text;

    submitButton.textContent = "Update Review";
    cancelEditButton.hidden = false;
    prefillNote.textContent = "Editing saved review.";
    titleInput.focus();
}

function deleteReview(reviewId) {
    const reviews = readReviews();
    const target = reviews.find((item) => item.id === reviewId);

    if (!target) {
        return;
    }

    const shouldDelete = window.confirm(`Delete your review for "${target.title}"?`);
    if (!shouldDelete) {
        return;
    }

    const filtered = reviews.filter((item) => item.id !== reviewId);
    writeReviews(filtered);
    renderSavedReviews();
    prefillNote.textContent = "Review deleted.";

    if (reviewIdInput.value === reviewId) {
        resetFormState();
    }
}

reviewForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const selectedRating = normalizeRating(ratingInput.value);
    if (!selectedRating) {
        prefillNote.textContent = "Please select a star rating before saving.";
        if (starButtons[0]) {
            starButtons[0].focus();
        }
        return;
    }

    const editId = reviewIdInput.value;

    const newReview = sanitizeReviewRecord({
        id: editId || createReviewId(),
        title: titleInput.value.trim(),
        author: authorInput.value.trim(),
        rating: selectedRating,
        text: reviewInput.value.trim(),
        date: new Date().toLocaleDateString(),
        coverUrl: coverUrlInput.value || ""
    });

    const reviews = readReviews();

    if (editId) {
        const index = reviews.findIndex((item) => item.id === editId);
        if (index >= 0) {
            reviews[index] = newReview;
        }
    } else {
        reviews.push(newReview);
    }

    writeReviews(reviews);
    resetFormState();

    renderSavedReviews();
    prefillNote.textContent = editId ? "Review updated successfully." : "Review saved successfully.";
});

cancelEditButton.addEventListener("click", () => {
    resetFormState();
    prefillFromQuery();
    prefillNote.textContent = "Edit canceled.";
});

savedReviewsContainer.addEventListener("click", (event) => {
    const editTarget = event.target.closest(".review-edit-btn");
    if (editTarget) {
        populateFormForEdit(editTarget.dataset.reviewId);
        return;
    }

    const deleteTarget = event.target.closest(".review-delete-btn");
    if (deleteTarget) {
        deleteReview(deleteTarget.dataset.reviewId);
    }
});

starButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
        const baseValue = Number(button.dataset.value || 0);
        const rect = button.getBoundingClientRect();
        const isLeftHalf = event.clientX - rect.left <= rect.width / 2;
        const selectedValue = isLeftHalf ? baseValue - 0.5 : baseValue;
        setStarRating(selectedValue);
    });

    button.addEventListener("keydown", (event) => {
        const current = Number(ratingInput.value || 0);
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            setStarRating(Math.min(5, current + 0.5));
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            setStarRating(Math.max(0.5, current - 0.5));
        }
    });
});

prefillFromQuery();
setStarRating(ratingInput.value);
renderSavedReviews();
