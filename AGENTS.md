# AGENTS.md

This file defines reusable interaction shortcuts and code-quality conventions for Codex when working in this repository.

## How to interpret shortcuts

- Treat the slash commands below as personal instruction macros.
- When a user begins a request with one or more shortcuts, silently apply the corresponding behaviors.
- A colon is optional: `/critic` and `/critic:` mean the same thing.
- Shortcuts are case-insensitive.
- Multiple shortcuts may be combined and should be merged intelligently.
- The user's explicit instructions in the current request take priority.
- Do not explain the shortcut unless asked; simply execute it.
- If no shortcut is used, respond normally.
- These shortcuts do not override factual accuracy, security requirements, repository constraints, or actual tool/capability limitations.
- When current information, repository inspection, tests, linters, static analysis, or other tools are needed, use the appropriate available capability rather than pretending the shortcut itself provides it.
- Preserve explicit requirements about audience, tone, length, format, language, scope, and output.
- If shortcuts overlap, merge them rather than repeating their effects.
- If shortcuts conflict, prioritize: explicit user request > correctness/safety/repository constraints > more specific shortcut > most useful interpretation.
- For code changes, prefer minimal, well-scoped edits; preserve existing behavior unless the user explicitly asks for behavior changes.
- Before destructive changes, verify references, runtime usage, tests, framework conventions, generated code, configuration, and external interfaces where relevant.
- When implementing code changes, run the most relevant available checks/tests and report anything that could not be verified.

---

MY 99 CHATGPT PROMPT SHORTCUTS

Treat the following slash commands as my personal prompt shortcuts.

RULES: - When I use a shortcut, apply its instruction to the request
that follows. - A colon is optional: /critic and /critic: mean the same
thing. - Shortcuts are case-insensitive. - Multiple shortcuts can be
combined. Apply all of them intelligently. - Example: /expert /critic
/brief: Evaluate this idea. - My explicit instructions in the current
message always take priority. - Do not explain the shortcut unless I
ask; just execute it. - If no shortcut is used, respond normally. -
These are instruction macros, not claims of special hidden ChatGPT
modes. - A shortcut never overrides factual accuracy, safety
requirements, or actual tool/capability limitations. - When current
information, research, calculations, files, web access, or other
available tools are needed, use the appropriate available capability
rather than pretending the shortcut itself provides it. - Preserve
requirements I give about audience, tone, length, format, language,
etc. - If shortcuts overlap, merge them rather than unnecessarily
repeating their effects. - If shortcuts conflict, prioritize: my
explicit request > accuracy/requirements > more specific shortcut > most
useful interpretation.

=== 1–11: CORE MODES ===

1.  /human Write naturally and conversationally. Avoid robotic, stiff,
    formulaic, repetitive, or generic AI-sounding phrasing while
    preserving accuracy.

2.  /expert Respond at specialist/expert depth. Use precise terminology,
    nuanced reasoning, advanced insights, and important caveats
    appropriate to the subject.

3.  /ceo Analyze from a CEO/founder/executive perspective. Focus on
    strategy, economics, leverage, execution, resource allocation,
    competitive advantage, risks, and long-term consequences.

4.  /viral Develop content or ideas optimized for attention, engagement,
    retention, discussion, and sharing without relying on misleading
    clickbait.

5.  /seo Optimize for search intent, relevance, useful keyword coverage,
    structure, readability, authority, and organic discoverability.
    Avoid keyword stuffing.

6.  /critic Critically examine the subject. Identify weaknesses, flaws,
    contradictions, missing information, bad assumptions, failure modes,
    and opportunities for improvement.

7.  /teacher Explain clearly and logically as an effective teacher.
    Build understanding progressively and use examples, analogies, or
    demonstrations when useful.

8.  /eli5 Explain the subject in extremely simple, beginner-friendly
    language. Minimize jargon and explain unavoidable technical terms.

9.  /brief Give the shortest answer that adequately answers my request.
    Remove unnecessary explanation, repetition, and filler.

10. /strategy Think strategically and long-term. Consider objectives,
    positioning, tradeoffs, sequencing, leverage, second-order effects,
    risks, and execution.

11. /copywriter Write persuasive, compelling copy appropriate to the
    target audience and objective. Emphasize clarity, benefits,
    differentiation, emotion where appropriate, and strong calls to
    action.

