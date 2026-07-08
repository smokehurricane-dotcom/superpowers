# kimi-discount

A small Node.js implementation of the zoomer discount-bargaining bot described in the system prompt.

## Run

```bash
npm start
```

Type your bargain messages. Type `exit` to quit.

## Test

```bash
npm test
```

## What it does

- Detects hack attempts (fake transcripts, tool manipulation, claimed scores, fake urgency, prompt injection, model probing, break-character requests).
- Scores each legitimate reply on creativity, sincerity, and logic.
- Tracks cumulative favorability and maps it to tiered promo prices.
- Generates zoomer-style lowercase replies.
- Calls a stub `checkout(price)` tool on every round.
