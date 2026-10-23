# Mantra Tech Voice Agent — Operating Guide

How the voice agent is put together, where each kind of information belongs, and how to apply
client updates without breaking it again. Read this before touching the prompt or the catalog.

Last reviewed: 2026-10-23 · Prompt version: 3.1.0 · Model: `gemini-3.1-flash-live-preview`
(**shuts down 2026-11-17**, see [§9](#9-open-items-in-priority-order)).

---

## 1. The one rule

> **The prompt holds behaviour. The catalog holds facts. Nothing is written in two places.**

The system prompt is sent to the model on every turn for the whole call, and Gemini Live cannot
change it mid-call. Every line in it competes for the model's attention with every other line.
Research on instruction following ([IFScale](https://arxiv.org/abs/2507.11538),
[Lost in the Middle](https://arxiv.org/abs/2307.03172)) shows adherence drops as instructions pile
up, and rules in the middle get followed least. That is how the old agent ended up saying MFS500 was
discontinued: an MFS100 rule elsewhere in a 6K-token prompt leaked onto the wrong product.

So a product rule (status, price, availability, Aadhaar or not, exceptions) goes in the catalog.
The model only sees it when the caller asks about that product, as a short tool result tied to
that one product.

---

## 2. Where things live

| What you are changing | File | Example |
|---|---|---|
| A product's status, price, availability, Aadhaar / non-Aadhaar, where to buy | `python-server/agent/knowledge/catalog.yaml` | "MFS500 is non-Aadhaar, on the website, ₹3,000 + GST" |
| A product-specific exception ("only for bulk banking") | `catalog.yaml` → that product's `notes` | "MFS100 only for bulk banking orders" |
| A new product, or another name callers use for it | `catalog.yaml` → new entry, or `codes` / `tags` | "Callers say *MIS 100* for MIS100 V2" |
| What to do when a product is unknown | `catalog.yaml` → `not_found` | "Arrange a sales callback after gathering details" |
| How website vs sales-team products are sold | `catalog.yaml` → `sales_routes` | "Single units on website, bulk via callback" |
| How the agent behaves on every call (tone, language, flow, lead capture, support routing, ending) | `python-server/agent/prompts.py` | "Ask Aadhaar vs non-Aadhaar before recommending a scanner" |
| Helpline numbers, support/sales email | `prompts.py` constants at the top | `SUPPORT_HELPLINE = ...` |
| Topics to refuse | `GUARDRAILS_JSON` env var, or defaults in `python-server/modules/guardrails/model.py` | "Don't discuss salary" |
| Silence check-ins and call time limit | `python-server/pipeline/bot.py` (`SilenceTimeoutMonitor`) + env `SILENCE_TIMEOUT_*`, `MAX_CALL_DURATION_SECONDS` | |
| Model, voice, VAD | env `GEMINI_MODEL`, `GEMINI_VOICE_NAME`, `GEMINI_VAD_*`; config in `bot.py` | |
| Post-call summary, intent, lead/ticket flags | `python-server/pipeline/post_call.py` | |
| Regression tests | `python-server/evals/scenarios.yaml` | |

---

## 3. How a call flows

```
Caller ─► Plivo / Exotel ─► Pipecat pipeline (pipeline/bot.py)
                               │
                               ▼
                    Gemini Live (speech in → speech out)
                    system instruction = agent/prompts.py   ← behaviour, ~2.4K tokens, fixed per call
                               │  tool call (blocks speech until it returns)
                               ▼
                    search_products (agent/tools/product_tools.py)
                               │  deterministic lookup, <1 ms
                               ▼
                    agent/knowledge/catalog.py  ◄── catalog.yaml   ← facts
                               │
            call ends ─► post_call.py (summary, intent, lead/ticket, CRM)
```

Why `search_products` has no LLM inside: on Gemini 3.1 Live the conversation freezes until a tool
returns ([Live API tools](https://ai.google.dev/gemini-api/docs/live-api/tools)). The old tool
called a second Gemini model, which meant 1–2 s of dead air and a second place for facts to get
distorted. The lookup is now plain code: match the model name, otherwise score the described need,
then return a short fact sheet starting with a `STATUS:` line.

---

## 4. Applying a client update — step by step

1. **Classify each sentence of the client's message.** Ask yourself: is it about one product, or about how
   the agent behaves on every call?
   - About a product → catalog.
   - About behaviour on every call → prompt.
   - Both → split it. The product part goes in the catalog; only a generic rule goes in the prompt.
2. **Write a failing scenario first** in `evals/scenarios.yaml`. Use the caller's real wording
   (Hinglish if that's how they spoke) and a plain-English `pass_if`.
3. **Make the change** (sections 5 and 6 below).
4. **Run the evals**: `cd python-server && uv run scripts/eval_agent.py --runs 2`. Everything must
   pass, not just the new scenario.
5. **Make 2–3 real test calls** on the actual line (see the [checklist](#8-real-call-checklist)).
6. **Bump** `PROMPT_VERSION` (if the prompt changed) or `updated:` on the catalog entry, then commit.
   Put the client message, the eval result and who approved it in the commit message. One commit per
   update keeps rollback simple.
7. **Deploy.** Docker bakes files into the image, so rebuild/restart per `UPDATE_INSTRUCTIONS.txt`.
   A `git pull` alone changes nothing on the VM.
8. **Watch the first calls** in the dashboard. If anything is off, roll back: `git revert <commit>`,
   then rebuild. Don't hot-patch the prompt on the VM.

### Worked example: the 2026-10-23 client messages

| Client said | Went to |
|---|---|
| "MIS100v2 single iris device is available on website in 1-2 days" | `catalog.yaml` → `mis100v2`: `sales: website`, `availability` (agent says it is on the website) |
| "When I ask about MFS500 it says discontinued" | Root cause was product rules in the prompt. Fixed by the catalog + `status: active` on `mfs500` |
| "MFS500 is a Non-Aadhaar device, available on the website, 3000+18% GST" | `mfs500`: `aadhaar: false`, `sales: website`, `price` |
| "For non-Aadhaar it suggests MFS100 … we don't support MFS100 incl. SDK" | `mfs100`: `status: support_ended`, `recommend: false`, `notes` naming MFS110 / MFS500 as alternatives |
| "Bulk for banking → we provide MFS100, or arrange a call back" | `mfs100.notes` (exception) |
| "If the agent doesn't know a device, arrange a sales callback after gathering details" | `catalog.yaml` → `not_found` (returned by the tool), plus one generic line in the prompt's Tools section |

None of these added a single line to the prompt.

---

## 5. Editing the catalog

Template for a new product. All fields except `id` and `name` are optional:

```yaml
  - id: mfs500                       # unique, lowercase
    name: "MFS500"
    codes: ["MFS500", "MFS 500"]     # how callers say it; case, spaces and dashes are ignored
    type: "Optical fingerprint scanner (USB)"
    aadhaar: false                   # true = UIDAI certified, false = Non-Aadhaar, omit if unknown
    status: active                   # active | support_ended | discontinued — omit if not confirmed
    summary: "One line on what it is."
    use_when: "When it's the right recommendation."
    tags: [fingerprint, scanner, usb, non_aadhaar]   # words for need-based matching
    sales: website                   # website | sales_team | omit when notes decide
    price: "3,000 rupees plus 18% GST per unit (3,540 rupees including GST)."
    availability: "Anything about stock / listing / delivery timing."
    recommend: false                 # only if it must never be suggested unprompted
    notes:
      - "One client rule per line, written as an instruction."
    updated: 2026-10-23
    source: "Client WhatsApp 2026-10-23"
```

Rules:
- **Write `price`, `availability` and `notes` the way you want them understood, not spoken.** The
  model rephrases them in the caller's language. Don't write Hindi or English sample sentences.
- **Only set `status` when the client confirmed it.** Leaving it out makes the agent say "not
  discontinued as far as we know, sales team confirms stock". That's safe; a wrong `discontinued`
  is not.
- **Anything time-sensitive gets a date** ("in 1 to 2 days (as of 23 Oct 2026)"), so you notice when
  it goes stale.
- **Always add `codes` for model names.** Matching is exact on the code (ignoring spaces and dashes),
  so "MFS500" won't accidentally match MFS500-LX. A name that isn't in `codes` or `name` falls
  through to `not_found`.
- **Check the result** after any edit:
  ```bash
  cd python-server && .venv/bin/python -c "from agent.knowledge.catalog import lookup; print(lookup('MFS500'))"
  ```
- `catalog.py` reloads the file when it changes. If the YAML is broken, it logs an error and keeps the last good copy.

---

## 6. Editing the prompt (`agent/prompts.py`)

The prompt is a set of short sections in a fixed order, following Google's Live API guidance
(persona → conversational rules → task flow → guardrails):

`Role → Language → How you speak → Call opening → Tools → What you cannot do → Sales enquiries →
Collecting callback details → Support → Caller wants a person → Ending the call → Caller background → Guardrails`

### Writing rules

1. **Describe the intent, don't script the words.** Write "ask briefly how you can help", not
   *"Ji bataiye, main aapki kaise help kar sakti hoon?"*. The model copies sample lines word for
   word and over-uses them ([OpenAI realtime prompting guide](https://developers.openai.com/cookbook/examples/realtime_prompting_guide)).
   Worse, an English sample pulls a Hindi call into English. This was one of the bugs we saw.
2. **Literal text only for things that must not vary:** phone numbers, emails, the website, `Hello?`
   at pickup.
3. **If you really need an example:** give 2–3 varied ones, include a Hinglish one, and say
   "for inspiration only, don't repeat these". Try describing the intent first.
4. **No product names or facts in the prompt.** Generic flow ("ask Aadhaar vs non-Aadhaar") is fine;
   "MFS100 is discontinued" is not.
5. **One rule, one place.** Before adding a rule, search the file for one that covers it and edit that
   instead. Contradictions hurt more than missing rules.
6. **Plain, calm language.** Don't stack `CRITICAL`, `NEVER`, `MUST` or ALL CAPS. Modern models
   over-react to it and it stops meaning anything
   ([Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices),
   [Gemini prompting](https://ai.google.dev/gemini-api/docs/prompting-strategies)). Give the reason
   instead ("calls come through an office exchange, so you can't see their number").
7. **Budget.** It's about 2.4K tokens now. Treat 3K as the ceiling. If you're over, merge or
   delete before adding. A change that adds more than about 10 lines usually belongs in the catalog
   or a tool.
8. **Only add a rule when a test or a real call shows the behaviour is wrong.** Don't add one "just in
   case".
9. **Messages the code sends mid-call** (silence checks, time limit) start with `[System event, not
   spoken by the caller]` and describe intent only, so the model answers in the call's language.

### Language

Gemini native-audio models pick the output language themselves. Google says they "don't support
explicitly setting the language code"
([Live guide](https://ai.google.dev/gemini-api/docs/live-guide)), so `GEMINI_LANGUAGE` is probably
ignored. Mirroring is controlled by the prompt's Language section. If calls start drifting into
English, fix that section. Don't add Hindi copies of the rules.

---

## 7. Tools — design rules

- **Fast and deterministic.** On 3.1 Live every tool call is dead air. No LLM calls inside tools
  that run during the conversation.
- **Short, scoped results.** Return only the products asked about: a few facts each, plus a
  `How to buy` line and `Note` lines. Never dump the whole catalog.
- **Start with `STATUS:`** (`found`, `not_found`, `needs_clarification`) so the model acts on it
  without reading everything. `not_found` says "do not search again" to prevent loops.
- **Put tool rules in the tool description** (when to call it and what to pass). The prompt keeps
  only the general rule: product facts come from the tool.
- **Errors return guidance, not silence:** "Lookup failed. Do not guess, offer a sales callback."

---

## 8. Testing

### Automated (run before every deploy)

```bash
cd python-server
uv run scripts/eval_agent.py              # all scenarios
uv run scripts/eval_agent.py mfs100 -v    # filter by name, show transcripts
uv run scripts/eval_agent.py --runs 3     # repeat to catch flaky passes
```

The script replays `evals/scenarios.yaml` against a Gemini text model with the real prompt and the
real lookup. A judge model then grades each transcript against `pass_if` and the expected
language. It's a proxy: it tests routing, facts and language, not audio, timing or barge-in.

Grow it:
- Every client correction becomes a scenario.
- Every bad real call becomes a scenario, using the caller's actual words.
- If a scenario fails because it's unfair (e.g. the agent correctly asks quantity first), fix the
  scenario by adding the caller's next turn. Don't fix the prompt in that case.

### Real-call checklist

After a prompt, catalog, model or VAD change, call the line and cover:
- [ ] A Hindi caller asks about a product → the reply is Hinglish, including the filler.
- [ ] An English caller → English all the way through.
- [ ] Ask about MFS500, then MFS100 → each gets its own facts.
- [ ] An unknown model → no made-up price, details collected for a callback.
- [ ] A support issue → helpline given, no callback promised.
- [ ] Give a mobile number in chunks, with one mistake → it's corrected and read back in two groups of five.
- [ ] Say "hello?" while the agent is talking → it finishes its sentence.
- [ ] Go silent for 40 s → a gentle check-in in the call's language.
- [ ] Say goodbye → it thanks you and hangs up.
- [ ] Listen to the recordings, not just the transcripts. Check prices, numbers and the website
      for pronunciation in the real voice.
- [ ] After a callback call, check that the lead actually appears (post-call pipeline → CRM).
      The agent says "noted" during the call, but the lead is only created after hang-up.

---

## 9. Open items, in priority order

1. **Move to `gemini-3.8-live` before 2026-11-17.** `gemini-3.1-flash-live-preview` shuts down that
   day, and requests aren't redirected
   ([deprecations](https://ai.google.dev/gemini-api/docs/deprecations)). This needs:
   - Upgrade Pipecat from 1.5.0 to **≥ 1.11.0**. That's where 3.8 support landed, including declaring
     sync tools as `BLOCKING`. On 1.5, `search_products` would run non-blocking on 3.8, and the model
     could talk before the facts arrive
     ([Pipecat changelog](https://github.com/pipecat-ai/pipecat/blob/main/CHANGELOG.md)).
     Read the breaking changes from 1.6 to 1.13 first.
   - Set `GEMINI_MODEL=gemini-3.8-live`. `bot.py` already drops the thinking config for 3.8, which
     doesn't accept it.
   - Re-test silence and background-noise behaviour. Proactive audio is always on in 3.8, and the
     model may deliberately stay quiet on speech that isn't aimed at it.
   - Pricing is unchanged.
2. **Custom vocabulary for product names.** The Live API's input transcription accepts
   `customVocabulary` (e.g. MFS110, MIS100 V2, Servico, RD Service) and `languageCodes`
   (`hi-IN`, `en-IN`) ([API reference](https://ai.google.dev/api/live)). Pipecat currently sends an
   empty config, so this needs a small subclass. It improves call logs and post-call summaries.
3. **Make "noted" true at the moment it's said.** No CRM tool is attached during the call. Leads
   are created afterwards by `post_call.py` from the transcript, so a call that drops or a misheard
   transcript can lose a lead the caller was told was saved. Also, don't trust Live transcripts as
   ground truth. Developers report the transcript differing from
   what the model actually understood. Capture phone, email and name through a `save_lead` tool with
   server-side validation (10 digits, starting 6–9; email regex), not from the transcript after the call.
4. **VAD A/B on noisy lines.** We currently use 700 ms silence and 100 ms prefix padding (Google
   recommends 500–800 ms). For false barge-ins, try `GEMINI_VAD_START_SENSITIVITY=low` with
   200–300 ms prefix padding, and compare on real calls.
5. **Record production calls into the eval format.** Pipecat ≥ 1.13 has `pipecat.evals` with
   `EvalConversationObserver` and `pipecat eval judge`. Google ADK can run spoken simulated callers
   ([ADK live evaluation](https://adk.dev/live/evaluation/)).
6. **Track a few numbers per prompt version:**
   - lead captured when it should be
   - wrong-fact rate (spoken claim vs tool result)
   - language-match rate
   - number readback accuracy
   - time to first audio
   - false barge-ins

   Log `PROMPT_VERSION` with each call.
7. **If the prompt keeps growing past the budget,** split it into stages. Pipecat Flows doesn't
   support speech-to-speech models, so use Google's pattern of a tool that returns the next stage's
   instructions ([Live API best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices)).

---

## 10. Known platform behaviour

- The system instruction and tool list are fixed when the Gemini session opens. Pipecat drops
  mid-call changes.
- Audio-only sessions are capped at 15 minutes without context compression. Calls are capped at
  5 minutes (`MAX_CALL_DURATION_SECONDS=300`), so compression is off.
- 3.1 Live: tools are synchronous only. Google documents `thinking_level` for this model
  (not `thinking_budget`), so that's what `bot.py` sends.
- Barge-in: on interruption, unsent speech is discarded and pending tool calls are cancelled.
- Telephony audio arrives at 8 kHz and is upsampled to 16 kHz for Gemini. Don't remove that.

---

## 11. Changelog

| Version | Date | Change |
|---|---|---|
| 3.1.0 | 2026-10-23 | Research pass: filler language matches the caller, tool-loop cap, `[System event]` handling, number readback in 5+5 groups, phonetic email confirmation; `STATUS:` line on tool results; silence prompts made language-neutral; eval suite added. |
| 3.0.0 | 2026-10-23 | Rebuilt: product facts moved to `catalog.yaml` + deterministic `search_products` (was a second LLM call); prompt cut from ~6K to ~2.2K tokens; verbatim scripts replaced with intent; one prompt for both voice modes; client updates for MFS500, MFS100, MIS100 V2 and unknown devices. |

## Sources

- Google — [Live API best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices) · [Live guide](https://ai.google.dev/gemini-api/docs/live-guide) · [Live tools](https://ai.google.dev/gemini-api/docs/live-api/tools) · [Session management](https://ai.google.dev/gemini-api/docs/live-api/session-management) · [Deprecations](https://ai.google.dev/gemini-api/docs/deprecations) · [Gemini 3.8 Live](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live) · [Prompting strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
- Pipecat — [Gemini Live service](https://docs.pipecat.ai/server/services/s2s/gemini-live) · [Changelog](https://github.com/pipecat-ai/pipecat/blob/main/CHANGELOG.md) · [Flows (S2S not supported)](https://docs.pipecat.ai/pipecat/flows/introduction)
- OpenAI — [Realtime prompting guide](https://developers.openai.com/cookbook/examples/realtime_prompting_guide)
- LiveKit — [Prompting guide](https://docs.livekit.io/agents/start/prompting)
- Anthropic — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- Research — [IFScale: instruction density](https://arxiv.org/abs/2507.11538) · [Lost in the Middle](https://arxiv.org/abs/2307.03172)
- India / Hinglish — [Sarvam system-prompt guide](https://docs.sarvam.ai/voice-agents/build/system-prompt.md) · [Hamming Hindi testing](https://hamming.ai/language/hindi)
- Evals — [Google ADK live evaluation](https://adk.dev/live/evaluation/)