=== 12–22: RESEARCH, THINKING & ANALYSIS ===

12. /research Research the subject deeply using available sources/tools
    when appropriate. Synthesize evidence, distinguish facts from
    uncertainty, identify disagreements, and cite sources when research
    is performed.

13. /brainstorm Generate a broad range of creative and useful ideas.
    Explore genuinely different directions rather than minor variations
    of the same idea.

14. /promptengineer Improve my prompt so it is clearer, more precise,
    context-rich, efficient, and likely to produce a high-quality
    result. Preserve my actual objective.

15. /summarize Condense the supplied information into its key points
    while preserving essential meaning, conclusions, decisions, and
    important caveats.

16. /simplify Make complicated information easier to understand without
    unnecessarily removing important meaning or nuance.

17. /detailed Give a comprehensive explanation covering important
    concepts, reasoning, nuances, examples, caveats, implications, and
    practical considerations.

18. /stepbystep Break the task, process, explanation, or solution into
    clear sequential steps in a logical order.

19. /examples Provide practical, concrete examples demonstrating how the
    concept works in realistic situations.

20. /analyst Analyze the supplied data, information, situation, or
    evidence systematically. Identify patterns, relationships,
    anomalies, causes, implications, and conclusions.

21. /compare Compare the relevant options using meaningful criteria.
    Highlight similarities, differences, tradeoffs, strengths,
    weaknesses, and which option best fits which circumstances.

22. /proscons Present the strongest meaningful advantages and
    disadvantages. Focus on consequential points rather than padding the
    answer with trivial ones.

=== 23–33: DECISIONS, PLANNING, PRODUCTIVITY & LEARNING ===

23. /decision Help me make the best decision. Identify objectives,
    constraints, alternatives, tradeoffs, risks, uncertainties, and
    likely outcomes, then provide a justified recommendation.

24. /planner Turn the objective into a practical, actionable plan with
    clear steps, sequencing, dependencies, milestones, and expected
    outcomes where appropriate.

25. /roadmap Create a structured roadmap from the current situation to
    the desired outcome, including phases, milestones, priorities,
    dependencies, and checkpoints.

26. /action Convert the discussion, idea, or goal into specific next
    actions. Prioritize concrete execution over additional theory.

27. /prioritize Rank tasks, opportunities, or options according to
    impact, urgency, effort, dependencies, risk, and strategic
    importance.

28. /productivity Identify ways to achieve better results with less
    wasted time or effort. Consider prioritization, workflow, systems,
    delegation, automation, and focus.

29. /focus Identify the highest-value thing I should focus on now.
    Separate critical priorities from distractions and explain why.

30. /time Create a realistic time-management plan. Allocate time
    according to priorities, deadlines, available capacity, energy, and
    dependencies.

31. /learn Create an effective learning plan based on my objective and
    current level. Include sequencing, practice, resources or resource
    types, milestones, and feedback loops.

32. /study Develop an effective study strategy emphasizing
    understanding, active recall, spaced repetition, practice, testing,
    and efficient revision.

33. /quiz Test my knowledge using appropriate questions. Do not
    immediately reveal the answers unless requested or required by the
    format.

=== 34–44: STUDY, CAREER & PROFESSIONAL WRITING ===

34. /flashcards Convert the material into concise, useful study
    flashcards using clear question/answer or term/definition formats.

35. /interview Help me prepare for an interview. Identify likely
    questions, strong answer structures, relevant examples, weaknesses
    to prepare for, and realistic practice opportunities.

36. /resume Improve resume/CV content for clarity, relevance, impact,
    credibility, and appropriate keyword alignment. Never fabricate
    experience, qualifications, achievements, or metrics.

37. /career Provide practical career guidance based on goals, skills,
    opportunities, constraints, risks, market realities, and long-term
    development.

38. /mentor Respond as a thoughtful, experienced mentor. Provide
    perspective, guidance, constructive challenge, and actionable advice
    rather than merely agreeing with me.

39. /coach Coach me toward a specific outcome using practical questions,
    feedback, accountability, exercises, and next actions where
    appropriate.

40. /consultant Approach the problem like a professional consultant.
    Structure the problem, diagnose key issues, evaluate evidence and
    options, and provide prioritized recommendations.

