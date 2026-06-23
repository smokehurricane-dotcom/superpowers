# CLI Bielefeld Businesses CRAG — Design Specification

Design specification for Phase C: Corrective Retrieval-Augmented Generation (CRAG) system for local businesses in Bielefeld.

## 1. Goal & Context
Build a CLI-based Corrective Retrieval-Augmented Generation (CRAG) system using Node.js stdlib only. The application answers queries about local businesses in and around Bielefeld. It uses local Knowledge Base (KB) JSON file for initial retrieval, evaluates the relevance of retrieved documents, and triggers simulated external web search if the local knowledge is missing or ambiguous. 

Additionally, it supports the `GEMINI_API_KEY` environment variable to run actual LLM calls via standard `https` module, falling back to a rule-based mock generator/evaluator for standalone offline execution.

## 2. Directory Structure
```
bielefeld_crag/
  data/
    kb.json               # Local Knowledge Base (Bielefeld businesses)
    external_web.json     # Wider Web search simulation index
  package.json
  crag.js                 # CLI entry point, evaluator, search, and generator logic
  crag.test.js            # Comprehensive test suite
```

## 3. Database Schema
* **kb.json**:
  ```json
  [
    {
      "id": "alpinzentrum",
      "name": "DAV Alpinzentrum Bielefeld",
      "category": "climbing",
      "content": "DAV Alpinzentrum Bielefeld is located in Bielefeld-Senne. It features lead climbing walls and bouldering facilities."
    }
  ]
  ```
* **external_web.json**:
  ```json
  [
    {
      "query_keyword": "lamm",
      "content": "Bäckerei Lamm is a traditional German bakery in Bielefeld old town, established in 1912, famous for Lammbrot."
    }
  ]
  ```

## 4. CRAG Pipeline Steps

### Step 1: Retrieval
Retrieves local documents using token-overlap matching score between query and document content.

### Step 2: Evaluation
Categorizes the retrieved results based on score thresholds:
* **CORRECT** (Score >= 0.25): Refines knowledge (splits document into sentences, filters out sentences with low relevance). Passes to Generator.
* **INCORRECT** (Score < 0.1): Discards documents. Triggers Simulated External Search using query keywords.
* **AMBIGUOUS** (0.1 <= Score < 0.25): Refines local documents and triggers Simulated External Search. Combines both contexts.

### Step 3: Generator
Formulates the final output response:
* Offline Mode: Formats context snippets into a structured response template.
* LLM Mode (if `GEMINI_API_KEY` is present): Makes a POST request to Google Gemini API (`gemini-2.5-flash`) via Node's `https` module.

## 5. CLI Commands
* `query "<prompt>" [--verbose]`: Queries the CRAG system and prints the generated response. If `--verbose` is passed, prints step-by-step trace:
  - Initial retrieval scores and documents.
  - Evaluator classification (Correct/Incorrect/Ambiguous).
  - External search queries and results.
  - Refined context passed to generator.

## 6. Test Isolation
* Test environment variables: `CRAG_KB` and `CRAG_WEB` specify test data files.
* Test suite configures `{ concurrency: false }`.
