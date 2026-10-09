function normalizeOriginData(rows) {
    const grouped = {};

    rows.forEach((row) => {
        const stateName = row.bundesland || "Unbekannt";
        const normalized = {
            code: row.kennzeichen,
            stateName,
            regions: row.kreis ? [row.kreis] : [],
            answers: (row.alternativen || "")
                .split("|")
                .map((value) => value.trim())
                .filter(Boolean),
            derivation: row.abkuerzung_ursprung || row.stadt_oder_ursprung || row.kreis,
            stadt_oder_ursprung: row.stadt_oder_ursprung || row.abkuerzung_ursprung || row.kreis
        };

        if (!normalized.answers.length && normalized.derivation) {
            normalized.answers = [normalized.derivation];
        }

        if (!grouped[stateName]) {
            grouped[stateName] = [];
        }

        grouped[stateName].push(normalized);
    });

    return grouped;
}

const PLATE_DATA = Array.isArray(window.PLATE_ORIGIN_DATA)
    ? normalizeOriginData(window.PLATE_ORIGIN_DATA)
    : (window.PLATE_DATA || {});

const stateSelect = document.getElementById("state-select");
const plateDisplay = document.getElementById("plate-display");
const answerState = document.getElementById("answer-state");
const answerRegion = document.getElementById("answer-region");
const answerCard = document.getElementById("answer-card");
const statusTitle = document.getElementById("status-title");
const statusText = document.getElementById("status-text");
const stateCount = document.getElementById("state-count");
const plateHint = document.getElementById("plate-hint");
const nextButton = document.getElementById("next-button");
const plateCount = document.getElementById("plate-count");
const quizView = document.getElementById("quiz-view");
const inventoryView = document.getElementById("inventory-view");
const inventoryList = document.getElementById("inventory-list");
const inventorySummary = document.getElementById("inventory-summary");
const resetProgressButton = document.getElementById("reset-progress-button");
const viewButtons = Array.from(document.querySelectorAll(".view-switch__button"));
const LEARNED_PLATES_STORAGE_KEY = "kennzeichen-learned-v1";

const appState = {
    currentView: "quiz",
    currentPrompt: null,
    answerVisible: false,
    learnedPlates: loadLearnedPlates()
};

function flattenData() {
    return Object.entries(PLATE_DATA).flatMap(([stateName, entries]) => (
        entries.map((entry) => ({ ...entry, stateName }))
    ));
}

const ALL_PLATES = flattenData();

function sortStateNames(stateNames) {
    return [...stateNames].sort((left, right) => {
        if (left === "Sonderkennzeichen") {
            return 1;
        }

        if (right === "Sonderkennzeichen") {
            return -1;
        }

        return left.localeCompare(right, "de");
    });
}

function getPlateKey(entry) {
    return `${entry.stateName}::${entry.code}`;
}

function loadLearnedPlates() {
    try {
        const stored = JSON.parse(window.localStorage.getItem(LEARNED_PLATES_STORAGE_KEY) || "[]");
        return new Set(Array.isArray(stored) ? stored.filter((value) => typeof value === "string") : []);
    } catch {
        return new Set();
    }
}

function saveLearnedPlates() {
    try {
        window.localStorage.setItem(LEARNED_PLATES_STORAGE_KEY, JSON.stringify([...appState.learnedPlates]));
    } catch {
        // The current session still works when browser storage is unavailable.
    }
}

function formatRegions(regions) {
    return regions.join(", ");
}

function formatDisplayName(value) {
    if (!value) {
        return "";
    }

    const text = String(value)
        .trim()
        .replace(/ß/g, "ss")
        .replace(/[_/]+/g, " ")
        .replace(/\s+/g, " ");

    return text
        .split(/\s+/)
        .map((part) => {
            if (!part) {
                return "";
            }

            const hyphenIndex = part.indexOf("-");
            if (hyphenIndex >= 0) {
                return part
                    .split("-")
                    .map((subPart) => {
                        if (!subPart) {
                            return "";
                        }

                        const normalized = subPart.toLowerCase();
                        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
                    })
                    .join("-");
            }

            const normalized = part.toLowerCase();
            return normalized.charAt(0).toUpperCase() + normalized.slice(1);
        })
        .join(" ");
}

