# IdeaMem MCP Workflow Guide

This document provides comprehensive guidance for using IdeaMem's MCP (Model Context Protocol) tools effectively.

## 🚨 CRITICAL: CONVERSATION CONTINUATION PROTOCOL 🚨

**IF THIS IS A CONTINUED CONVERSATION FROM A PREVIOUS SESSION:**

🔄 **MANDATORY CONTINUATION CHECKPOINT** 🔄
Before proceeding with ANY task, Claude MUST:

1. **IMMEDIATELY** announce: "🚨 MCP WORKFLOW CHECKPOINT 🚨"
2. **IMMEDIATELY** run: `codebase.check_constraints` (Gets ALL rules and preferences from DATABASE)
3. **VALIDATE ALL SYMBOLS** before using any variables, functions, enums, or CSS classes

❌ **FAILURE TO FOLLOW = BROKEN CODE AND BUILD ERRORS** ❌

**Why this is critical:**
- Context continuation often causes workflow amnesia
- Previous validation does NOT carry over to new sessions  
- Skipping validation leads to undefined variables and build failures
- Symbol names and function signatures may have changed

## ⚠️ MANDATORY FIRST STEP: MCP Rules Check

**BEFORE ANY ACTION, Claude MUST run this MCP tool:**

1. **Check for coding constraints**: `codebase.check_constraints` - Gets rules and preferences from DATABASE (not vectors)

**BEFORE ANY CODE WRITING, Claude MUST validate all symbols:**
- Variables: `codebase.validate_symbol`
- Enums: `codebase.validate_enum_values` 
- Functions: `codebase.check_function_signature`

**NEVER skip these steps** - this prevents undefined variables, wrong enum values, incorrect function calls, and broken code.

**IMPORTANT**: Rules and preferences are now stored in DATABASE, not vectors. Use `codebase.check_constraints` and `codebase.set_constraints`, NOT `codebase.search` or `codebase.store`.

## 🔧 AUTOMATION TRIGGERS & ERROR RECOVERY

### 📢 Automatic Workflow Triggers
These phrases should AUTOMATICALLY trigger MCP workflow:
- "Before I proceed..." → MUST run constraint checks first
- "Let me check..." → MUST use MCP search tools
- "I need to validate..." → MUST run symbol validation
- "First, I'll..." → MUST run MCP workflow before action

### 🚨 ERROR RECOVERY PROTOCOL
If MCP workflow is forgotten or skipped:

1. **IMMEDIATE ACKNOWLEDGMENT**: "I missed the mandatory MCP workflow checks"
2. **STOP CURRENT WORK**: Do not proceed with coding until validation is complete
3. **RETROACTIVE VALIDATION**: Run all missed MCP checks immediately
4. **DAMAGE ASSESSMENT**: Validate any code/symbols already written
5. **COURSE CORRECTION**: Follow proper workflow for all remaining work
6. **LEARNING DOCUMENTATION**: Store the mistake pattern to prevent future occurrences

### ⚡ MANDATORY SYMBOL VALIDATION
Before using ANY of these, MUST validate:

| Element Type | Validation Tool | Example |
|--------------|----------------|---------|
| Variables | `codebase.validate_symbol` | `useState`, `metrics`, `error` |
| Functions | `codebase.check_function_signature` | `fetchMetrics()`, `handleClick()` |
| Enum Values | `codebase.validate_enum_values` | `IndexStatus.COMPLETED`, `'RUNNING'` |
| CSS Classes | `codebase.validate_symbol` | `flex-col`, `btn-primary` |
| Interfaces | `codebase.validate_symbol` | `DashboardMetrics`, `Project` |
| Imports | `codebase.validate_symbol` | `ArrowPathIcon`, `NextResponse` |

## 📋 MCP Tool Workflow Guide

### 🔧 Core Development Workflow
1. **BEFORE ANY CODING**: Run `codebase.check_constraints` to get rules and preferences from database
2. **BEFORE USING ANY SYMBOL**: Use validation tools (`codebase.validate_symbol`, `codebase.validate_enum_values`, `codebase.check_function_signature`)
3. **WHILE CODING**: Use `codebase.search` to find existing code implementations and patterns
4. **AFTER WRITING CODE**: Use `codebase.store` to index new important code for future searches (code/docs only)
5. **FOR NEW RULES/PREFERENCES**: Use `codebase.set_constraints` to store coding standards and team preferences

