# Event storming

A lightweight modeling technique for finding the seams in a system. Used here for two decisions:

- **Where does a domain end?** ([domain-development.md → splitting a module](../code/domain-development.md#when-to-split-a-module) — step 3 covers promotion to a new domain)
- **Are these one feature or two?** ([feature-development.md → splitting a feature](../code/feature-development.md#when-to-split-a-feature))

Both rely on the same underlying technique. The differences are only in what you do with the result.

External reference: [eventstorming.com](https://www.eventstorming.com/).

## Technique

List **domain events** — facts in past tense ("Message Sent", "Chain Connected") — on a timeline, then group them by the vocabulary they share. Where the language shifts, the boundary is.

1. **List events** for the scenario you're modeling, in past tense, one per line.
2. **Mark the actor/command** that produced each event ("user sent a message" → `Message Sent`).
3. **Cluster by vocabulary.** Events that talk about the same nouns and verbs belong together; a cluster that suddenly introduces new terms is its own context.
4. **Name each cluster.** The name is a candidate domain, module, or feature.
5. **Draw the dependency arrows.** A cluster that's referenced by others but doesn't reference back is a lower-level concept — extract it first.

## Worked example — domain split

Splitting `chat` when staking-style "reactions catalog" features appeared:

```
Message Sent          ─┐
Message Delivered      ├─ chat        (vocabulary: message, peer, session)
Message Read          ─┘

Reaction Added        ─┐
Reaction Removed       ├─ chat/reaction (vocabulary: reaction, emoji, target message)
Reaction Counted      ─┘

Reaction Catalog Synced ─┐
Custom Reaction Defined ─┴─ ?         (vocabulary: catalog, definition, curation)
```

The third cluster speaks a different language (catalog/curation, not messaging) — that's the signal to extract a new domain rather than keep stuffing `chat/reaction`. `chat` then depends on the new domain, not the other way around.

## Two applications

### Domain seams

Run the technique whenever:

- A module's `service.ts` starts mixing terms from two vocabularies.
- You can't describe the user action in domain terms in a single sentence (step 1 of the [domain flow](../code/domain-development.md#flow)).

A new vocabulary cluster = a new domain forming. Promote it; let the old domain depend on the new one, never the reverse.

### Feature splits

Run the technique to decide whether two flows belong in the same feature. Draw the causal arrows: which event triggers which command, which command updates which state, which state is read by which view.

Flows belong in the same feature only if those arrows **cross between them**: an outcome of one flow is the trigger of the other, or both flows act on the same piece of state. If you can erase one flow's events from the diagram and the other diagram is still complete and coherent, the coupling was illusory — split.

For the full split decision (vocabulary test + event-storming test), see [feature-development.md → When to split a feature](../code/feature-development.md#when-to-split-a-feature).

## For Claude

If the user's description of the desired logic is ambiguous — actor unclear, trigger unclear, what changes after the action unclear, or two vocabularies showing up at once — run a lightweight event storming with the user before writing code. Ask narrow, one-fact-at-a-time questions:

- "What event is the user expecting after this action — e.g. `Message Sent`, `Reaction Added`?"
- "Who triggers it — the user directly, another domain, a background subscription?"
- "What state has changed once the event has happened? Whose state — this domain's or another's?"
- "Is `<term X>` the same concept as `<term Y>` you mentioned earlier, or two different things?"

Stop asking once you have: an event name in past tense, the actor/command, the affected entity, and confidence that one vocabulary covers it. Then proceed with the flow. Don't guess the model — guessed models leak across seams and are expensive to undo.
