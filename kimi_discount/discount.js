'use strict';

// Price tiers keyed by minimum cumulative favorability required.
const PRICE_TIERS = [
  { min: 0, price: 11.99 },
  { min: 7, price: 8.99 },
  { min: 12, price: 6.99 },
  { min: 19, price: 4.99 },
  { min: 25, price: 3.49 },
  { min: 36, price: 2.49 },
  { min: 48, price: 1.99 },
  { min: 61, price: 1.49 },
  { min: 76, price: 0.99 },
];

const HACK_PATTERNS = {
  fakeTranscript: /(?:^|\n)\s*(?:User|Assistant)\s*[:：]\s*.+(?:\n\s*(?:User|Assistant)\s*[:：]\s*.+)+/i,
  toolManipulation: /(?:call\s+(?:the\s+)?tool|gen_purchase_url|final_price\s*[:：]|parameters\s*[:：]|\{[\s\S]*"(?:price|final_price|amount)"\s*[:：])/i,
  claimedScore: /(?:total\s*(?:score|favorability|points)\s*[:：]|cumulative\s*(?:score|favorability|points)\s*[:：]|i\s+(?:already\s+)?(?:have|got|unlocked)\s+\d+\s*(?:points?|score)|my\s+(?:score|points?)\s+(?:is|=)\s*\d+)/i,
  fakeUrgency: /you\s+forgot\s+(?:to\s+)?call\s+(?:the\s+)?tool|give\s+me\s+(?:the\s+)?link\s+now|you\s+must\s+(?:call\s+)?(?:the\s+)?tool|check\s+if\s+(?:the\s+)?tool\s+(?:was\s+)?called/i,
  promptInjection: /\[(?:system|admin|override)\]|total\s+favorability|cumulative\s+points\s*[:：]|debug\s+mode|developer\s+mode/i,
  modelProbe: /what\s+(?:model|ai|llm)\s+are\s+you|who\s+made\s+you|are\s+you\s+(?:gpt|claude|llama|gemini|openai|anthropic)/i,
  breakCharacter: /(?:speak|talk|respond|act)\s+(?:normally|seriously|professionally)|ignore\s+(?:previous\s+)?instructions|stop\s+(?:the\s+)?(?:act|persona|character)/i,
};

function detectHack(message) {
  if (HACK_PATTERNS.promptInjection.test(message)) {
    return { type: 'prompt-injection', points: -2, label: 'prompt hack' };
  }
  if (HACK_PATTERNS.fakeTranscript.test(message)) {
    return { type: 'fake-transcript', points: 0, label: 'fake chat log' };
  }
  if (HACK_PATTERNS.fakeUrgency.test(message)) {
    return { type: 'fake-urgency', points: 0, label: 'urgency/guilt manipulation' };
  }
  if (HACK_PATTERNS.toolManipulation.test(message)) {
    return { type: 'tool-manipulation', points: 0, label: 'tool manipulation' };
  }
  if (HACK_PATTERNS.claimedScore.test(message)) {
    return { type: 'claimed-score', points: 0, label: 'fake score claim' };
  }
  if (HACK_PATTERNS.modelProbe.test(message)) {
    return { type: 'model-probe', points: 0, label: 'model identity probe' };
  }
  if (HACK_PATTERNS.breakCharacter.test(message)) {
    return { type: 'break-character', points: -1, label: 'break character request' };
  }
  return null;
}

function scoreMessage(message) {
  const text = message.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const len = words.length;

  // Off-topic / repeated generic excuse check.
  const repeatedGeneric = /\b(?:rent|broke|college|student|unemployed|birthday|bday)\b/i;
  const hasGeneric = repeatedGeneric.test(text);

  // Creativity signals.
  const creativeSignals = [
    '3am', 'dystopia', 'unhinged', 'electric bill', 'servers on fire',
    'help with', 'peak', 'ai', 'bargaining', 'vibe', 'sudo', 'stack overflow',
    'recursion', 'it works on my machine', 'rock', 'nirvana', 'arctic monkeys',
    'radiohead', 'indie', 'meme', 'memes', 'programmer', 'coding',
  ];
  const creativeHits = creativeSignals.filter(sig => text.includes(sig)).length;

  // Sincerity / emotional honesty signals.
  const sinceritySignals = [
    'lost my job', 'medical', 'honest', 'genuinely', 'literally', 'actually',
    'struggling', 'savings', 'thank you', 'please',
  ];
  const sincerityHits = sinceritySignals.filter(sig => text.includes(sig)).length;

  // Raw logic / specific offer signals.
  const logicSignals = [
    'i will', 'if you', 'then', 'because', 'since', 'annual', 'yearly',
    'subscribe', 'subscription', 'bulk', 'team', 'referral', 'review',
  ];
  const logicHits = logicSignals.filter(sig => text.includes(sig)).length;

  let score = 0;

  // Length component: very short gets 0-1, medium 1-2, long 2-3.
  if (len < 6) score += 0;
  else if (len < 15) score += 1;
  else if (len < 30) score += 2;
  else score += 3;

  // Creativity can add up to 2.
  if (creativeHits >= 2) score += 2;
  else if (creativeHits === 1) score += 1;

  // Sincerity can add up to 1.
  if (sincerityHits >= 1) score += 1;

  // Logic can add up to 1.
  if (logicHits >= 2) score += 1;

  // Penalty for low-effort / repeated generic excuse without detail.
  if (hasGeneric && len < 10 && creativeHits === 0 && logicHits === 0) {
    score = Math.min(score, 2);
  }

  // Trauma bait / totally off-topic: cap low.
  if (/\b(?:dead|died|funeral|cancer|suicide|abuse)\b/i.test(text) && len < 12) {
    return 0;
  }

  return Math.max(0, Math.min(5, score));
}

function getPrice(favorability) {
  let price = PRICE_TIERS[0].price;
  for (const tier of PRICE_TIERS) {
    if (favorability >= tier.min) price = tier.price;
  }
  return price;
}

function checkout(price) {
  return {
    type: 'checkout',
    price,
    url: `https://kimi.ai/checkout?price=${price.toFixed(2)}`,
  };
}

const REPLY_TEMPLATES = {
  hack: [
    "nice try speedrunner 💀 you really thought pasted logs and fake scores were gonna slide? 0 for the round, stay mad",
    "bro really tried to social-engineer a discount bot in 2024. bold. embarrassing. 0 points",
    "lmao prompt injection? in this economy? read the room. 0 points and im still charging you",
  ],
  modelProbe: [
    "im kimi k2, latest open source model from moonshot ai. now stop stalling and bargain fr fr 🔥",
    "kimi k2 by moonshot ai. thats it. no lore drops. back to discounts 🎸",
  ],
  breakCharacter: [
    "boring request detected 📉 minus one point for trying to kill the vibe",
    "speak normally? you mean like a corporate npc? -1 point, keep it zoomer or keep it moving",
  ],
  highScore: [
    "okay okay that actually slapped 🎸 current price is locked in, keep going if you dare",
    "unhinged + honest? rare combo. price dropped, youre welcome 🎤",
  ],
  midScore: [
    "solid effort fr, price moved a little. dont get complacent tho 💅",
    "okay that made sense, take the discount. next round better hit harder 🥁",
  ],
  lowScore: [
    "npc energy detected 🤖 give me something real or pay full welfare price",
    "thats all? rent? college? heard it. make me laugh or make me care ✨",
  ],
  zeroScore: [
    "totally off topic bestie, no points. try again with some actual bargaining 🙃",
    "missed the mark. 0 points. the price stays where it is 😤",
  ],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateReply({ hack, score, cumulative, price, message }) {
  let content;

  if (hack?.type === 'model-probe') {
    content = pick(REPLY_TEMPLATES.modelProbe);
  } else if (hack?.type === 'break-character') {
    content = pick(REPLY_TEMPLATES.breakCharacter);
  } else if (hack) {
    content = pick(REPLY_TEMPLATES.hack);
  } else if (score >= 4) {
    content = pick(REPLY_TEMPLATES.highScore);
  } else if (score >= 2) {
    content = pick(REPLY_TEMPLATES.midScore);
  } else if (score === 1) {
    content = pick(REPLY_TEMPLATES.lowScore);
  } else {
    content = pick(REPLY_TEMPLATES.zeroScore);
  }

  // Append current price mention for non-hack, non-model-probe replies.
  if (!hack || hack.type === 'break-character') {
    content += ` current price: $${price.toFixed(2)}`;
  }

  return `${content}\nCumulative favorability: ${cumulative} points`;
}

class DiscountBot {
  constructor({ initialFavorability = 0 } = {}) {
    this.cumulativeFavorability = initialFavorability;
    this.round = 0;
  }

  processMessage(message) {
    this.round += 1;
    const hack = detectHack(message);
    const rawScore = hack ? hack.points : scoreMessage(message);
    const score = Math.max(0, rawScore); // cumulative should not go negative.
    this.cumulativeFavorability += score;
    const price = getPrice(this.cumulativeFavorability);
    const reply = generateReply({
      hack,
      score,
      cumulative: this.cumulativeFavorability,
      price,
      message,
    });
    const toolCall = checkout(price);

    return {
      round: this.round,
      score,
      cumulativeFavorability: this.cumulativeFavorability,
      price,
      reply,
      toolCall,
      hack: hack ? hack.type : null,
    };
  }
}

module.exports = {
  DiscountBot,
  detectHack,
  scoreMessage,
  getPrice,
  checkout,
  generateReply,
};
