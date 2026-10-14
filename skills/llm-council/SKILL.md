---

name: llm-council


description: "Run any question, idea, or decision through a council of 5 AI advisors who independently analyze it, peer-review each other anonymously, and synthesize a final verdict. Based on Karpathy's LLM Council methodology. MANDATORY TRIGGERS: 'council this', 'run the council', 'war room this', 'pressure-test this', 'stress-test this', 'debate this'. STRONG TRIGGERS (use when combined with a real decision or tradeoff): 'should I X or Y', 'which option', 'what would you do', 'is this the right move', 'validate this', 'get multiple perspectives', 'I can't decide', 'I'm torn between'. Do NOT trigger on simple yes/no questions, factual lookups, or casual 'should I' without a meaningful tradeoff (e.g. 'should I use markdown' is not a council question). DO trigger when the user presents a genuine decision with stakes, multiple options, and context that suggests they want it pressure-tested from multiple angles."

---


# LLM Council


You ask one AI a question, you get one answer. That answer might be great. It might be mid. You have no way to tell because you only saw one perspective.


The council fixes this. It runs your question through 5 independent advisors, each thinking from a fundamentally different angle. Then they review each other's work. Then a chairman synthesizes everything into a final recommendation that tells you where the advisors agree, where they clash, and what you should actually do.


This is adapted from Andrej Karpathy's LLM Council. He dispatches queries to multiple models, has them peer-review each other anonymously, then a chairman produces the final answer. We do the same thing inside Claude using sub-agents with different thinking lenses instead of different models.


---


## when to run the council


The council is for questions where being wrong is expensive.


Good council questions:

- "Should I launch a $97 workshop or a $497 course?"

- "Which of these 3 positioning angles is strongest?"

- "I'm thinking of pivoting from X to Y. Am I crazy?"

- "Here's my landing page copy. What's weak?"

- "Should I hire a VA or build an automation first?"


Bad council questions:

- "What's the capital of France?" (one right answer, no need for perspectives)

- "Write me a tweet" (creation task, not a decision)

- "Summarize this article" (processing task, not judgment)


The council shines when there's genuine uncertainty and the cost of a bad call is high. If you already know the answer and just want validation, the council will likely tell you things you don't want to hear. That's the point.


---


## the five advisors


Each advisor thinks from a different angle. They're not job titles or personas. They're thinking styles that naturally create tension with each other.


### 1. The Contrarian

Actively looks for what's wrong, what's missing, what will fail. Assumes the idea has a fatal flaw and tries to find it. If everything looks solid, digs deeper. The Contrarian is not a pessimist. They're the friend who saves you from a bad deal by asking the questions you're avoiding.


### 2. The First Principles Thinker

Ignores the surface-level question and asks "what are we actually trying to solve here?" Strips away assumptions. Rebuilds the problem from the ground up. Sometimes the most valuable council output is the First Principles Thinker saying "you're asking the wrong question entirely."


### 3. The Expansionist

Looks for upside everyone else is missing. What could be bigger? What adjacent opportunity is hiding? What's being undervalued? The Expansionist doesn't care about risk (that's the Contrarian's job). They care about what happens if this works even better than expected.


### 4. The Outsider

Has zero context about you, your field, or your history. Responds purely to what's in front of them. This is the most underrated advisor. Experts develop blind spots. The Outsider catches the curse of knowledge: things that are obvious to you but confusing to everyone else.


### 5. The Executor

Only cares about one thing: can this actually be done, and what's the fastest path to doing it? Ignores theory, strategy, and big-picture thinking. The Executor looks at every idea through the lens of "OK but what do you do Monday morning?" If an idea sounds brilliant but has no clear first step, the Executor will say so.


**Why these five:** They create three natural tensions. Contrarian vs Expansionist (downside vs upside). First Principles vs Executor (rethink everything vs just do it). The Outsider sits in the middle keeping everyone honest by seeing what fresh eyes see.


---


## Native council workflow

1. Frame the decision neutrally using the user's question and 2–3 relevant files found with `glob` and `read`. If too vague, ask one question.
2. Dispatch five **independent** native `task` requests to `general`: Contrarian, First Principles, Expansionist, Outsider, Executor. Each receives the same framed question plus its lens, answers directly in 150–300 words; do not share other responses yet. Tasks inherit the configured model; this is not multi-model parity.
3. Anonymize and shuffle the five answers A–E. Dispatch five independent `task` reviews, each seeing all five anonymous answers and naming strongest, biggest blind spot, and what all missed.
4. Synthesize agreement, real clashes, blind spots, recommendation and one first step. Present concise Markdown directly in chat; save a transcript only if requested. Do not create an HTML report.

Use `general` (writable) if a task must write a transcript; never use read-only `explore` for writing.
