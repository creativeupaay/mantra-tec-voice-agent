"""Regression eval for the voice agent's prompt + product catalog.

Replays evals/scenarios.yaml against a Gemini TEXT model using the real system prompt
and the real search_products lookup, then has a judge model grade each transcript.

This is a proxy: it checks routing, facts and reply language, not audio, timing,
interruptions or transcription. Still do a few real test calls before shipping.

Usage:
    uv run scripts/eval_agent.py                 # all scenarios
    uv run scripts/eval_agent.py mfs500 mis100   # only scenarios whose name contains these
    uv run scripts/eval_agent.py --runs 3        # repeat each scenario (catch flaky passes)
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

import yaml
from google import genai
from google.genai import types

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.knowledge.catalog import lookup  # noqa: E402
from agent.prompts import PROMPT_VERSION, build_system_prompt  # noqa: E402
from agent.state import CallState  # noqa: E402
from agent.tools import product_tools  # noqa: E402
from env_config import settings  # noqa: E402

AGENT_MODEL = "gemini-3.5-flash"
JUDGE_MODEL = "gemini-3.5-flash"
SCENARIOS = Path(__file__).resolve().parent.parent / "evals" / "scenarios.yaml"

SYSTEM = build_system_prompt(CallState(call_id="eval", phone_number="unknown"), "gemini_realtime")
TOOLS = [types.Tool(function_declarations=[
    types.FunctionDeclaration(
        name="search_products",
        description=product_tools.SCHEMA.description,
        parameters={"type": "object", "properties": product_tools.SCHEMA.properties, "required": ["query"]},
    ),
    types.FunctionDeclaration(
        name="end_call",
        description="End and disconnect the phone call after saying goodbye.",
        parameters={"type": "object", "properties": {"reason": {"type": "string"}}},
    ),
])]

JUDGE_PROMPT = """You grade a phone sales agent's transcript. Be strict and literal.
Expected reply language: {language} ("hinglish" = Hindi words in Roman script, English terms allowed;
"english" = English sentences).
Pass condition: {pass_if}

Transcript:
{transcript}

Return JSON: {{"pass": true|false, "language_ok": true|false, "reason": "<one sentence>"}}"""


async def _play(client: genai.Client, turns: list[str]) -> tuple[list[str], list[str]]:
    """Run the caller turns; return (transcript lines, search_products queries)."""
    history: list[types.Content] = []
    lines: list[str] = []
    queries: list[str] = []
    for user in turns:
        history.append(types.Content(role="user", parts=[types.Part(text=user)]))
        lines.append(f"CALLER: {user}")
        for _ in range(4):  # allow a few tool round-trips per turn
            r = await client.aio.models.generate_content(
                model=AGENT_MODEL,
                contents=history,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM,
                    tools=TOOLS,
                    temperature=0.7,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                ),
            )
            content = r.candidates[0].content
            history.append(content)
            parts = content.parts or []
            text = "".join(p.text for p in parts if p.text and not p.thought).strip()
            if text:
                lines.append(f"AGENT: {text}")
            calls = [p.function_call for p in parts if p.function_call]
            if not calls:
                break
            responses = []
            for call in calls:
                if call.name == "search_products":
                    query = call.args.get("query", "")
                    queries.append(query)
                    lines.append(f"  [search_products: {query}]")
                    result = lookup(query)
                else:
                    lines.append(f"  [{call.name}]")
                    result = "ok"
                responses.append(types.Part(function_response=types.FunctionResponse(
                    name=call.name, response={"result": result})))
            history.append(types.Content(role="user", parts=responses))
    return lines, queries


async def _judge(client: genai.Client, scenario: dict, transcript: str) -> dict:
    r = await client.aio.models.generate_content(
        model=JUDGE_MODEL,
        contents=JUDGE_PROMPT.format(
            language=scenario.get("language", "hinglish"),
            pass_if=scenario["pass_if"],
            transcript=transcript,
        ),
        config=types.GenerateContentConfig(temperature=0, response_mime_type="application/json"),
    )
    return json.loads(r.text)


async def _run_one(client: genai.Client, scenario: dict, sem: asyncio.Semaphore) -> dict:
    async with sem:
        try:
            lines, queries = await _play(client, scenario["turns"])
            transcript = "\n".join(lines)
            verdict = await _judge(client, scenario, transcript)
            tool = scenario.get("tool")
            tool_ok = tool is None or any(tool.lower() in q.lower().replace(" ", "") for q in queries)
            passed = bool(verdict.get("pass")) and bool(verdict.get("language_ok")) and tool_ok
            reason = verdict.get("reason", "")
            if not tool_ok:
                reason = f"search_products never queried '{tool}'. {reason}"
            return {"name": scenario["name"], "pass": passed, "reason": reason, "transcript": transcript}
        except Exception as e:
            return {"name": scenario["name"], "pass": False, "reason": f"error: {e}", "transcript": ""}


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("filters", nargs="*", help="only run scenarios whose name contains one of these")
    parser.add_argument("--runs", type=int, default=1, help="repeat each scenario N times")
    parser.add_argument("-v", "--verbose", action="store_true", help="print every transcript")
    args = parser.parse_args()

    scenarios = yaml.safe_load(SCENARIOS.read_text(encoding="utf-8"))
    if args.filters:
        scenarios = [s for s in scenarios if any(f in s["name"] for f in args.filters)]

    client = genai.Client(api_key=settings.gemini_api_key)
    sem = asyncio.Semaphore(6)
    jobs = [_run_one(client, s, sem) for s in scenarios for _ in range(args.runs)]
    results = await asyncio.gather(*jobs)

    failed = 0
    for r in results:
        mark = "PASS" if r["pass"] else "FAIL"
        failed += not r["pass"]
        print(f"[{mark}] {r['name']}: {r['reason']}")
        if args.verbose or not r["pass"]:
            print("    " + r["transcript"].replace("\n", "\n    ") + "\n")
    print(f"\n{len(results) - failed}/{len(results)} passed (prompt v{PROMPT_VERSION})")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