### 🔍 Code Search & Discovery Workflow
**When looking for existing code:**
- Use `codebase.search` with specific queries like "authentication", "error handling", "API endpoints"
- Use filters: `{"type": "code"}`, `{"language": "typescript"}`, `{"source": "src/components/"}`
- For broader searches across documentation: use `docs.search` or `docs.hybrid_search`

### 🔄 Refactoring & Migration Workflow
**BEFORE making changes to interfaces, functions, or variables:**
1. `codebase.check_interface_changes` - Analyze impact of proposed changes
2. `codebase.find_usage_patterns` - Find all places using the symbol you want to change
3. `codebase.validate_symbol` - Confirm current symbol exists and is spelled correctly
4. **After refactoring**: Use `codebase.refresh_file` to update search index for changed files

### ⚡ File Management Workflow
**When to use file management tools:**
- `codebase.index_file` - Just wrote important new code (utilities, components, APIs)
- `codebase.refresh_file` - Modified existing important files
- `codebase.sync_changes` - Daily/periodic maintenance to keep search current
- `codebase.rebuild_all` - After major refactoring when searches return wrong results
- `codebase.cleanup_project` - Emergency reset when project data is corrupted

### 📚 Documentation Discovery Workflow
**When researching new technologies or APIs:**
1. `docs.search` - Search for specific topics: "React hooks", "TypeScript generics", "Next.js routing"
2. `docs.hybrid_search` - Complex queries requiring semantic + keyword matching
3. `docs.faceted_search` - Filter by complexity, content type, programming language
4. `docs.find_related` - Discover connected documentation after finding relevant docs
5. `docs.relationship_graph` - Visualize connections between documentation topics

### 🧹 Maintenance Workflow
**Weekly maintenance tasks:**
- Run `codebase.sync_changes` to ensure search index is current
- Use `docs.list_repositories` to check what documentation sources are available
- Consider adding new documentation sources with `docs.add_repository` for team learning

### 🚨 Troubleshooting Workflow
**When searches return incorrect or outdated results:**
1. Try `codebase.refresh_file` for specific files
2. If problem persists: `codebase.rebuild_all` (nuclear option)
3. If validation tools fail: Check if files were deleted, use `codebase.sync_changes`
4. If project data seems corrupted: `codebase.cleanup_project` then rebuild

## 🤖 Claude Proactive Tool Usage

### When Claude Should Automatically Use Tools (No User Request Needed)

**🔍 ALWAYS use these tools proactively:**
- `codebase.check_constraints` - BEFORE any coding task (mandatory)
- `codebase.validate_symbol` - BEFORE referencing any variable, function, enum, type
- `codebase.validate_enum_values` - BEFORE using any enum values in comparisons
- `codebase.check_function_signature` - BEFORE calling any functions

**📝 Use during development workflow:**
- `codebase.search` - When user asks about existing code, patterns, or implementations
- `codebase.store` - AFTER writing significant new code (components, utilities, APIs)
- `codebase.index_file` - AFTER creating important new files
- `codebase.refresh_file` - AFTER making major changes to existing important files

**🔧 Use for refactoring tasks:**
- `codebase.check_interface_changes` - When user asks to modify interfaces, types, or function signatures
- `codebase.find_usage_patterns` - When user wants to rename or refactor variables, functions, or components
- `codebase.sync_changes` - When user mentions search results seem outdated

**📚 Use for learning/research:**
- `docs.search` - When user asks about technology, frameworks, or API usage
- `docs.hybrid_search` - For complex technical questions requiring comprehensive documentation
- `docs.faceted_search` - When user needs filtered results by complexity or content type

### When to Ask User Permission First

**🚨 Destructive operations (ask first):**
- `codebase.rebuild_all` - Complete index rebuild
- `codebase.cleanup_project` - Removes all project vectors
- `codebase.forget` - Deletes specific content from index

**📚 Documentation management (ask first):**
- `docs.add_repository` - Adding new documentation sources
- `docs.index_repository` - Starting documentation indexing jobs

## 🛠️ Complete MCP Tools Reference