function getOriginValue(prompt) {
    return formatDisplayName(prompt?.stadt_oder_ursprung || prompt?.derivation || formatRegions(prompt?.regions || []));
}

function stripDerivationPrefix(value) {
    return String(value || "")
        .replace(/^(Stadt|Landkreis|Kreis|Gemeinde|Ortschaft|Samtgemeinde|Stadt und Landkreis|Stadtverband|Verbandsgemeinde)\s+/i, "")
        .replace(/\s*\(.*\)$/, "")
        .trim();
}

function getDerivationSource(prompt) {
    if (prompt.stadt_oder_ursprung || prompt.derivation) {
        return prompt.stadt_oder_ursprung || prompt.derivation;
    }

    const firstRegion = prompt.regions?.[0] || prompt.stateName || "diesem Bereich";
    const cleanedRegion = stripDerivationPrefix(firstRegion);

    if (cleanedRegion) {
        return cleanedRegion;
    }

    return prompt.stateName || "diesem Bereich";
}

function getDerivationText(prompt) {
    const derivation = getDerivationSource(prompt);
    return `Das Kürzel ${prompt.code} leitet sich ab von ${derivation}.`;
}

function setCounts() {
    stateCount.textContent = String(Object.keys(PLATE_DATA).length);
    plateCount.textContent = String(ALL_PLATES.length);
}

function populateStateSelect() {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Bitte Bundesland oder Bereich wählen";
    stateSelect.appendChild(placeholder);

    sortStateNames(Object.keys(PLATE_DATA)).forEach((stateName) => {
        const option = document.createElement("option");
        option.value = stateName;
        option.textContent = stateName;
        stateSelect.appendChild(option);
    });

    stateSelect.value = PLATE_DATA.Berlin ? "Berlin" : "";
}

function setView(view) {
    appState.currentView = view;
    const showQuiz = view === "quiz";
    quizView.classList.toggle("hidden", !showQuiz);
    inventoryView.classList.toggle("hidden", showQuiz);

    viewButtons.forEach((button) => {
        const selected = button.dataset.view === view;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-selected", String(selected));
    });

    if (showQuiz) {
        statusTitle.textContent = "Bundesland-Training";
        statusText.textContent = "Es werden nur aktive Kennzeichen aus dem gewählten Bereich abgefragt.";
        drawStatePrompt();
    } else {
        renderInventory();
    }
}

function syncActionButton() {
    nextButton.disabled = !appState.currentPrompt;
    nextButton.textContent = !appState.currentPrompt
        ? "Keine Aufgaben verfügbar"
        : (appState.answerVisible ? "Neue Aufgabe" : "Antwort zeigen");
}

function concealTrainingAnswer() {
    appState.answerVisible = false;
    answerCard.classList.add("is-concealed");
    syncActionButton();
}

function updateTrainingCard(prompt) {
    appState.currentPrompt = prompt;
    plateDisplay.textContent = prompt.code;
    answerState.textContent = prompt.stateName;
    answerRegion.textContent = `${getOriginValue(prompt)} · ${formatRegions(prompt.regions || [])}`;
    plateHint.textContent = "Ordne das Kennzeichen zuerst selbst einer Stadt, Region oder Institution zu und zeige danach die Lösung an.";
    concealTrainingAnswer();
}

