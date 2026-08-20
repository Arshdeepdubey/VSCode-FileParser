/**
 * Custom Editor Provider for file parsing
 * Implements vscode.CustomEditorProvider to handle .txt and .csv files
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StreamParserFactory } from '../parsers/StreamParserFactory';
import { HashReconciler } from '../reconciliation/HashReconciler';
import { WebviewProvider } from '../webview/WebviewProvider';
import { IFileParsedDocument, IParseResult } from '../types/interfaces';

export class FileParsedDocument implements vscode.CustomDocument {
	uri: vscode.Uri;
	format: any;
	parseResult: IParseResult | null = null;
	isDirty: boolean = false;
	private static idCounter = 0;
	private documentId: number = ++FileParsedDocument.idCounter;

	constructor(uri: vscode.Uri) {
		this.uri = uri;
		this.format = StreamParserFactory.detectFormat(uri.fsPath);
	}

	getDocumentId(): number {
		return this.documentId;
	}

	dispose(): void {
		// Cleanup resources if needed
	}
}

export class CustomEditorProvider implements vscode.CustomEditorProvider<FileParsedDocument> {
	public static readonly viewType = 'fileparse.parser';
	private readonly context: vscode.ExtensionContext;
	private documents = new Map<number, FileParsedDocument>();
	private webviewProvider: WebviewProvider;
	private readonly onDidChangeCustomDocumentEmitter = new vscode.EventEmitter<
		vscode.CustomDocumentContentChangeEvent<FileParsedDocument>
	>();

	public readonly onDidChangeCustomDocument = this.onDidChangeCustomDocumentEmitter.event;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.webviewProvider = new WebviewProvider(context);
	}

	/**
	 * Called when opening a file in the custom editor
	 */
	async openCustomDocument(
		uri: vscode.Uri,
		_openContext: vscode.CustomDocumentOpenContext,
		_token: vscode.CancellationToken
	): Promise<FileParsedDocument> {
		const document = new FileParsedDocument(uri);
		this.documents.set(document.getDocumentId(), document);

		// Parse file in background
		this.parseFile(document).catch((err) => {
			vscode.window.showErrorMessage(`Failed to parse file: ${err.message}`);
		});

		return document;
	}

	/**
	 * Called when rendering the custom editor in a webview
	 */
	async resolveCustomEditor(
		document: FileParsedDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Set webview options
		webviewPanel.webview.options = {
			enableScripts: true,
		};

		// Generate HTML content
		webviewPanel.webview.html = this.webviewProvider.getWebviewContent(
			webviewPanel.webview,
			document
		);

		// Handle messages from webview
		webviewPanel.webview.onDidReceiveMessage(
			async (message) => {
				await this.handleWebviewMessage(message, document, webviewPanel);
			},
			undefined,
			this.context.subscriptions
		);

		// Watch file for external changes
		const watcher = vscode.workspace.createFileSystemWatcher(document.uri.fsPath);
		watcher.onDidChange(() => {
			this.parseFile(document).catch((err) => {
				vscode.window.showErrorMessage(`Failed to reparse file: ${err.message}`);
			});
		});

		this.context.subscriptions.push(watcher);
	}

	/**
	 * Save document (currently no-op for read-only view)
	 */
	async saveCustomDocument(
		document: FileParsedDocument,
		_cancellationToken: vscode.CancellationToken
	): Promise<void> {
		// File parsing is read-only
		// Export functionality handled separately
	}

	/**
	 * Save document as new file
	 */
	async saveCustomDocumentAs(
		document: FileParsedDocument,
		destination: vscode.Uri,
		_cancellationToken: vscode.CancellationToken
	): Promise<void> {
		// Export to JSON file
		if (document.parseResult) {
			const jsonContent = JSON.stringify(
				document.parseResult.preview.map((row) => row.data),
				null,
				2
			);
			const bytes = Buffer.from(jsonContent, 'utf-8');
			await vscode.workspace.fs.writeFile(destination, bytes);
		}
	}

	/**
	 * Revert document (currently no-op)
	 */
	async revertCustomDocument(
		_document: FileParsedDocument,
		_cancellationToken: vscode.CancellationToken
	): Promise<void> {
		// No-op: file parsing is read-only
	}

	/**
	 * Backup custom document
	 */
	async backupCustomDocument(
		_document: FileParsedDocument,
		context: vscode.CustomDocumentBackupContext,
		_cancellationToken: vscode.CancellationToken
	): Promise<vscode.CustomDocumentBackup> {
		// Create a backup by copying the file
		const backupId = context.destination.fsPath;
		return {
			id: backupId,
			delete: async () => {
				try {
					await vscode.workspace.fs.delete(context.destination);
				} catch {
					// Ignore errors
				}
			},
		};
	}

	/**
	 * Parse file and update document
	 */
	private async parseFile(document: FileParsedDocument): Promise<void> {
		try {
			// Show progress
			vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Window,
					title: `Parsing ${path.basename(document.uri.fsPath)}...`,
					cancellable: false,
				},
				async (progress) => {
					const fileStats = fs.statSync(document.uri.fsPath);
					const fileSizeKB = fileStats.size / 1024;

					// Compute input hash
					const reconciler = new HashReconciler();
					progress.report({ increment: 10 });
					await reconciler.computeInputHash(document.uri.fsPath);

					// Get metadata
					const metadata = await StreamParserFactory.getMetadata(document.uri.fsPath);
					progress.report({ increment: 20 });

					// Parse file
					const preview: any[] = [];
					const PREVIEW_SIZE = 100; // Show first 100 rows in preview
					let rowCount = 0;

					const parser = StreamParserFactory.parseStream(document.uri.fsPath);
					for await (const row of parser) {
						reconciler.hashRow(row);
						if (rowCount < PREVIEW_SIZE) {
							preview.push(row);
						}
						rowCount++;
						progress.report({ increment: (70 / Math.max(metadata.totalRows, 1)) * 0.1 });
					}

					// Finalize hash
					reconciler.finalizeOutputHash();
					const reconciliation = reconciler.verify();

					// Store parse result
					document.parseResult = {
						totalRows: rowCount,
						totalSize: fileStats.size,
						inputHash: reconciliation.inputHash,
						outputHash: reconciliation.outputHash,
						headers: metadata.headers,
						preview,
					};

					progress.report({ increment: 100 });

					// Notify that parsing is complete
					vscode.window.showInformationMessage(
						`✅ Parsed ${rowCount} rows | Hash match: ${reconciliation.match ? '✅' : '⚠️'}`
					);
				}
			);
		} catch (err) {
			vscode.window.showErrorMessage(`Failed to parse file: ${err}`);
		}
	}

	/**
	 * Handle messages from webview
	 */
	private async handleWebviewMessage(
		message: any,
		document: FileParsedDocument,
		webviewPanel: vscode.WebviewPanel
	): Promise<void> {
		switch (message.type) {
			case 'export-json':
				await this.exportJSON(document);
				break;
			case 'copy-to-clipboard':
				await this.copyToClipboard(document);
				break;
			default:
				console.log('Unknown message type:', message.type);
		}
	}

	/**
	 * Export parsed JSON to file
	 */
	private async exportJSON(document: FileParsedDocument): Promise<void> {
		if (!document.parseResult) {
			vscode.window.showErrorMessage('No parse result available');
			return;
		}

		try {
			const saveUri = await vscode.window.showSaveDialog({
				defaultUri: vscode.Uri.file(
					document.uri.fsPath.replace(/\.[^.]+$/, '.json')
				),
				filters: {
					'JSON files': ['json'],
					'All files': ['*'],
				},
			});

			if (saveUri) {
				const jsonContent = JSON.stringify(
					document.parseResult.preview.map((row) => row.data),
					null,
					2
				);
				const bytes = Buffer.from(jsonContent, 'utf-8');
				await vscode.workspace.fs.writeFile(saveUri, bytes);
				vscode.window.showInformationMessage(
					`✅ Exported to ${path.basename(saveUri.fsPath)}`
				);
			}
		} catch (err) {
			vscode.window.showErrorMessage(`Export failed: ${err}`);
		}
	}

	/**
	 * Copy parsed JSON to clipboard
	 */
	private async copyToClipboard(document: FileParsedDocument): Promise<void> {
		if (!document.parseResult) {
			vscode.window.showErrorMessage('No parse result available');
			return;
		}

		try {
			const jsonContent = JSON.stringify(
				document.parseResult.preview.map((row) => row.data),
				null,
				2
			);
			await vscode.env.clipboard.writeText(jsonContent);
			vscode.window.showInformationMessage('✅ Copied to clipboard');
		} catch (err) {
			vscode.window.showErrorMessage(`Copy failed: ${err}`);
		}
	}
}
