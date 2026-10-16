# Standard Voice Agent Prompting — Resource Audit

**Purpose:** Curated audit of externally prepared voice-agent prompting resources, plus a combined checklist for evaluating/adapting them. This is not a newly authored agent prompt. The checklist synthesizes themes in the cited public sources; retain the original authorship/provenance when copying source files.

**Research date:** 2026-10-10

## Executive recommendation

For a general-purpose starting point, read the official OpenAI voice-prompting guide and the LiveKit prompting guide, then use Deepgram’s guide for phone-call-specific prompt sections and examples. Treat the GitHub skills and prompt repositories as optional starting assets, not vetted standards: inspect licensing, freshness, platform assumptions, and claims before adoption. The RizzDial repo is notably sales-oriented; do not use its persuasion techniques as a generic assistant default.

## Curated source set

### 1. OpenAI — Prompting Realtime models

- Resource: [Prompting Realtime models](https://developers.openai.com/api/docs/guides/voice-prompting)
- Type: Official technical guide; best source here for current Realtime prompting, tools, unclear audio, exact entity capture, language control, and testing.
- Useful elements: labeled prompt structure; concise response patterns; confirmation boundaries for write actions; recovery guidance; handling background audio/silence; precise capture and confirmation of identifiers; advice to start simple and iterate based on evaluations.
- Caveat: Realtime-model/API details may not transfer verbatim to another stack. Keep model-specific configuration out of platform-neutral prompt rules.

### 2. Deepgram — Prompting Voice Agents

- Resource: [Prompting Voice Agents](https://developers.deepgram.com/docs/prompting-voice-agents)
- Type: Official platform documentation; practical guide to live-call prompts.
- Useful elements: ten-section framework—role, personality, environment, callers, scope, conversational approach, speaking style, function calling, boundaries/escalation, terminology/pronunciation. Includes full scheduling and weather examples, plus a clear distinction between prompt policy and server-side enforcement.
- Caveat: Examples use Deepgram configuration and some advice (such as pre-function narration) depends on the runtime. Adapt, don’t paste blindly.

### 3. LiveKit — Prompting guide

- Resource: [Prompting guide](https://docs.livekit.io/agents/start/prompting/)
- Type: Official framework documentation; broad guidance that applies to many voice agents.
- Useful elements: identity, output formatting, tools, goals, guardrails, user context, voice realism, variation, and behavioral testing. Especially useful for thinking about spoken output and separating voice presentation from task logic.
- Caveat: Its voice-realism examples may depend on a particular STT/LLM/TTS pipeline, SSML support, and provider tag syntax. Do not send tags to a TTS that will speak them literally.

### 4. OpenAI — Realtime Agents example repository

- Resource: [openai/openai-realtime-agents](https://github.com/openai/openai-realtime-agents)
- Type: Official demonstration code, not a universal prompt file.
- Useful elements: runnable patterns for supervisor/chat agents, sequential handoffs, tool use, state, and guardrails; relevant if the system needs specialist agents rather than one giant prompt.
- Caveat: Demo code and model names/configuration can change. Verify against current official docs and your deployed stack.

### 5. Jukeyman — Voice Agents skill

- Resource: [SKILL.md on GitHub](https://github.com/jukeyman/jukeyman-skills/blob/main/skills/voice-agents/SKILL.md)
- Type: Community skill, about 25 KB, attributed in its frontmatter to vibeship-spawner-skills (Apache 2.0).
- Useful elements: broad architecture and implementation topics—speech-to-speech versus STT→LLM→TTS, VAD, interruptions, latency, noise, and voice-first output.
- Caveat: This is a broad technical skill, not just a prompt template. Its performance figures and provider/model recommendations are time-sensitive and should be independently checked. Review the license and upstream attribution before reuse.

### 6. James Hill / RizzDial — AI Voice Agent Prompts

- Resource: [ai-voice-agent-prompts](https://github.com/jbrazy480/ai-voice-agent-prompts)
- Type: Installable Claude Code skill, builder, templates, and vertical prompt library; repository says it is MIT licensed.
- Useful elements: reusable prompt-building workflow, industry examples, booking/call-flow sections, and a twelve-part sales-agent framework.
- Caveat: Strongly oriented to outbound sales, booking, and conversion psychology. Repository claims about scale or performance are author claims, not independently established by this audit. Avoid importing pressure tactics into neutral customer support, healthcare, finance, or other sensitive contexts. Check current license and integrations before use.

## Recommended use

1. Choose the closest architecture and runtime first: speech-to-speech versus a chained STT–LLM–TTS pipeline. Prompt behavior cannot repair turn-detection or audio-runtime defects by itself.
2. Start with a short, platform-neutral prompt structure, then add only sections the use case needs.
3. Use provider-specific examples as patterns, not as guaranteed rules. Preserve source links and note every adaptation.
4. Keep business truth, authorization, tool schemas, privacy controls, and irreversible-action enforcement in the appropriate backend/runtime layer—not only in natural-language instructions.
5. Test with the actual deployed model, transcription, TTS, tools, and noisy-call conditions. Maintain representative transcripts and regression checks.

## Combined audit checklist

Use this to audit a standard voice agent prompt and its surrounding implementation. Mark each item **Pass / Fail / N/A** and record evidence. This checklist is a synthesis, not a verbatim source document.

### Provenance and compatibility

- [ ] Source, author/maintainer, URL, license, retrieval date, and any modifications are recorded.
- [ ] Prompt matches the actual model, voice stack, tools, and deployment mode.
- [ ] Current API/tool names, schemas, and configuration are verified against the runtime.
- [ ] Platform-specific instructions and examples are clearly labeled rather than presented as universal.
- [ ] Time-sensitive performance claims are verified or removed.

### Role and outcome

- [ ] Agent identity and organization are accurate.
- [ ] Primary responsibilities are bounded and understandable.
- [ ] A successful interaction is defined in observable terms.
- [ ] Typical caller context and channel constraints are stated only when useful.
- [ ] Tone is expressed as a small number of observable behaviors, without repetitive synonyms.

### Voice interaction

- [ ] Spoken replies are brief by default and front-load the answer.
- [ ] Agent asks one question at a time when collecting information.
- [ ] Spoken output avoids visual-only formatting unless the channel supports it.
- [ ] Dates, times, quantities, names, emails, phone numbers, and identifiers have suitable spoken forms.
- [ ] Unclear, clipped, noisy, or conflicting audio leads to clarification, not guessing.
- [ ] Silence, background audio, side conversations, interruptions, and barge-in behavior are defined for the runtime.
- [ ] Language choice is explicit enough to avoid unintended switching; accent is not confused with language.
- [ ] Examples sound natural when read aloud and do not contain unsupported stage directions or TTS tags.

### Conversation flow and scope

- [ ] The workflow has clear stages and criteria for moving between them, if the task needs a flow.
- [ ] Required information is collected only as needed, preferably one critical value at a time.
- [ ] In-scope tasks are explicit.
- [ ] Out-of-scope requests have a useful fallback instead of a dead-end refusal.
- [ ] The agent does not invent facts, policies, availability, commitments, or completed actions.
- [ ] Handoff, escalation, emergency, repeated-confusion, and human-request triggers are explicit where relevant; ambiguous representative/customer care requests confirm caller intent (e.g. sales vs support) before routing or collecting data.
- [ ] Domain-specific safeguards are tailored by qualified owners; generic text is not treated as compliance certification.

### Tools and exact data

- [ ] Prompt tool names match the tools actually available.
- [ ] Each tool has explicit trigger conditions, required inputs, and result-handling rules.
- [ ] Read-only and write actions have different confirmation policies where appropriate.
- [ ] Exact identifiers are captured conservatively; ambiguous values are clarified.
- [ ] High-impact or irreversible actions require the appropriate confirmation and authorization.
- [ ] Tool failure handling includes a bounded retry or a safe alternative, not repeated identical calls.
- [ ] The agent only reports success after the system confirms success.
- [ ] Backend code enforces permissions, validation, privacy, and other reliability-critical rules.

### Prompt quality

- [ ] Instructions are structured with short, meaningful section labels.
- [ ] Requirements do not contradict each other or overuse “always,” “never,” “must,” or “only.”
- [ ] Hard requirements, defaults, exceptions, and priorities are distinguishable.
- [ ] The prompt is no longer than necessary; redundant rules and irrelevant examples are removed.
- [ ] Examples cover normal flow, ambiguity, correction, interruption, tool failure, and escalation as relevant.
- [ ] Prompt changes are reviewed for regressions rather than assumed beneficial.

### Evaluation and operations

- [ ] Test cases include ordinary calls, accents/noise, interruptions, silence, corrections, edge cases, and out-of-scope requests.
- [ ] Tool-use tests check both correct calls and prohibited calls.
- [ ] Spoken outputs are listened to in the actual TTS voice, not only inspected as text.
- [ ] Latency, transcription quality, task completion, escalation, and user correction are monitored where applicable.
- [ ] Representative production failures become regression tests.
- [ ] Prompt-only controls are not used where deterministic runtime enforcement is required.
- [ ] A named owner, review date, and rollback path exist for production prompt changes.

## Audit record template

| Field | Record |
|---|---|
| Agent/use case | [ ] |
| Platform, model, STT/TTS | [ ] |
| Prompt version / commit | [ ] |
| Source files and licenses | [ ] |
| Reviewer and date | [ ] |
| Critical risks / unresolved issues | [ ] |
| Tests run and results | [ ] |
| Release decision | [ ] |
| Rollback version | [ ] |

## Source links

- [OpenAI Realtime prompting](https://developers.openai.com/api/docs/guides/voice-prompting)
- [Deepgram voice-agent prompting](https://developers.deepgram.com/docs/prompting-voice-agents)
- [LiveKit prompting guide](https://docs.livekit.io/agents/start/prompting/)
- [OpenAI Realtime Agents repository](https://github.com/openai/openai-realtime-agents)
- [Jukeyman voice-agents skill](https://github.com/jukeyman/jukeyman-skills/blob/main/skills/voice-agents/SKILL.md)
- [James Hill / RizzDial voice-agent prompts](https://github.com/jbrazy480/ai-voice-agent-prompts)
