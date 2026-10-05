import json
import re
from pathlib import Path

ROOT = Path(r"c:\Users\ZOJKRAFF\OneDrive - Carl Zeiss AG\Dokumente\6. Semester\Kennzeichen")
WIKI_PATH = ROOT / "wiki.json"
OUT_PATH = ROOT / "plate-data.js"

STATE_NAMES = {
    "Baden-Württemberg",
    "Bayern",
    "Berlin",
    "Brandenburg",
    "Bremen",
    "Hamburg",
    "Hessen",
    "Mecklenburg-Vorpommern",
    "Niedersachsen",
    "Nordrhein-Westfalen",
    "Rheinland-Pfalz",
    "Saarland",
    "Sachsen",
    "Sachsen-Anhalt",
    "Schleswig-Holstein",
    "Thüringen",
    "Sonderkennzeichen",
}

PREFIX_RE = re.compile(
    r"^(Stadt|Landkreis|Kreis|Gemeinde|Ortschaft|Samtgemeinde|Stadt und Landkreis|Stadtverband|Verbandsgemeinde)\s+",
    re.IGNORECASE,
)

GENERIC_RE = re.compile(
    r"^(Landesregierung|Landtag|Polizei|Bundes|Deutschland|Bundesweit|Kfz|Bayern|Baden-Württemberg|Brandenburg|Mecklenburg-Vorpommern|Schleswig-Holstein|Sachsen-Anhalt|Nordrhein-Westfalen|Rheinland-Pfalz|Saarland|Thüringen|Niedersachsen|Berlin|Hamburg|Bremen|Sachsen|Hessen)$",
    re.IGNORECASE,
)


def strip_wiki(value):
    text = str(value or "")
    text = re.sub(r"<ref.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = text.replace("'''", "").replace("''", "")
    text = text.replace("{{", "").replace("}}", "")
    text = text.replace("&nbsp;", " ")
    text = re.sub(r"\|.*$", "", text, flags=re.M)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def split_top_level_pipes(raw):
    parts = []
    current = []
    link_depth = 0
    template_depth = 0
    i = 0
    while i < len(raw):
        ch = raw[i]
        nxt = raw[i + 1] if i + 1 < len(raw) else ""
        if ch == "[" and nxt == "[":
            link_depth += 1
            current.append(ch)
            i += 1
            continue
        if ch == "]" and link_depth and nxt == "]":
            link_depth -= 1
            current.append(ch)
            i += 1
            continue
        if ch == "{" and nxt == "{":
            template_depth += 1
            current.append(ch)
            i += 1
            continue
        if ch == "}" and template_depth and nxt == "}":
            template_depth -= 1
            current.append(ch)
            i += 1
            continue
        if ch == "|" and link_depth == 0 and template_depth == 0:
            text = "".join(current).strip()
            if text:
                parts.append(text)
            current = []
            i += 1
            continue
        current.append(ch)
        i += 1
    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts


def normalize_label(value):
    text = strip_wiki(value)
    text = re.sub(r'^(rowspan|colspan)\s*=\s*"[^"]*"\s*', "", text, flags=re.IGNORECASE)
    text = PREFIX_RE.sub("", text)
    text = re.sub(r"\s*\(.*\)$", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_target(value):
    text = str(value or "")
    match = re.search(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", text)
    if match:
        return match.group(1).strip() or match.group(2).strip()
    return strip_wiki(text)


def is_code_like(value):
    text = strip_wiki(value)
    if not text:
        return False
    text = text.replace(" ", "")
    return bool(re.fullmatch(r"[A-ZÄÖÜ]{1,5}", text)) or bool(re.fullmatch(r"[A-ZÄÖÜ]{1,5}\d*", text))


def code_letters(code):
    return re.sub(r"[^A-ZÄÖÜ]", "", code)


def find_code(cells):
    for cell in cells:
        plain = strip_wiki(cell)
        if is_code_like(plain):
            return plain
    return None


def find_state(cells):
    for cell in reversed(cells):
        plain = strip_wiki(cell)
        if plain in STATE_NAMES:
            return plain
    return "Sonderkennzeichen"


def cell_has_code(raw_cell, code):
    letters = code_letters(code)
    if not letters:
        return False
    raw = str(raw_cell or "")
    target = extract_target(raw)
    plain = strip_wiki(raw)
    return letters in re.sub(r"[^A-ZÄÖÜ]", "", target + plain)


def build_dataset():
    payload = json.loads(WIKI_PATH.read_text(encoding="utf-8-sig"))
    text = payload["parse"]["wikitext"]
    lines = text.splitlines()
    grouped = {}
    current_row = []

    def finalize_row():
        nonlocal current_row
        if not current_row:
            return

        row_text = " | ".join(line.strip().lstrip("|").strip() for line in current_row if line.strip())
        current_row = []

        cells = split_top_level_pipes(row_text)
        cleaned = [c.strip() for c in cells if c and c.strip()]
        if not cleaned:
            return

        code = find_code(cleaned)
        if not code:
            return

        state = find_state(cleaned)
        primary_regions = []
        seen_regions = set()
        derivation = None

        for cell in cleaned:
            plain = normalize_label(cell)
            target = extract_target(cell)
            if plain.startswith("Liste aller deutschen Kfz-Kennzeichen") or "rowspan" in plain.lower() or "colspan" in plain.lower():
                continue

            if derivation is None and target and target not in (code, state) and not target.startswith("Liste aller deutschen Kfz-Kennzeichen"):
                target_plain = normalize_label(target)
                if cell_has_code(cell, code) or target_plain and code_letters(code) in re.sub(r"[^A-ZÄÖÜ]", "", target_plain):
                    derivation = target_plain
                    continue

            if not plain or plain == code or plain == state:
                continue
            if GENERIC_RE.fullmatch(plain):
                continue
            if derivation is not None and plain == derivation:
                continue
            if plain not in seen_regions:
                seen_regions.add(plain)
                primary_regions.append(plain)

        if derivation is None:
            for cell in cleaned:
                plain = normalize_label(cell)
                if plain and plain not in (code, state) and not plain.startswith("Liste aller deutschen Kfz-Kennzeichen") and "rowspan" not in plain.lower() and "colspan" not in plain.lower():
                    derivation = plain
                    break

        if derivation is None and primary_regions:
            derivation = primary_regions[0]
        if derivation is None:
            derivation = state

        if state not in grouped:
            grouped[state] = []

        entry = {
            "code": code,
            "regions": primary_regions or [state],
            "answers": list(dict.fromkeys([*(primary_regions or [state]), derivation])),
            "derivation": derivation,
        }
        grouped[state].append(entry)

    for line in lines:
        if line.startswith("{|"):
            continue
        if line.startswith("|}"):
            finalize_row()
            continue
        if line.startswith("|-"):
            finalize_row()
            continue
        if line.startswith("|"):
            current_row.append(line)
            continue

    finalize_row()

    ordered = {key: grouped[key] for key in sorted(grouped.keys(), key=lambda item: item.casefold())}
    return ordered


def write_js(data):
    OUT_PATH.write_text("window.PLATE_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")


def main():
    data = build_dataset()
    write_js(data)
    total = sum(len(entries) for entries in data.values())
    print(f"written {total} plate entries across {len(data)} states")
    for state in ["Baden-Württemberg", "Bayern", "Berlin", "Sonderkennzeichen"]:
        if state in data:
            print(state, data[state][:2])


if __name__ == "__main__":
    main()
