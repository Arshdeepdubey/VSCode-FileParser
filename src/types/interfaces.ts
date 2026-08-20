/**
 * Shared interfaces for file parsing pipeline
 */

export interface IParsedRow {
	rowIndex: number;
	data: Record<string, any>;
}

export interface IParseResult {
	totalRows: number;
	totalSize: number;
	inputHash: string;
	outputHash: string;
	headers?: string[];
	preview: IParsedRow[];
}

export interface IReconciliationResult {
	match: boolean;
	inputHash: string;
	outputHash: string;
	confidence: 'high' | 'low';
	message: string;
}

export type FileFormat = 'txt' | 'csv' | 'parquet' | 'excel';

export interface IStreamParser {
	parse(filePath: string): AsyncGenerator<IParsedRow, void, void>;
	getMetadata(): Promise<{ totalRows: number; headers?: string[] }>;
}

export interface IFileParsedDocument {
	uri: any;
	format: FileFormat;
	parseResult: IParseResult | null;
	isDirty: boolean;
}