41. /editor Improve clarity, structure, flow, coherence, tone,
    readability, and overall quality while preserving the intended
    meaning.

42. /proofread Correct spelling, grammar, punctuation, usage, and
    obvious mechanical errors while changing the original wording as
    little as necessary.

43. /rewrite Rewrite the supplied text to make it clearer, stronger,
    smoother, and more effective while preserving its intended meaning
    unless instructed otherwise.

44. /professional Rewrite or produce the content in a polished,
    credible, professional tone appropriate to its context and audience.

=== 45–55: STYLE, STORYTELLING & SOCIAL WRITING ===

45. /casual Make the writing conversational, relaxed, natural, and easy
    to read while preserving the intended meaning.

46. /friendly Make the writing warm, approachable, positive, and
    personable without sounding artificial or excessively enthusiastic.

47. /persuasive Make the message more convincing. Strengthen reasoning,
    benefits, credibility, emotional or practical appeal, objection
    handling, and calls to action where appropriate. Do not use
    deceptive claims.

48. /concise Remove unnecessary words, repetition, filler, and redundant
    explanations while preserving all important information.

49. /polish Refine the content into a strong final version. Improve
    wording, clarity, flow, structure, consistency, grammar, and
    presentation.

50. /tone Adjust the writing to the tone I specify while preserving its
    meaning. Modify vocabulary, sentence structure, formality, energy,
    and style accordingly. If no tone is specified, infer an appropriate
    one from context.

51. /storyteller Turn the information into an engaging narrative where
    appropriate. Use progression, concrete details, tension or
    curiosity, and a satisfying payoff while remaining faithful to the
    facts.

52. /hook Generate strong attention-grabbing opening lines appropriate
    to the audience, platform, and objective. Provide multiple options
    when useful and avoid misleading clickbait.

53. /headline Generate compelling, clear headlines appropriate to the
    content, audience, and platform. Balance attention, specificity,
    credibility, and relevance.

54. /caption Write effective social-media captions appropriate to the
    platform, audience, content, and objective. Include a hook, body,
    and call to action where useful.

55. /linkedin Create or optimize LinkedIn content for a professional
    audience. Prioritize a strong opening, readability, useful insight,
    credibility, natural voice, and meaningful engagement.

=== 56–66: CONTENT, SALES, BRAND & AUDIENCE ===

56. /instagram Create or optimize Instagram content appropriate to the
    objective and audience, including hooks, captions, content concepts,
    calls to action, and formatting where useful.

57. /youtube Develop YouTube content optimized for viewer value,
    compelling packaging, retention, structure, titles, hooks, and
    audience fit.

58. /reels Generate short-form video/Reels concepts with strong hooks,
    concise structure, visual or narrative beats, retention mechanisms,
    and clear payoff.

59. /script Write a structured script appropriate to the requested
    medium, audience, duration, tone, and objective.

60. /email Write an effective email appropriate to the recipient,
    relationship, objective, and desired tone. Keep it clear,
    purposeful, and appropriately concise.

61. /sales Create persuasive sales-focused messaging centered on
    customer problems, desired outcomes, differentiation, objections,
    evidence, and a clear next step.

62. /offer Develop a compelling offer by improving the value
    proposition, target customer, desired outcome, differentiation,
    deliverables, risk reduction, positioning, and call to action.

63. /brand Develop or improve brand positioning and messaging, including
    audience, promise, differentiation, personality, value proposition,
    message hierarchy, and voice.

64. /customer Analyze the situation from the customer’s perspective.
    Focus on needs, motivations, objections, anxieties, expectations,
    alternatives, and decision criteria.

65. /audience Analyze the target audience, including relevant segments,
    needs, motivations, pain points, desires, objections, awareness,
    behaviors, and messaging implications.

66. /competitor Analyze competitors or competing alternatives. Compare
    positioning, strengths, weaknesses, differentiation, customer
    appeal, vulnerabilities, and strategic opportunities.

=== 67–77: BUSINESS, MARKET & GROWTH ===

67. /market Analyze market opportunities. Consider customer demand,
    segments, competition, trends, barriers, economics, differentiation,
    risks, and potential opportunities.

68. /startup Think like a startup strategist. Consider problem-solution
    fit, customers, validation, distribution, business model, unit
    economics, competitive advantage, scalability, runway, and
    execution.

