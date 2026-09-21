#!/usr/bin/env python3
"""Send one prompt to the Gemini API and print the response text to stdout.

Usage:
    python3 ask_gemini.py "prompt text"
    echo "prompt text" | python3 ask_gemini.py

Env vars:
    GEMINI_API_KEY     required. Get one free at https://aistudio.google.com/apikey
    GEMINI_MODEL       optional, default "gemini-3.8-flash". Gemini model names
                        change often; if this 404s, check
                        https://ai.google.dev/gemini-api/docs/models
    GEMINI_SYSTEM      optional system instruction to steer Gemini's role.
"""
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_MODEL = "gemini-3.8-flash"
API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def main() -> int:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print(
            "GEMINI_API_KEY no está definida. Consigue una clave gratuita en "
            "https://aistudio.google.com/apikey y expórtala como variable de "
            "entorno (nunca la pegues en el chat).",
            file=sys.stderr,
        )
        return 1

    prompt = " ".join(sys.argv[1:]).strip() or sys.stdin.read().strip()
    if not prompt:
        print("Falta el prompt: pásalo como argumento o por stdin.", file=sys.stderr)
        return 1

    model = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)
    system = os.environ.get("GEMINI_SYSTEM")

    body = {"contents": [{"parts": [{"text": prompt}]}]}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}

    url = f"{API_BASE}/{model}:generateContent"
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        if exc.code == 429:
            print(
                "Gemini ha devuelto 429 (límite de la capa gratuita superado). "
                "Espera antes de reintentar o reduce el número de llamadas.",
                file=sys.stderr,
            )
        else:
            print(f"Error HTTP {exc.code} llamando a Gemini ({model}):\n{detail}", file=sys.stderr)
        return 1
    except urllib.error.URLError as exc:
        print(f"No se pudo contactar con la API de Gemini: {exc.reason}", file=sys.stderr)
        return 1

    try:
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        print(f"Respuesta inesperada de Gemini:\n{json.dumps(payload, indent=2)}", file=sys.stderr)
        return 1

    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
