'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const DEFAULT_KB = path.join(__dirname, 'data', 'kb.json');
const DEFAULT_WEB = path.join(__dirname, 'data', 'external_web.json');

const STOP_WORDS = new Set(['in', 'on', 'at', 'is', 'a', 'an', 'the', 'and', 'or', 'of', 'for', 'with', 'to', 'about', 'are', 'was', 'were', 'it', 'its']);

function getKbPath() {
  return process.env.CRAG_KB || DEFAULT_KB;
}

function getWebPath() {
  return process.env.CRAG_WEB || DEFAULT_WEB;
}

function readDb(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0 && !STOP_WORDS.has(w));
}

function retrieveDocs(query) {
  const kbPath = getKbPath();
  const docs = readDb(kbPath);
  const queryTokens = Array.from(new Set(tokenize(query)));
  
  if (queryTokens.length === 0) {
    return docs.map(d => ({ doc: d, score: 0 }));
  }

  const results = docs.map(doc => {
    const docTokens = new Set(tokenize(doc.name + ' ' + doc.content));
    let matches = 0;
    for (const token of queryTokens) {
      if (docTokens.has(token)) {
        matches++;
      }
    }
    const score = matches / queryTokens.length;
    return { doc, score };
  });

  return results.sort((a, b) => b.score - a.score);
}

function evaluateRetrieval(score) {
  if (score >= 0.25) return 'CORRECT';
  if (score < 0.10) return 'INCORRECT';
  return 'AMBIGUOUS';
}

function refineKnowledge(content, query) {
  const queryTokens = new Set(tokenize(query));
  const sentences = content.split(/(?<=[.!?])\s+/);
  const keptSentences = sentences.filter(sentence => {
    const sentenceTokens = tokenize(sentence);
    return sentenceTokens.some(token => queryTokens.has(token));
  });
  return keptSentences.length > 0 ? keptSentences.join(' ') : content;
}

function searchWebSimulated(query) {
  const webPath = getWebPath();
  const webDocs = readDb(webPath);
  const queryTokens = new Set(tokenize(query));

  const matches = [];
  for (const doc of webDocs) {
    const docKeywords = doc.keywords.map(k => k.toLowerCase());
    const matchesKeyword = docKeywords.some(keyword => queryTokens.has(keyword));
    if (matchesKeyword) {
      matches.push(doc.content);
    }
  }
  return matches;
}

function callGeminiApi(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.candidates && parsed.candidates[0].content && parsed.candidates[0].content.parts) {
            resolve(parsed.candidates[0].content.parts[0].text);
          } else {
            reject(new Error('Invalid Gemini API response: ' + data));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function generateResponse(query, contextItems) {
  const contextStr = contextItems.join('\n');
  
  if (process.env.GEMINI_API_KEY) {
    const prompt = `You are a helpful assistant answering queries about local German businesses in Bielefeld.
    Generate a response to the query using the context below. If the context does not contain the answer, say you don't know.
    
    Query: ${query}
    
    Context:
    ${contextStr}`;
    
    try {
      return await callGeminiApi(prompt);
    } catch (err) {
      process.stderr.write(`Warning: Gemini API call failed: ${err.message}. Falling back to offline generator.\n`);
    }
  }

  // Offline Generation Fallback
  if (contextItems.length === 0) {
    return 'Could not find any relevant information about your query.';
  }
  return `Based on retrieved facts:\n` + contextItems.map(item => `- ${item}`).join('\n');
}

async function runCliMain() {
  const cliArgs = process.argv.slice(2);
  let verbose = false;
  const queryArgs = [];

  for (let i = 0; i < cliArgs.length; i++) {
    if (cliArgs[i] === '--verbose') {
      verbose = true;
    } else {
      queryArgs.push(cliArgs[i]);
    }
  }

  const command = queryArgs[0];
  if (command !== 'query') {
    process.stderr.write('Usage: node crag.js query "<query>" [--verbose]\n');
    process.exit(1);
  }

  const query = queryArgs[1];
  if (!query || query.trim() === '') {
    process.stderr.write('Usage: node crag.js query "<query>" [--verbose]\n');
    process.exit(1);
  }

  if (verbose) console.log(`[QUERY] "${query}"`);

  // Step 1: Retrieval
  const retrievalResults = retrieveDocs(query);
  const bestMatch = retrievalResults[0];
  const topScore = bestMatch ? bestMatch.score : 0;

  if (verbose) {
    console.log(`[RETRIEVAL] Top document: "${bestMatch ? bestMatch.doc.name : 'none'}" (Score: ${topScore.toFixed(2)})`);
  }

  // Step 2: Evaluation
  const classification = evaluateRetrieval(topScore);
  if (verbose) console.log(`[EVALUATOR] Classification: ${classification}`);

  const finalContexts = [];

  // Step 3: Corrective Actions & Refinement
  if (classification === 'CORRECT') {
    const refined = refineKnowledge(bestMatch.doc.content, query);
    finalContexts.push(refined);
    if (verbose) console.log(`[KNOWLEDGE REFINEMENT] Refined local content: "${refined}"`);
  } else if (classification === 'INCORRECT') {
    if (verbose) console.log(`[WEB SEARCH] Triggered simulated query due to INCORRECT local knowledge.`);
    const webResults = searchWebSimulated(query);
    finalContexts.push(...webResults);
    if (verbose) console.log(`[WEB SEARCH] Retrieved: ${JSON.stringify(webResults)}`);
  } else {
    // AMBIGUOUS
    const refined = refineKnowledge(bestMatch.doc.content, query);
    finalContexts.push(refined);
    if (verbose) console.log(`[KNOWLEDGE REFINEMENT] Refined local content: "${refined}"`);
    if (verbose) console.log(`[WEB SEARCH] Triggered simulated query due to AMBIGUOUS local knowledge.`);
    const webResults = searchWebSimulated(query);
    finalContexts.push(...webResults);
    if (verbose) console.log(`[WEB SEARCH] Retrieved: ${JSON.stringify(webResults)}`);
  }

  // Step 4: Generation
  const response = await generateResponse(query, finalContexts);
  console.log(response);
}

if (require.main === module) {
  runCliMain().catch(err => {
    process.stderr.write(`Fatal error: ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = { retrieveDocs, evaluateRetrieval, refineKnowledge, searchWebSimulated, generateResponse };
