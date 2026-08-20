/**
 * Integration tests for File Parser extension
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StreamParserFactory } from '../parsers/StreamParserFactory';
import { HashReconciler } from '../reconciliation/HashReconciler';

suite('File Parser Tests', () => {
	let testDir: string;
	let csvFile: string;
	let txtFile: string;

	suiteSetup(async function () {
		// Create temporary test directory
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileparser-test-'));
		console.log(`Test directory: ${testDir}`);

		// Create sample CSV file
		csvFile = path.join(testDir, 'sample.csv');
		const csvContent = `name,age,city,email
Alice,30,New York,alice@example.com
Bob,25,San Francisco,bob@example.com
Charlie,35,Chicago,charlie@example.com`;
		fs.writeFileSync(csvFile, csvContent, 'utf-8');

		// Create sample TXT file (tab-separated)
		txtFile = path.join(testDir, 'sample.txt');
		const txtContent = `id\tproduct\tprice\tquantity
1\tLaptop\t1299.99\t5
2\tMouse\t29.99\t150
3\tKeyboard\t79.99\t50`;
		fs.writeFileSync(txtFile, txtContent, 'utf-8');
	});

	suiteTeardown(async function () {
		// Clean up test files
		if (fs.existsSync(csvFile)) {
			fs.unlinkSync(csvFile);
		}
		if (fs.existsSync(txtFile)) {
			fs.unlinkSync(txtFile);
		}
		if (fs.existsSync(testDir)) {
			fs.rmdirSync(testDir);
		}
	});

	test('CSV parsing - file format detection', async () => {
		const format = StreamParserFactory.detectFormat(csvFile);
		assert.strictEqual(format, 'csv', 'Should detect CSV format');
	});

	test('TXT parsing - file format detection', async () => {
		const format = StreamParserFactory.detectFormat(txtFile);
		assert.strictEqual(format, 'txt', 'Should detect TXT format');
	});

	test('CSV parsing - metadata extraction', async () => {
		const metadata = await StreamParserFactory.getMetadata(csvFile);
		assert.strictEqual(metadata.totalRows, 3, 'Should parse 3 rows from CSV');
		assert.deepStrictEqual(
			metadata.headers,
			['name', 'age', 'city', 'email'],
			'Should extract correct headers'
		);
	});

	test('CSV parsing - streaming', async () => {
		const parser = StreamParserFactory.parseStream(csvFile);
		let rowCount = 0;
		const rows: any[] = [];

		for await (const row of parser) {
			rows.push(row);
			rowCount++;
		}

		assert.strictEqual(rowCount, 3, 'Should parse exactly 3 rows');
		assert.strictEqual(rows[0].data.name, 'Alice', 'First row should be Alice');
		assert.strictEqual(rows[0].data.age, 30, 'Age should be parsed as number');
		assert.strictEqual(rows[1].data.name, 'Bob', 'Second row should be Bob');
	});

	test('TXT parsing - streaming', async () => {
		const parser = StreamParserFactory.parseStream(txtFile);
		let rowCount = 0;

		for await (const row of parser) {
			rowCount++;
			assert.ok(row.data.id, 'Row should have id field');
			assert.ok(row.data.product, 'Row should have product field');
		}

		assert.strictEqual(rowCount, 3, 'Should parse exactly 3 rows from TXT');
	});

	test('Hash reconciliation - input hash computation', async () => {
		const reconciler = new HashReconciler();
		const hash = await reconciler.computeInputHash(csvFile);

		assert.ok(hash, 'Hash should not be empty');
		assert.strictEqual(hash.length, 64, 'SHA-256 hash should be 64 characters');
		assert.match(hash, /^[a-f0-9]+$/, 'Hash should be valid hexadecimal');
	});

	test('Hash reconciliation - row hashing', async () => {
		const reconciler = new HashReconciler();
		await reconciler.computeInputHash(csvFile);

		const parser = StreamParserFactory.parseStream(csvFile);
		for await (const row of parser) {
			reconciler.hashRow(row);
		}

		reconciler.finalizeOutputHash();
		const result = reconciler.verify();

		assert.ok(result.inputHash, 'Should have input hash');
		assert.ok(result.outputHash, 'Should have output hash');
		assert.strictEqual(
			reconciler.getRecordCount(),
			3,
			'Should have counted 3 records'
		);
	});

	test('Parser - null and empty value handling', async () => {
		const testFile = path.join(testDir, 'nulls.csv');
		const content = `col1,col2,col3
value1,,value3
,value2,
value1,value2,value3`;
		fs.writeFileSync(testFile, content, 'utf-8');

		const parser = StreamParserFactory.parseStream(testFile);
		const rows: any[] = [];

		for await (const row of parser) {
			rows.push(row);
		}

		fs.unlinkSync(testFile);

		assert.strictEqual(rows[0].data.col2, null, 'Empty field should be null');
		assert.strictEqual(rows[1].data.col1, null, 'Empty field should be null');
		assert.strictEqual(rows[2].data.col1, 'value1', 'Non-empty field should be preserved');
	});
});
