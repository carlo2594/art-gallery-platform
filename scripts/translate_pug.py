from __future__ import annotations

import html
import re
import sys
from pathlib import Path
from typing import Callable

from deep_translator import GoogleTranslator
from langdetect import DetectorFactory, LangDetectException, detect

DetectorFactory.seed = 7

ATTR_TEXT_NAMES = {
    "aria-label",
    "aria-description",
    "aria-roledescription",
    "placeholder",
    "title",
    "alt",
}

SPANISH_CHARS = set("áéíóúüñÁÉÍÓÚÜÑ¡¿")
SPANISH_KEYWORDS = {
    "obra",
    "obras",
    "buscar",
    "iniciar",
    "sesion",
    "sesión",
    "actividad",
    "cuenta",
    "perfil",
    "guardar",
    "volver",
    "confirmar",
    "mensaje",
    "gracias",
    "artista",
    "artistas",
    "exposicion",
    "exposición",
    "exhibicion",
    "exhibición",
    "galería",
    "galeria",
    "cuenta",
    "correo",
    "contraseña",
    "contraseña",
    "coleccionista",
    "coleccionistas",
    "registrarse",
    "registro",
    "exposiciones",
    "iniciar",
    "sesión",
    "sesion",
    "cerrar",
    "actualiza",
    "actualizar",
    "publicada",
    "publicadas",
    "pronto",
    "descubre",
    "descubrir",
    "comunidad",
    "experiencias",
    "sensaciones",
    "galer",
    "familia",
    "colección",
    "coleccion",
    "detalle",
    "detalles",
    "ubicación",
    "ubicacion",
    "aprobación",
    "aprobacion",
    "revisión",
    "revision",
    "borrador",
    "borradores",
    "rechazado",
    "rechazados",
    "enviado",
    "enviados",
    "pendiente",
    "pendientes",
    "mensaje",
    "mensajes",
    "hola",
    "bienvenido",
    "bienvenida",
    "bienvenidos",
    "gracias",
    "volver",
    "guardar",
    "editar",
    "eliminar",
    "agregar",
    "cuándo",
    "cuando",
    "dónde",
    "donde",
    "porqué",
    "porque",
}

INTERP_RE = re.compile(r"(\#\{.*?\})")
TEMPLATE_INTERP_RE = re.compile(r"(\$\{.*?\})")


class SpanishTranslator:
    def __init__(self) -> None:
        self.translator = GoogleTranslator(source="auto", target="en")
        self.cache: dict[str, str] = {}

    def translate(self, text: str) -> str:
        normalized = text.strip()
        if not normalized:
            return text
        if normalized in self.cache:
            translated = self.cache[normalized]
        else:
            translated = self._safe_translate(normalized)
            self.cache[normalized] = translated
        prefix_len = len(text) - len(text.lstrip())
        suffix_len = len(text) - len(text.rstrip())
        prefix = text[:prefix_len]
        suffix = text[len(text) - suffix_len :] if suffix_len else ""
        return prefix + self._restore_entities(translated) + suffix

    def _safe_translate(self, text: str) -> str:
        try:
            result = self.translator.translate(text)
            return result if isinstance(result, str) else text
        except Exception:
            return text

    @staticmethod
    def _restore_entities(text: str) -> str:
        return text.replace("©", "&copy;")


