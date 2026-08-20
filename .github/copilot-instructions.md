# VSCode File Parser Extension - Copilot Instructions

## Project Overview
A high-performance VS Code extension for parsing large CSV and TXT files into JSON format with cryptographic data reconciliation verification. Built with streaming architecture for memory efficiency and virtual scrolling for rendering 100K+ rows.

**Current Status**: Phase 1 + Phase 2a complete. CSV parser fully operational with 23K+ row validation.

## Architecture

### Core Components
- **StreamParserFactory** (`src/parsers/StreamParserFactory.ts`): Factory pattern for parser instantiation and metadata extraction
- **TextCSVParser** (`src/parsers/TextCSVParser.ts`): Streaming CSV/TXT parser with async generator pattern
- **CustomEditorProvider** (`src/providers/CustomEditorProvider.ts`): VS Code custom editor integration
- **WebviewProvider** (`src/webview/WebviewProvider.ts`): UI rendering and virtual scrolling
- **HashReconciler** (`src/reconciliation/HashReconciler.ts`): SHA-256 hash verification for data integrity

### Design Patterns
- **Streaming/Async Generators**: Process files line-by-line without loading entire content into memory
- **Auto-Delimiter Detection**: Detects comma, tab, pipe, or semicolon separators automatically
- **Type Coercion**: Automatically identifies and converts numbers, booleans, null values
- **Quote Handling**: Proper escape sequence support for CSV quoted fields (`""` for literal quotes)

## Known Patterns & Pitfalls

### CSV Parsing
- **Empty column headers**: CSV files with trailing commas create empty headers. **SOLUTION**: Filter headers on parse, remove empty strings from header array before row mapping.
- **Hash reconciliation**: Do NOT compare raw CSV file hash with JSON output hash—they're cryptographically incompatible. **SOLUTION**: Verify successful parsing (input hash computed + output hash computed + record count > 0).
- **Field alignment**: When headers are filtered, ensure row fields align by index, not by field count.

### Performance
- **Memory footprint**: < 50MB heap for typical 100MB files (verified with 23K+ row CSV)
- **Parse speed**: ~500-1000 rows/second depending on file size and system resources
- **Virtual scroller**: Renders only visible rows; displays 100+ rows without performance degradation

## When Adding Features

### CSV/TXT Format Handling
1. Always use `StreamParserFactory` for parser instantiation
2. Implement `IStreamParser` interface for new format parsers
3. Add format detection to `StreamParserFactory.detectFormat()`
4. Update CHANGELOG.md and package.json file selectors

### Parsing Improvements
1. Test with edge cases:
   - Files with trailing commas (empty columns)
   - Mixed encodings (UTF-8, Latin-1)
   - Very long lines (>10KB per row)
   - Files with 100K+ rows
2. Always use async generators for streaming
3. Update corresponding unit tests in `src/test/parser.test.ts`
4. Run `npm test` to validate all tests pass

### UI/Webview Changes
1. Coordinate with WebviewProvider message protocol
2. Update CustomEditorProvider to handle new message types
3. Test with virtual scroller on 100K+ row datasets

## Testing Strategy

### Unit Tests
- Run `npm test` (also runs compile + lint automatically)
- Test file: `src/test/parser.test.ts`
- Coverage includes: format detection, metadata extraction, streaming, hash reconciliation

### Manual Testing
- Test with CSV files of varying sizes: 10 rows, 1K rows, 23K rows, 100K+ rows
- Test with different delimiters: comma, tab, pipe, semicolon
- Test with edge cases: empty values, quoted fields with commas, trailing commas

### Build Validation
- Run `npm run compile` to check for TypeScript errors
- Run `npm run lint` to check for ESLint violations
- Run `npm test` before submitting changes

## Common Tasks

### Debug a parsing issue
1. Check `TextCSVParser.ts:parseLine()` for delimiter handling
2. Verify headers are filtered (no empty strings in `this.headers`)
3. Check row mapping in parse generator (should align fields by index)
4. Look at `HashReconciler.verify()` to understand hash match logic
5. Create a test case in `parser.test.ts` to reproduce and validate fix

### Add support for a new file format (e.g., Parquet, Excel)
1. Create new parser class implementing `IStreamParser` interface
2. Add to `StreamParserFactory.detectFormat()` and `parseStream()`
3. Add format case to metadata extraction
4. Create corresponding unit tests
5. Update package.json `fileSelectors` for the new extension
6. Document in README.md

### Optimize performance
1. Profile with large files using `npm run watch` and Chrome DevTools
2. Check for unnecessary loops or string concatenations
3. Consider caching parsed metadata
4. Review virtual scroller row rendering in WebviewProvider
5. Run `npm test` to ensure no regressions

## File Locations Reference
- **Parsers**: `src/parsers/`
- **Tests**: `src/test/`
- **Types**: `src/types/interfaces.ts`
- **Webview**: `src/webview/`
- **Documentation**: `docs/`
- **Configuration**: `tsconfig.json`, `eslint.config.mjs`, `package.json`

## Deployment Checklist
- [ ] All unit tests passing (`npm test`)
- [ ] No lint errors (`npm run lint`)
- [ ] TypeScript compilation succeeds (`npm run compile`)
- [ ] README.md updated with new features
- [ ] CHANGELOG.md entry added
- [ ] Tested with 23K+ row CSV file
- [ ] Tested with edge cases (trailing commas, various encodings)
- [ ] Version bump in package.json
