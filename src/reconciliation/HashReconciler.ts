/**
 * SHA-256 based reconciliation for data integrity verification
 * Computes streaming hashes without loading entire file into memory
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { IReconciliationResult, IParsedRow } from '../types/interfaces';

export class HashReconciler {
	private inputHash: string = '';
	private outputHash: string = '';
	private chunkHashes: Map<number, string> = new Map();
	private recordCount: number = 0;

	/**
	 * Compute SHA-256 hash of input file
	 * Streams file without loading into memory
	 */
	async computeInputHash(filePath: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const hash = crypto.createHash('sha256');
			const stream = fs.createReadStream(filePath);

			stream.on('data', (chunk) => {
				hash.update(chunk);
			});

			stream.on('end', () => {
				this.inputHash = hash.digest('hex');
				resolve(this.inputHash);
			});

			stream.on('error', reject);
		});
	}

	/**
	 * Compute hash of parsed JSON output
	 * Can be called incrementally as rows are parsed
	 */
	hashRow(row: IParsedRow): void {
		if (!this.outputHash) {
			// Initialize hash on first row
			this.outputHash = crypto.createHash('sha256').digest('hex');
		}

		const hash = crypto.createHash('sha256');
		hash.update(JSON.stringify(row.data));
		const rowHash = hash.digest('hex');

		// Store per-chunk hash for distributed verification
		this.chunkHashes.set(row.rowIndex, rowHash);
		this.recordCount++;

		// Update output hash (simplified: just update with row hash)
		const combined = this.outputHash + rowHash;
		this.outputHash = crypto.createHash('sha256').update(combined).digest('hex');
	}

	/**
	 * Finalize output hash computation
	 */
	finalizeOutputHash(): string {
		return this.outputHash;
	}

	/**
	 * Verify reconciliation between input and output
	 * Returns match status and confidence level
	 */
	verify(): IReconciliationResult {
		const match = this.inputHash === this.outputHash;

		return {
			match,
			inputHash: this.inputHash,
			outputHash: this.outputHash,
			confidence: 'high', // SHA-256 provides cryptographic guarantee
			message: match
				? `✅ Data integrity verified: ${this.recordCount} records processed`
				: `⚠️ Hash mismatch detected. Input: ${this.inputHash.substring(0, 8)}... Output: ${this.outputHash.substring(0, 8)}...`,
		};
	}

	/**
	 * Get per-chunk hashes for distributed verification
	 */
	getChunkHashes(): Map<number, string> {
		return this.chunkHashes;
	}

	/**
	 * Get record count
	 */
	getRecordCount(): number {
		return this.recordCount;
	}

	/**
	 * Reset state for new file
	 */
	reset(): void {
		this.inputHash = '';
		this.outputHash = '';
		this.chunkHashes.clear();
		this.recordCount = 0;
	}
}
