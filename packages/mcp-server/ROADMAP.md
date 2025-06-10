### Roadmap for Improving `mcp-server`

This document outlines a plan to refactor and improve the `@privmx/mcp-server` package, focusing on stability, maintainability, and best practices.

#### Phase 1: Critical Fixes & Refactoring

1.  **Fix Path Resolution:**

    - **Problem:** Hardcoded relative paths (e.g., `../../spec`) are used throughout the codebase, making it brittle and dependent on the execution directory.
    - **Solution:** Create a central `path.ts` or `config.ts` module to resolve key paths (project root, spec root) reliably. Replace all instances of `path.join` with relative segments with calls to this new module.

2.  **Refactor `APIKnowledgeService`:**

    - **Problem:** The `APIKnowledgeService` class is a "God object" (1200+ lines) with too many responsibilities, including knowledge building, search, code generation, and interactive workflows.
    - **Solution:**
      - Decompose `APIKnowledgeService` into smaller, single-responsibility services:
        - `KnowledgeBuilderService`: Manages `buildKnowledgeGraph`, `findAPIFiles`, etc.
        - `CodeGenerationService`: Handles `generateSetupCode`, `generateWorkflow`, etc.
        - `SearchService`: Wraps the `SearchEngine` and `EnhancedSearchEngine`.
        - `InteractiveWorkflowService`: Manages interactive sessions via `Inquirer`.
      - Use dependency injection to provide these services to a lean coordinator or directly to the `LangChainPrivMXServer`.

3.  **Consolidate Templating/Generation Logic:**

    - **Problem:** There are multiple, overlapping templating and code generation mechanisms (`WorkflowGeneratorFactory`, `SmartTemplateEngine`, `PrecompiledTemplateEngine`).
    - **Solution:** Analyze the capabilities of each, select the most robust engine (likely `plop` or `handlebars` via `PrecompiledTemplateEngine`), and consolidate all code generation logic into a single, unified `TemplateService`. Deprecate and remove the redundant engines.

4.  **Improve Configuration Management:**
    - **Problem:** Configuration is scattered across hardcoded defaults, `dotenv`, and constructor arguments.
    - **Solution:** Implement a centralized, type-safe configuration service. This service should load configuration from `.env` files and environment variables, validate it with `zod`, and provide it to the rest of the application.

#### Phase 2: Enhancements & Best Practices

1.  **Implement Input Validation:**

    - **Problem:** Tool inputs in `langchain-server.ts` are not validated (`args: any`).
    - **Solution:** Use the `zod` dependency to define schemas for all tool inputs. Parse and validate the arguments at the beginning of each tool handler to ensure type safety and provide clear errors.

2.  **Refine Language Detection:**

    - **Problem:** Language detection based on file path segments is fragile.
    - **Solution:** Introduce a manifest file (e.g., `privmx.spec.json`) in each language-specific directory (e.g., `/spec/api/js`). This manifest should explicitly declare the language and other relevant metadata, making the parsing process more robust.

3.  **Complete Incomplete Features:**

    - **Problem:** Several key features are currently mocked or incomplete (e.g., `generateWorkflow`, `searchGuides`).
    - **Solution:** Implement the full logic for these features, replacing all mock data and placeholder comments with functional code.

4.  **Adopt Structured Logging:**

    - **Problem:** Logging is inconsistent, primarily using `console.log`.
    - **Solution:** Replace all `console.*` calls with a properly configured `winston` logger instance. Implement structured, leveled logging (info, warn, error) throughout the application.

5.  **Clean up `package.json` scripts:**
    - **Problem:** The `build-knowledge` script uses `npm run` in a `pnpm` project. A watch mode for development is missing.
    - **Solution:** Change `npm run` to `pnpm run`. Add a `dev` script using `tsx --watch src/langchain-server.ts` to improve the development workflow.

#### Phase 3: Cleanup & Final Polish

1.  **Remove Redundant Files:**

    - **Problem:** `debug-files.cjs` appears to be a duplicate of `debug-files.js`.
    - **Solution:** Confirm the files are identical and remove the redundant `.cjs` version to align with the project's ES module type.

2.  **Clean Up Legacy Code:**
    - **Problem:** The codebase contains sections marked as "legacy," "mock," or with comments indicating a previous implementation.
    - **Solution:** After the refactoring in Phases 1 and 2 is complete, remove all deprecated code, compatibility layers, and associated comments to improve code clarity.
