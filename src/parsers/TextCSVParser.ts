/**
 * Streaming TXT/CSV file parser
 * Uses Node.js readline for line-by-line processing without loading entire file into memory
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import { IParsedRow, IStreamParser } from '../types/interfaces';

export class TextCSVParser implements IStreamParser {
	private delimiter: string = ',';
	private headers: string[] = [];
	private filePath: string;

	constructor(filePath: string, delimiter?: string) {
		this.filePath = filePath;
		if (delimiter) {
			this.delimiter = delimiter;
		} else {
			// Auto-detect delimiter for CSV files
			if (filePath.endsWith('.csv')) {
				this.delimiter = ',';
			} else if (filePath.endsWith('.txt')) {
				this.delimiter = '\t'; // Default to tab for TXT
			}
		}
	}

	/**
	 * Detect delimiter by sampling first 100 lines
	 */
	private async detectDelimiter(): Promise<string> {
		return new Promise((resolve) => {
			const candidates = [',', '\t', '|', ';'];
			const counts: { [key: string]: number } = { ',': 0, '\t': 0, '|': 0, ';': 0 };
			let lineCount = 0;

			const rl = readline.createInterface({
				input: fs.createReadStream(this.filePath),
				crlfDelay: Infinity,
			});

			rl.on('line', (line) => {
				if (lineCount < 100) {
					for (const delim of candidates) {
						counts[delim] += (line.match(new RegExp('\\' + delim, 'g')) || []).length;
					}
					lineCount++;
				}
			});

			rl.on('close', () => {
				let maxDelim = ',';
				let maxCount = 0;
				for (const [delim, count] of Object.entries(counts)) {
					if (count > maxCount) {
						maxCount = count;
						maxDelim = delim;
					}
				}
				resolve(maxDelim);
			});
		});
	}

	/**
	 * Parse CSV/TXT line into fields, handling quoted fields
	 */
	private parseLine(line: string): string[] {
		if (!line) {
			return [];
		}

		const fields: string[] = [];
		let current = '';
		let inQuotes = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];
			const nextChar = line[i + 1];

			if (char === '"') {
				if (inQuotes && nextChar === '"') {
					// Escaped quote
					current += '"';
					i++; // Skip next quote
				} else {
					// Toggle quote state
					inQuotes = !inQuotes;
				}
			} else if (char === this.delimiter && !inQuotes) {
				// Field separator
				fields.push(current.trim());
				current = '';
			} else {
				current += char;
			}
		}

		fields.push(current.trim());
		return fields;
	}

	/**
	 * Streaming parser using async generator
	 * Yields one row at a time without loading entire file
	 */
	async *parse(filePath: string): AsyncGenerator<IParsedRow, void, void> {
		const rl = readline.createInterface({
			input: fs.createReadStream(filePath),
			crlfDelay: Infinity,
		});

		let rowIndex = 0;
		let isFirstLine = true;

		for await (const line of rl) {
			if (!line.trim()) {
				continue; // Skip empty lines
			}

			const fields = this.parseLine(line);

			if (isFirstLine) {
				// First line is header - filter out empty column names
				this.headers = fields.filter(header => header.trim() !== '');
				isFirstLine = false;
				continue;
			}

			// Create row object from headers and fields
			// Only include fields that correspond to filtered (non-empty) headers
			const data: Record<string, any> = {};
			for (let i = 0; i < this.headers.length; i++) {
				const header = this.headers[i];
				const value = i < fields.length ? fields[i] : '';
				data[header] = this.tryParseValue(value);
			}

			yield {
				rowIndex,
				data,
			};

			rowIndex++;
		}

		rl.close();
	}

	/**
	 * Attempt to parse value as appropriate type
	 */
	private tryParseValue(value: string | null): any {
		if (value === null || value === '') {
			return null;
		}

		// Try number
		if (!isNaN(Number(value))) {
			return Number(value);
		}

		// Try boolean
		if (value.toLowerCase() === 'true') {
			return true;
		}
		if (value.toLowerCase() === 'false') {
			return false;
		}

		// Return as string
		return value;
	}

	/**
	 * Get file metadata (headers, row count estimate)
	 */
	async getMetadata(): Promise<{ totalRows: number; headers?: string[] }> {
		return new Promise((resolve) => {
			let totalRows = 0;
			let isFirstLine = true;

			const rl = readline.createInterface({
				input: fs.createReadStream(this.filePath),
				crlfDelay: Infinity,
			});

			rl.on('line', (line) => {
				if (isFirstLine) {
					const allHeaders = this.parseLine(line);
					// Filter out empty column headers
					this.headers = allHeaders.filter(header => header.trim() !== '');
					isFirstLine = false;
				} else if (line.trim()) {
					totalRows++;
				}
			});

			rl.on('close', () => {
				resolve({
					totalRows,
					headers: this.headers,
				});
			});
		});
	}
}
