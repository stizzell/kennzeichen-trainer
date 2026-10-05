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
const memoryTipText = document.getElementById("memory-tip-text");
const nextButton = document.getElementById("next-button");
const plateCount = document.getElementById("plate-count");
const memoryTip = document.getElementById("memory-tip");

if (memoryTip) {
    memoryTip.remove();
}

const modeButtons = Array.from(document.querySelectorAll(".mode-switch__button"));

const appState = {
    currentMode: "state",
    currentPrompt: null,
    answerVisible: false
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

function setMode(mode) {
    appState.currentMode = "state";

    modeButtons.forEach((button) => {
        const selected = button.dataset.mode === "state";
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-selected", String(selected));
    });

    statusTitle.textContent = "Bundesland-Training";
    statusText.textContent = "Es werden nur Kennzeichen aus dem gewählten Bundesland oder Bereich angezeigt.";
    drawStatePrompt();
}

function syncActionButton() {
    if (!appState.currentPrompt) {
        nextButton.textContent = "Antwort zeigen";
        return;
    }

    nextButton.textContent = appState.answerVisible ? "Neue Aufgabe" : "Antwort zeigen";
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
    const stateEntries = PLATE_DATA[selectedState] || [];

    if (!stateEntries.length) {
        plateDisplay.textContent = "-";
        answerState.textContent = "Kein Bereich gewählt";
        answerRegion.textContent = "Wähle links ein Bundesland oder einen Bereich aus.";
        plateHint.textContent = "Im Bundesland-Training trainierst du gezielt alle Kürzel eines Bereichs.";
        if (memoryTipText) {
            memoryTipText.textContent = "Danach kannst du gezielt innerhalb eines Bundeslands oder der Sonderkennzeichen lernen.";
        }
        answerCard.classList.remove("is-concealed");
        return;
    }

    const entry = stateEntries[Math.floor(Math.random() * stateEntries.length)];
    updateTrainingCard({ ...entry, stateName: selectedState });
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
    if (appState.currentMode !== "state") {
        return;
    }

    if (appState.answerVisible) {
        drawStatePrompt();
        return;
    }

    revealAnswer();
}

modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        setMode(button.dataset.mode);
    });
});

stateSelect.addEventListener("change", () => {
    if (appState.currentMode === "state") {
        drawStatePrompt();
    }
});

nextButton.addEventListener("click", handleNextPrompt);

populateStateSelect();
setCounts();
setMode("state");