function drawStatePrompt() {
    const selectedState = stateSelect.value;
    const allStateEntries = PLATE_DATA[selectedState] || [];
    const stateEntries = allStateEntries
        .map((entry) => ({ ...entry, stateName: selectedState }))
        .filter((entry) => !appState.learnedPlates.has(getPlateKey(entry)));

    if (!allStateEntries.length) {
        appState.currentPrompt = null;
        appState.answerVisible = false;
        plateDisplay.textContent = "-";
        answerState.textContent = "Kein Bereich gewählt";
        answerRegion.textContent = "Wähle links ein Bundesland oder einen Bereich aus.";
        plateHint.textContent = "Im Bundesland-Training trainierst du gezielt alle Kürzel eines Bereichs.";
        answerCard.classList.remove("is-concealed");
        syncActionButton();
        return;
    }

    if (!stateEntries.length) {
        appState.currentPrompt = null;
        appState.answerVisible = false;
        plateDisplay.textContent = "-";
        answerState.textContent = "Alles gelernt";
        answerRegion.textContent = `Alle ${allStateEntries.length} Kennzeichen in ${selectedState} sind abgewählt.`;
        plateHint.textContent = "Aktiviere Kennzeichen in der Übersicht wieder, wenn du sie erneut üben möchtest.";
        answerCard.classList.remove("is-concealed");
        syncActionButton();
        return;
    }

    const entry = stateEntries[Math.floor(Math.random() * stateEntries.length)];
    updateTrainingCard(entry);
    syncActionButton();
}

function renderInventory() {
    inventoryList.replaceChildren();

    sortStateNames(Object.keys(PLATE_DATA)).forEach((stateName) => {
        const entries = PLATE_DATA[stateName] || [];
        const group = document.createElement("details");
        group.className = "inventory-group";

        const heading = document.createElement("summary");
        heading.className = "inventory-group__header";

        const title = document.createElement("h3");
        title.textContent = stateName;

        const count = document.createElement("span");
        count.className = "inventory-group__count";
        count.textContent = String(entries.length);
        heading.append(title, count);

        const list = document.createElement("div");
        list.className = "inventory-group__entries";

        entries.forEach((entry) => {
            const plate = { ...entry, stateName };
            const label = document.createElement("label");
            label.className = "inventory-entry";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = !appState.learnedPlates.has(getPlateKey(plate));
            checkbox.dataset.plateKey = getPlateKey(plate);

            const code = document.createElement("span");
            code.className = "inventory-entry__code";
            code.textContent = entry.code;

            const origin = document.createElement("span");
            origin.className = "inventory-entry__origin";
            origin.textContent = entry.stadt_oder_ursprung || entry.derivation || formatRegions(entry.regions || []);

            label.append(checkbox, code, origin);
            list.append(label);
        });

        group.append(heading, list);
        inventoryList.append(group);
    });

    const learnedCount = ALL_PLATES.filter((entry) => appState.learnedPlates.has(getPlateKey(entry))).length;
    inventorySummary.textContent = `${ALL_PLATES.length - learnedCount} aktiv · ${learnedCount} gelernt`;
    resetProgressButton.disabled = learnedCount === 0;
}

function handleInventoryChange(event) {
    const checkbox = event.target.closest("input[data-plate-key]");
    if (!checkbox) {
        return;
    }

    if (checkbox.checked) {
        appState.learnedPlates.delete(checkbox.dataset.plateKey);
    } else {
        appState.learnedPlates.add(checkbox.dataset.plateKey);
    }

    saveLearnedPlates();
    renderInventory();
}

function revealAnswer() {
    if (!appState.currentPrompt) {
        return;
    }

    answerState.textContent = appState.currentPrompt.stateName;
    answerRegion.textContent = `${getOriginValue(appState.currentPrompt)} · ${formatRegions(appState.currentPrompt.regions || [])} (${appState.currentPrompt.code})`;
    answerCard.classList.remove("is-concealed");
    appState.answerVisible = true;
    syncActionButton();
}

function handleNextPrompt() {
    if (appState.currentView !== "quiz" || !appState.currentPrompt) {
        return;
    }

    if (appState.answerVisible) {
        drawStatePrompt();
        return;
    }

    revealAnswer();
}

viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
        setView(button.dataset.view);
    });
});

stateSelect.addEventListener("change", () => {
    if (appState.currentView === "quiz") {
        drawStatePrompt();
    }
});

inventoryList.addEventListener("change", handleInventoryChange);

resetProgressButton.addEventListener("click", () => {
    appState.learnedPlates.clear();
    saveLearnedPlates();
    renderInventory();
});

nextButton.addEventListener("click", handleNextPrompt);

populateStateSelect();
setCounts();
setView("quiz");