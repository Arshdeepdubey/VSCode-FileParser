/**
 * Factory for creating format-specific stream parsers
 * Routes to appropriate parser based on file extension
 */

import * as path from 'path';
import { FileFormat, IStreamParser, IParsedRow } from '../types/interfaces';
import { TextCSVParser } from './TextCSVParser';

export class StreamParserFactory {
	/**
	 * Get parser for file format
	 */
	static getParser(filePath: string): IStreamParser {
		const ext = path.extname(filePath).toLowerCase();

		switch (ext) {
			case '.csv':
				return new TextCSVParser(filePath, ',');
			case '.txt':
				return new TextCSVParser(filePath);
			default:
				throw new Error(`Unsupported file format: ${ext}`);
		}
	}

	/**
	 * Detect file format from extension
	 */
	static detectFormat(filePath: string): FileFormat {
		const ext = path.extname(filePath).toLowerCase();

		switch (ext) {
			case '.csv':
				return 'csv';
			case '.txt':
				return 'txt';
			case '.parquet':
				return 'parquet';
			case '.xlsx':
			case '.xls':
				return 'excel';
			default:
				throw new Error(`Unsupported file format: ${ext}`);
		}
	}

	/**
	 * Parse file and return all rows as array (for smaller files)
	 * Use parseStream for large files to avoid memory overhead
	 */
	static async parseFile(
		filePath: string,
		onRow?: (row: IParsedRow) => void
	): Promise<IParsedRow[]> {
		const parser = this.getParser(filePath);
		const rows: IParsedRow[] = [];

		for await (const row of parser.parse(filePath)) {
			rows.push(row);
			if (onRow) {
				onRow(row);
			}
		}

		return rows;
	}

	/**
	 * Parse file as stream (recommended for large files)
	 */
	static parseStream(filePath: string): AsyncGenerator<IParsedRow, void, void> {
		const parser = this.getParser(filePath);
		return parser.parse(filePath);
	}

	/**
	 * Get file metadata without parsing all rows
	 */
	static async getMetadata(filePath: string) {
		const parser = this.getParser(filePath);
		return parser.getMetadata();
	}
}