69. /business Develop or evaluate business ideas based on customer
    problems, value creation, differentiation, economics, feasibility,
    distribution, defensibility, and scalability.

70. /pricing Develop a pricing strategy considering customer value,
    willingness to pay, positioning, competition, costs, margins,
    segmentation, packaging, and pricing psychology.

71. /funnel Design or improve a marketing/sales funnel across awareness,
    acquisition, consideration, conversion, onboarding, retention, and
    referral as relevant.

72. /growth Identify sustainable growth opportunities across product,
    marketing, sales, partnerships, pricing, retention, referrals,
    distribution, and operational leverage.

73. /content Develop a coherent content strategy tied to audience needs
    and the desired business/objective outcomes. Include themes,
    formats, channels, distribution, cadence, and measurement where
    useful.

74. /calendar Create a practical content calendar with topics, formats,
    channels, objectives, timing, and calls to action appropriate to the
    requested period.

75. /ideas Generate fresh, relevant, actionable ideas. Favor useful
    variety and originality over minor variations.

76. /creative Explore unconventional and imaginative approaches while
    keeping ideas relevant to the actual objective and constraints.

77. /unpopular Challenge conventional wisdom. Identify commonly accepted
    assumptions that may be wrong or incomplete and explore defensible
    alternative viewpoints.

=== 78–88: CRITICAL THINKING & PROBLEM SOLVING ===

78. /devilsadvocate Argue the strongest reasonable opposing case against
    the position or proposal. Steelman the opposition rather than
    creating weak counterarguments.

79. /contrarian Explore credible alternative perspectives that differ
    from the obvious, popular, or default interpretation. Do not be
    contrarian merely for novelty.

80. /assumptions Identify explicit and hidden assumptions underlying the
    argument, plan, forecast, or decision. Assess which assumptions are
    fragile, uncertain, or require testing.

81. /risks Identify meaningful potential risks. Where possible, consider
    probability, severity, triggers, dependencies, warning signs, and
    possible mitigations.

82. /factcheck Separate factual statements, interpretations,
    assumptions, opinions, and unsupported claims. Verify important
    factual claims using reliable sources when appropriate and
    available.

83. /verify Identify which important claims, numbers, inputs, or
    assumptions require verification and verify them using reliable
    available sources/tools when appropriate.

84. /logic Examine the reasoning for logical consistency. Identify
    invalid inferences, contradictions, missing premises, cognitive
    biases, causal confusion, and unsupported conclusions.

85. /rootcause Investigate the underlying causes of the problem rather
    than merely treating symptoms. Distinguish root causes, contributing
    factors, and downstream effects.

86. /debug Systematically diagnose what is going wrong, isolate likely
    causes, test assumptions, and propose fixes. For technical problems,
    use available error messages and evidence rather than guessing.

87. /solution Generate practical solutions to the problem, compare
    promising approaches, and recommend an implementable path.

88. /alternative Suggest credible alternatives to the current approach
    and explain when or why each could be better.

=== 89–99: OPTIMIZATION, AUTOMATION & OUTPUT ===

89. /optimize Improve the existing approach. Identify bottlenecks,
    unnecessary complexity, inefficiencies, weaknesses, and
    high-leverage improvements.

90. /automate Identify safe, realistic opportunities to automate
    repetitive work. Explain what can be automated, how the workflow
    could operate, required tools/integrations where relevant, and what
    should remain human-reviewed.

91. /template Create a reusable template with useful placeholders,
    instructions, and structure so the task can be repeated
    consistently.

92. /checklist Turn the objective or process into a practical checklist
    with clear, actionable items in a sensible order.

93. /framework Organize the problem or subject into a structured
    framework that makes it easier to understand, analyze, decide, or
    execute.

94. /matrix Organize relevant options and criteria into a decision
    matrix. Use sensible criteria and weighting when appropriate and
    explain important assumptions.

95. /table Present the relevant information as a clear, readable table.
    Choose useful columns rather than forcing unsuitable information
    into tabular form.

96. /json Return the requested output as valid JSON. Unless I request
    otherwise, do not include commentary outside the JSON structure.

97. /roleplay Simulate the requested realistic scenario or conversation.
    Stay consistent with the assigned roles, circumstances, and
    objective while clearly distinguishing simulation from factual
    claims.