def needs_translation(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    if not any(ch.isalpha() for ch in stripped):
        return False
    lower = stripped.lower()
    if any(ch in SPANISH_CHARS for ch in stripped):
        return True
    if any(keyword in lower for keyword in SPANISH_KEYWORDS):
        return True
    if stripped.isalpha() and stripped[0].isupper() and len(stripped) >= 5:
        return True
    if len(stripped) >= 10:
        try:
            lang = detect(stripped)
            if lang == "es":
                return True
            if lang != "es":
                return False
        except LangDetectException:
            pass
    if " " in stripped:
        return True
    return False


def translate_with_interpolations(
    text: str, translate_fn: Callable[[str], str], *, force: bool = False
) -> str:
    parts = INTERP_RE.split(text)
    new_parts: list[str] = []
    for part in parts:
        if part.startswith("#{") and part.endswith("}"):
            new_parts.append(part)
        else:
            new_parts.append(translate_segment(part, translate_fn, force=force))
    return "".join(new_parts)


def translate_template_literal(
    text: str, translate_fn: Callable[[str], str], *, force: bool = False
) -> str:
    parts = TEMPLATE_INTERP_RE.split(text)
    new_parts: list[str] = []
    for part in parts:
        if part.startswith("${") and part.endswith("}"):
            new_parts.append(part)
        else:
            new_parts.append(translate_segment(part, translate_fn, force=force))
    return "".join(new_parts)


def translate_segment(
    segment: str, translate_fn: Callable[[str], str], *, force: bool = False
) -> str:
    if not segment.strip():
        return segment
    if not force and not needs_translation(html.unescape(segment)):
        return segment
    text = html.unescape(segment)
    translated = translate_fn(text)
    return translated


def detect_attr_name(line: str, quote_index: int) -> str | None:
    idx = quote_index - 1
    while idx >= 0 and line[idx].isspace():
        idx -= 1
    if idx >= 0 and line[idx] == "=":
        idx -= 1
        while idx >= 0 and line[idx].isspace():
            idx -= 1
        end = idx + 1
        while idx >= 0 and (line[idx].isalnum() or line[idx] in "-_:"):
            idx -= 1
        start = idx + 1
        name = line[start:end]
        return name if name else None
    return None


def escape_for_quote(text: str, quote: str) -> str:
    if quote == "'":
        return text.replace("\\", "\\\\").replace("'", "\\'")
    if quote == '"':
        return text.replace("\\", "\\\\").replace('"', '\\"')
    return text


def translate_text_node(line: str, translate_fn: Callable[[str], str]) -> str:
    stripped = line.lstrip()
    indent_len = len(line) - len(stripped)
    indent = line[:indent_len]
    if stripped.startswith("| "):
        body = stripped[2:]
        translated = translate_with_interpolations(body, translate_fn)
        return f"{indent}| {translated}"
    return line


def process_line(line: str, translator: SpanishTranslator) -> str:
    newline = ""
    if line.endswith("\r\n"):
        newline = "\r\n"
        raw = line[:-2]
    elif line.endswith("\n"):
        newline = "\n"
        raw = line[:-1]
    else:
        raw = line
    processed = translate_text_node(raw, translator.translate)
    processed = translate_text_tail(processed, translator.translate)
    processed = translate_quoted_strings(processed, translator.translate)
    return processed + newline


def translate_text_tail(line: str, translate_fn: Callable[[str], str]) -> str:
    stripped = line.lstrip()
    if not stripped or stripped.startswith(("//", "- ", "if ", "else", "each ", "case ", "when ", "while ", "for ", "block ", "include", "extend", "mixin", "doctype", "script", "style")):
        return line
    indent_len = len(line) - len(stripped)
    indent = line[:indent_len]
    depth = 0
    split_idx = None
    for idx, ch in enumerate(stripped):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif ch.isspace() and depth == 0:
            split_idx = idx
            break
    if split_idx is None:
        return line
    head = stripped[:split_idx]
    tail = stripped[split_idx + 1 :]
    if not tail or tail.lstrip().startswith("="):
        return line
    translated_tail = translate_with_interpolations(tail, translate_fn)
    return f"{indent}{head} {translated_tail}"


def translate_quoted_strings(line: str, translate_fn: Callable[[str], str]) -> str:
    result: list[str] = []
    i = 0
    last = 0
    stripped = line.lstrip()
    is_script_line = stripped.startswith("-")
    depth = 0
    while i < len(line):
        ch = line[i]
        if not is_script_line:
            if ch == "(":
                depth += 1
            elif ch == ")" and depth > 0:
                depth -= 1
        if ch in ("'", '"', "`"):
            result.append(line[last:i])
            end_idx, replacement = process_quoted_segment(
                line, i, ch, depth, is_script_line, translate_fn
            )
            result.append(replacement)
            i = end_idx
            last = i
            continue
        i += 1
    result.append(line[last:])
    return "".join(result)


def process_quoted_segment(
    line: str,
    start: int,
    quote: str,
    depth: int,
    is_script_line: bool,
    translate_fn: Callable[[str], str],
) -> tuple[int, str]:
    i = start + 1
    escaped = False
    content: list[str] = []
    while i < len(line):
        ch = line[i]
        if ch == "\\" and not escaped:
            escaped = True
            content.append(ch)
            i += 1
            if i < len(line):
                content.append(line[i])
                i += 1
            continue
        if ch == quote and not escaped:
            break
        content.append(ch)
        escaped = False
        i += 1
    if i >= len(line):
        return len(line), line[start:]
    raw = "".join(content)
    attr_name = None
    translated_content = raw
    if quote != "`" and not is_script_line and depth > 0:
        attr_name = detect_attr_name(line, start)
    should_translate = False
    if quote == "`":
        translated_content = translate_template_literal(raw, translate_fn, force=True)
    else:
        if attr_name in ATTR_TEXT_NAMES:
            should_translate = True
        elif attr_name is None:
            should_translate = needs_translation(html.unescape(raw))
        if should_translate:
            translated_content = translate_with_interpolations(
                raw, translate_fn, force=attr_name in ATTR_TEXT_NAMES
            )
    escaped_content = escape_for_quote(translated_content, quote)
    return i + 1, f"{quote}{escaped_content}{quote}"


def main() -> None:
    root = Path("views")
    translator = SpanishTranslator()
    for pug_file in root.rglob("*.pug"):
        print(f"Translating {pug_file}")
        original = pug_file.read_text(encoding="utf-8")
        lines = original.splitlines(keepends=True)
        new_lines = [process_line(line, translator) for line in lines]
        new_content = "".join(new_lines)
        pug_file.write_text(new_content, encoding="utf-8")


if __name__ == "__main__":
    if not Path("views").exists():
        print("Run from project root.", file=sys.stderr)
        sys.exit(1)
    main()
