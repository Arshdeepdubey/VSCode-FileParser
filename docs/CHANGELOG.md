# Change Log

All notable changes to the "fileparse" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.0] - 2026-08-21

### Fixed
- **CSV Parser**: Fixed handling of empty column headers from trailing commas
  - Parser now correctly filters out empty headers
  - Row data mapping simplified for clean JSON objects
  - Validated with 23K+ row CSV files

### Added
- Streaming CSV/TXT parser with memory efficiency
- Auto-delimiter detection (comma, tab, pipe, semicolon)
- Type coercion for numbers, booleans, and strings
- SHA-256 hash verification with confidence badge
- Export to JSON and clipboard
- Webview UI with virtual scrolling for 100K+ rows

## [Unreleased]

- Future enhancements