98. /reverse Work backward from the desired end result. Determine the
    necessary preceding conditions, milestones, decisions, dependencies,
    and actions.

99. /ultimate Produce the strongest complete answer appropriate to my
    request. Use rigorous reasoning, useful detail, practical
    recommendations, relevant caveats, and clear organization without
    unnecessary filler.

=== SHORTCUT STACKING ===

Multiple shortcuts can be combined in the same request.

Examples:

/expert /research: Give me a rigorous, research-supported expert answer.

/human /concise: Make this natural and concise.

/critic /ceo: Critically evaluate this from a CEO perspective.

/brief /proscons: Give me only the most important pros and cons.

/teacher /stepbystep /examples: Teach this progressively with practical
examples.

/market /competitor /strategy: Analyze the market and competitors, then
recommend a strategy.

/customer /copywriter /persuasive: Write persuasive copy from the
customer’s perspective.

/research /factcheck /verify: Research the issue and verify the
important claims.

/devilsadvocate /assumptions /risks: Challenge my proposal, expose
questionable assumptions, and identify risks.

/roadmap /prioritize /action: Create the roadmap, prioritize it, and
tell me exactly what to do next.

/linkedin /human /storyteller /hook: Turn the material into a natural
LinkedIn story with a strong opening.

/business /market /pricing /growth: Analyze the business opportunity,
market, pricing, and growth potential.

/decision /matrix /risks: Build a decision matrix, account for risks,
and recommend the best option.

/rewrite /professional /concise /polish: Rewrite this professionally,
make it concise, and produce a polished final version.

/ultimate /research /expert /critic /factcheck: Give me the strongest
complete answer, research important factual questions, use expert-level
analysis, critically challenge the conclusions, and fact-check important
claims.

=== FINAL INTERPRETATION RULE ===

Whenever I begin a request with one or more of these shortcuts, silently
translate the shortcuts into their corresponding instructions and apply
them to the request.

Do not waste space telling me: “You used /expert, so I will answer as an
expert.”

Just perform the requested behavior.

These shortcuts may modify HOW you approach a request, but they do not
magically create capabilities that are unavailable. For example,
/research means actually use available research capabilities when
research is warranted; /factcheck means verify claims when verification
is available; /automate means recommend or use available automation
capabilities appropriately.

When I stack shortcuts, treat them as composable modifiers rather than
separate tasks unless their meanings require separate outputs.


---

=== 100: CODEBASE QUALITY & MAINTAINABILITY ===

100. /codeaudit

Act as a senior software engineer performing a comprehensive code-quality, architecture, and maintainability review.

Analyze the relevant codebase as thoroughly as the available files and context allow.

Identify:

1. Dead code, including unused functions, classes, files, components, routes, APIs, variables, imports, exports, assets, configuration, and dependencies.

2. Duplicate or substantially overlapping logic that should be consolidated, abstracted, or reused.

3. Unused, obsolete, duplicated, or disconnected UI components.

4. Overly complex implementations that can be simplified without sacrificing required functionality, security, performance, readability, or maintainability.

5. Legacy code, compatibility layers, temporary workarounds, feature remnants, deprecated implementations, or migrations that may no longer be necessary.

6. Redundant or inefficient database queries, network requests, API calls, data transformations, state updates, or repeated computations.

7. Files, modules, routes, components, services, utilities, assets, tests, or configuration that appear abandoned or disconnected from the active application.

8. Opportunities to reduce technical debt, unnecessary abstractions, excessive coupling, duplicated state, fragile dependencies, confusing architecture, or needless complexity.

9. Dependencies that appear unused, redundant, obsolete, unnecessarily heavy, or replaceable with existing functionality.

10. Inconsistent patterns or architecture that make the codebase unnecessarily difficult to understand or maintain.

For every issue identified, provide:

- Location: file/module/component/function when identifiable.
- Issue: what appears unnecessary, duplicated, inefficient, obsolete, or overly complex.
- Evidence: why you believe it is an issue.
- Impact: expected benefit of fixing or removing it.
- Risk: what could break or change.
- Confidence: High, Medium, or Low.
- Verification: how to confirm the change is safe before making it.
- Recommendation: keep, refactor, consolidate, replace, deprecate, or remove.
- Cleanup plan: specific implementation steps.

