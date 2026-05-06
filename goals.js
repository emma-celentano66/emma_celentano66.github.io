const MONTHLY_GOAL_KEY = "turningPagesMonthlyGoal";
const CUSTOM_GOAL_KEY = "turningPagesCustomGoal";

const monthlyGoalForm = document.getElementById("monthly-goal-form");
const monthlyTargetInput = document.getElementById("monthly-goal-target");
const monthlyCurrentInput = document.getElementById("monthly-goal-current");
const monthlyAddOneButton = document.getElementById("monthly-goal-add-one");
const monthlySummary = document.getElementById("monthly-goal-summary");
const monthlyPercentText = document.getElementById("monthly-goal-percent");
const monthlyProgressBar = document.getElementById("monthly-goal-progress");

const customGoalForm = document.getElementById("custom-goal-form");
const customNameInput = document.getElementById("custom-goal-name");
const customUnitInput = document.getElementById("custom-goal-unit");
const customTargetInput = document.getElementById("custom-goal-target");
const customCurrentInput = document.getElementById("custom-goal-current");
const customSummary = document.getElementById("custom-goal-summary");
const customPercentText = document.getElementById("custom-goal-percent");
const customProgressBar = document.getElementById("custom-goal-progress");
const resetAllGoalsButton = document.getElementById("reset-all-goals");
const ideaChips = Array.from(document.querySelectorAll(".goal-idea-chip"));

function readStoredGoal(key) {
    try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
        return null;
    }
}

function saveStoredGoal(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function toPositiveInteger(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(0, Math.round(parsed));
}

function clampProgress(current, target) {
    if (!target) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

function renderMonthlyGoal(goal) {
    if (!monthlySummary || !monthlyPercentText || !monthlyProgressBar) {
        return;
    }

    if (!goal) {
        monthlySummary.textContent = "No monthly goal saved yet.";
        monthlyPercentText.textContent = "0% complete";
        monthlyProgressBar.style.width = "0%";
        return;
    }

    const target = toPositiveInteger(goal.target, 0);
    const current = toPositiveInteger(goal.current, 0);
    const percent = clampProgress(current, target);

    monthlySummary.textContent = `This month: ${current} of ${target} books finished.`;
    monthlyPercentText.textContent = `${percent}% complete`;
    monthlyProgressBar.style.width = `${percent}%`;
}

function renderCustomGoal(goal) {
    if (!customSummary || !customPercentText || !customProgressBar) {
        return;
    }

    if (!goal) {
        customSummary.textContent = "No second goal saved yet.";
        customPercentText.textContent = "0% complete";
        customProgressBar.style.width = "0%";
        return;
    }

    const name = String(goal.name || "Custom Goal").trim() || "Custom Goal";
    const unit = String(goal.unit || "units").trim() || "units";
    const target = toPositiveInteger(goal.target, 0);
    const current = toPositiveInteger(goal.current, 0);
    const percent = clampProgress(current, target);

    customSummary.textContent = `${name}: ${current} of ${target} ${unit}.`;
    customPercentText.textContent = `${percent}% complete`;
    customProgressBar.style.width = `${percent}%`;
}

function loadSavedGoalsIntoForms() {
    const monthlyGoal = readStoredGoal(MONTHLY_GOAL_KEY);
    if (monthlyGoal) {
        monthlyTargetInput.value = toPositiveInteger(monthlyGoal.target, 1);
        monthlyCurrentInput.value = toPositiveInteger(monthlyGoal.current, 0);
    }
    renderMonthlyGoal(monthlyGoal);

    const customGoal = readStoredGoal(CUSTOM_GOAL_KEY);
    if (customGoal) {
        customNameInput.value = String(customGoal.name || "");
        customUnitInput.value = String(customGoal.unit || "");
        customTargetInput.value = toPositiveInteger(customGoal.target, 1);
        customCurrentInput.value = toPositiveInteger(customGoal.current, 0);
    }
    renderCustomGoal(customGoal);
}

monthlyGoalForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const target = Math.max(1, toPositiveInteger(monthlyTargetInput.value, 1));
    const current = toPositiveInteger(monthlyCurrentInput.value, 0);

    const goal = { target, current };
    saveStoredGoal(MONTHLY_GOAL_KEY, goal);
    renderMonthlyGoal(goal);
});

if (monthlyAddOneButton) {
    monthlyAddOneButton.addEventListener("click", () => {
        const savedGoal = readStoredGoal(MONTHLY_GOAL_KEY);

        const target = Math.max(
            1,
            toPositiveInteger(monthlyTargetInput.value || savedGoal?.target || 1, 1)
        );

        const currentBase = toPositiveInteger(
            monthlyCurrentInput.value || savedGoal?.current || 0,
            0
        );

        const goal = {
            target,
            current: currentBase + 1
        };

        monthlyTargetInput.value = goal.target;
        monthlyCurrentInput.value = goal.current;

        saveStoredGoal(MONTHLY_GOAL_KEY, goal);
        renderMonthlyGoal(goal);
    });
}

customGoalForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = String(customNameInput.value || "").trim();
    const unit = String(customUnitInput.value || "").trim();
    const target = Math.max(1, toPositiveInteger(customTargetInput.value, 1));
    const current = toPositiveInteger(customCurrentInput.value, 0);

    const goal = {
        name: name || "Custom Goal",
        unit: unit || "units",
        target,
        current
    };

    saveStoredGoal(CUSTOM_GOAL_KEY, goal);
    renderCustomGoal(goal);
});

ideaChips.forEach((chip) => {
    chip.addEventListener("click", () => {
        customNameInput.value = chip.dataset.name || "";
        customUnitInput.value = chip.dataset.unit || "";
        customTargetInput.value = chip.dataset.target || "";

        customNameInput.focus();
    });
});

if (resetAllGoalsButton) {
    resetAllGoalsButton.addEventListener("click", () => {
        const shouldReset = confirm("Reset all saved goals and progress?");
        if (!shouldReset) {
            return;
        }

        localStorage.removeItem(MONTHLY_GOAL_KEY);
        localStorage.removeItem(CUSTOM_GOAL_KEY);

        if (monthlyGoalForm) {
            monthlyGoalForm.reset();
        }

        if (customGoalForm) {
            customGoalForm.reset();
        }

        renderMonthlyGoal(null);
        renderCustomGoal(null);
    });
}

loadSavedGoalsIntoForms();