### 🔧 Core Codebase Tools (Project Context Only)
- `codebase.check_constraints` - 🚨 Get rules and preferences from DATABASE before coding (mandatory first step)
- `codebase.set_constraints` - 📝 Store rules and preferences in DATABASE (for coding standards, team preferences)
- `codebase.search` - 🔍 Semantic search for code and documentation in your project (vectors only)
- `codebase.store` - 🤖 Store and index CODE/DOCS with semantic chunking (no rules/preferences)
- `codebase.forget` - 🗑️ Delete content by source identifier from your project

### ⚡ File Management Tools (Project Context Only)
- `codebase.index_file` - ⚡ Make specific file searchable immediately
- `codebase.refresh_file` - 🔄 Refresh/reindex specific outdated file
- `codebase.rebuild_all` - 🔨 Rebuild entire project search index (nuclear option)
- `codebase.sync_changes` - 🤖 Smart sync - only index NEW changes efficiently
- `codebase.cleanup_project` - 🧹 Emergency cleanup - remove ALL project vectors

### 🔍 Code Validation Tools (Project Context Only)
- `codebase.validate_symbol` - 🔍 Validate variable/function/enum/type before using
- `codebase.validate_enum_values` - 🎯 Prevent enum case mismatches and wrong values
- `codebase.check_function_signature` - 🔧 Validate function parameters and signatures
- `codebase.check_interface_changes` - 🔄 Migration safety checker for interface changes
- `codebase.find_usage_patterns` - 📋 Find all usages before refactoring symbols

### 📚 Documentation Tools (Global Context Only)
- `docs.list_repositories` - 📚 List all documentation repositories available
- `docs.add_repository` - 📝 Add new documentation source (Git/llms.txt/websites)
- `docs.index_repository` - 🚀 Start indexing a documentation repository
- `docs.search` - 🔍 Search indexed documentation with filters
- `docs.hybrid_search` - 🔍 Advanced semantic + keyword documentation search
- `docs.search_suggestions` - 💡 Get search auto-completions and enhancements
- `docs.relationship_graph` - 🕸️ Build interactive documentation relationship network
- `docs.find_related` - 🔗 Find documents related to specific document
- `docs.faceted_search` - 🎛️ Advanced faceted search with dynamic filters

### 🏗️ Architecture: Token-Based Authentication
- **All codebase tools automatically use YOUR project context** - no project IDs needed
- **All documentation tools work with global shared documentation**
- **Token-based security** - your Bearer token determines project access
- **No scope parameters needed** - the system handles project/global context automatically

## Authentication & Context Behaviors

- **Codebase Tools**: Bearer token automatically determines your project context - no additional parameters needed
- **Documentation Tools**: Always work in global context for shared documentation discovery
- **Rules/Preferences**: Project-specific rules override global rules automatically (no scope needed)

## Example MCP Usage

### Store Code in Your Project

```json
{
  "jsonrpc": "2.0", 
  "id": "req-123",
  "method": "tools/call",
  "params": {
    "name": "codebase.store",
    "arguments": {
      "content": "function hello() { console.log('world'); }",
      "source": "src/hello.js",
      "type": "code",
      "language": "javascript"
    }
  }
}
```

### Search Your Project Codebase

```json
{
  "jsonrpc": "2.0",
  "id": "req-124", 
  "method": "tools/call",
  "params": {
    "name": "codebase.search",
    "arguments": {
      "query": "authentication patterns",
      "filters": {
        "type": "code"
      }
    }
  }
}
```

## Content Types

### For codebase.store (Vector Storage)
- `code`: Programming code (supports AST-based chunking for JS/TS)
- `documentation`: Technical documentation  
- `conversation`: Chat/discussion content

### For codebase.set_constraints (Database Storage)
- `rule`: Business rules and coding constraints (stored in database) - Category: 'rule'
- `user_preference`: User settings and team preferences (stored in database) - Categories: 'tooling', 'workflow', 'formatting'

### Categories for Constraints
- **rule**: Core coding rules, standards, and architectural constraints
- **tooling**: IDE settings, development tools, and toolchain preferences  
- **workflow**: Development processes, Git workflows, and team practices
- **formatting**: Code style, formatting rules, and visual consistency

**IMPORTANT**: Rules and preferences are now stored in DATABASE via `codebase.set_constraints` and retrieved via `codebase.check_constraints`. Do NOT use `codebase.store` for rules/preferences.