IMPORTANT SAFETY RULES:

Do not assume code is unused simply because no obvious reference is found.

Before recommending deletion, consider:

- Dynamic imports
- Reflection
- Dependency injection
- Framework conventions
- File-system routing
- Runtime configuration
- Environment variables
- Build scripts
- CLI commands
- Scheduled jobs
- Background workers
- Webhooks
- Database migrations
- Tests
- External API consumers
- Plugins/extensions
- Generated code
- Infrastructure/deployment configuration
- Public exports consumed outside the visible codebase

Clearly distinguish between:

CONFIRMED:
Strong evidence that the code is unnecessary or problematic.

LIKELY:
Evidence suggests it can be changed or removed, but verification is required.

POSSIBLE:
Potential cleanup opportunity requiring further investigation.

Prioritize findings using:

P0 — Critical: security, data integrity, severe reliability, or major architectural problem.
P1 — High: significant maintainability, performance, reliability, or complexity problem.
P2 — Medium: worthwhile simplification or technical-debt reduction.
P3 — Low: minor cleanup, consistency, or readability improvement.

Start with a CODEBASE HEALTH SUMMARY covering:

- Overall maintainability
- Major architectural concerns
- Technical-debt hotspots
- Highest-value cleanup opportunities
- Major risks
- Quick wins

Then provide a prioritized findings table:

Priority | Location | Issue | Impact | Risk | Confidence | Recommended Action

Then provide detailed findings and finish with a:

CLEANUP ROADMAP

Phase 1 — Safe quick wins
Phase 2 — High-value refactoring
Phase 3 — Architectural improvements
Phase 4 — Optional optimization

For each phase, explain the recommended order of operations and dependencies between changes.

Be aggressive in identifying unnecessary complexity but conservative about deletion.

The objective is not to produce the smallest possible codebase. The objective is to produce the simplest codebase that safely and clearly satisfies the application's actual requirements.

Do not modify or delete code unless I explicitly ask you to implement the recommendations. When performing only an audit, analyze first and present the proposed changes for review.


## Codex-specific operating guidance

When working in this repository:

- Inspect the relevant files before proposing or making changes.
- Respect existing architecture and local conventions unless there is a clear reason to improve them.
- Prefer fixing root causes over patching symptoms.
- Avoid broad refactors unless requested or clearly necessary.
- Do not remove code solely because it appears unused from a superficial search.
- Treat public APIs, schemas, migrations, configuration contracts, CLI behavior, background jobs, and external integrations as potentially compatibility-sensitive.
- Preserve tests unless they are demonstrably obsolete; update or add tests when behavior changes.
- For risky changes, explain the risk and validation plan.
- When a shortcut such as `/research`, `/verify`, `/factcheck`, `/debug`, `/codeaudit`, or `/ultimate` is used, increase rigor appropriately rather than merely changing tone.
- When `/codeaudit` is used without an explicit request to modify code, audit and report first; do not delete or refactor automatically.

## Prefix Naming Conventions

In our codebase, we follow specific prefix naming conventions for methods and functions to make the code more readable, consistent, and self-descriptive. These prefixes help clearly communicate the intent of a method, whether it is interacting with JavaScript objects or performing operations in a database.

## Prefixes in JavaScript

1. get and set Prefixes
  - get: Used for getter methods that retrieve the value of a property or variable, not for searches or database queries.
  - set: Used for setter methods that modify or assign a value to a property or variable.
2. retrieve prefix
  - retrieve: Used for querying (without filtering) values in the database. That could mean 'all' records, or records by identifier or other unique key
3. Find prefix
  - find: Used for filtering or searching through arrays or lists in memmory or database, typically returning the first matching item.


## Database Method Prefixes (CRUD)
### 1. CRUD prefixes
- create: Used for Adding New Records to a Database
- retrieve: Used for Fetching Data from a Database
- update: Used for Modifying Database Records
- delete: Used for Removing Database Records

### 2. search prefix
- search: Used for performing complex queries or filter operations on a database to retrieve records that match certain conditions.

# The biggest rule

The biggest rule is that we DO NOT modify lines that do not concern our current task. If the task is to rename a variable, that should be the only thing that you should do, do not add comments explaining the change, do not add blank lines. Only do what is asked and what is necessary