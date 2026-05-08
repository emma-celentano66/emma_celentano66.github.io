const SiteLoader = (() => {
    const loader = document.getElementById("site-loader");
    const loaderText = document.getElementById("site-loader-text");
    let activeLoads = 0;

    if (!loader) {
        return {
            show() {},
            hide() {},
            begin() {},
            end() {}
        };
    }

    function setMessage(message) {
        if (loaderText && message) {
            loaderText.textContent = message;
        }
    }

    function show(message) {
        setMessage(message);
        loader.classList.remove("hidden");
        loader.setAttribute("aria-hidden", "false");
        document.body.classList.add("is-loading");
    }

    function hide() {
        loader.classList.add("hidden");
        loader.setAttribute("aria-hidden", "true");
        document.body.classList.remove("is-loading");
    }

    function begin(message) {
        activeLoads += 1;
        show(message || "Turning pages...");
    }

    function end() {
        activeLoads = Math.max(0, activeLoads - 1);
        if (activeLoads === 0) {
            hide();
        }
    }

    if (document.readyState === "complete") {
        hide();
    } else {
        window.addEventListener("load", hide, { once: true });
    }

    return {
        show,
        hide,
        begin,
        end
    };
})();

const SiteToast = (() => {
    let toastEl = null;
    let hideTimer = 0;

    function getToastEl() {
        if (toastEl) {
            return toastEl;
        }

        toastEl = document.createElement("div");
        toastEl.className = "site-toast";
        toastEl.setAttribute("role", "status");
        toastEl.setAttribute("aria-live", "polite");
        toastEl.setAttribute("aria-atomic", "true");
        document.body.appendChild(toastEl);
        return toastEl;
    }

    function show(message, duration = 1600) {
        const el = getToastEl();
        el.textContent = String(message || "Done");
        el.classList.add("show");

        window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => {
            el.classList.remove("show");
        }, duration);
    }

    return {
        show
    };
})();
