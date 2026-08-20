/**
 * Webview content provider for rendering parsed file data
 * Generates HTML with virtual scrolling and JSON formatting
 */

import * as vscode from 'vscode';
import { IFileParsedDocument } from '../types/interfaces';

export class WebviewProvider {
	constructor(private context: vscode.ExtensionContext) {}

	getWebviewContent(webview: vscode.Webview, document: IFileParsedDocument): string {
		const virtualScrollerUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'virtualScroller.js')
		);

		const nonce = this.getNonce();

		// Parse result or empty state
		const parseData = document.parseResult
			? JSON.stringify({
					totalRows: document.parseResult.totalRows,
					totalSize: document.parseResult.totalSize,
					headers: document.parseResult.headers || [],
					preview: document.parseResult.preview,
					allData: document.parseResult.preview,  // All parsed rows for virtual scroller
					inputHash: document.parseResult.inputHash.substring(0, 8),
					outputHash: document.parseResult.outputHash.substring(0, 8),
					hashMatch:
						document.parseResult.inputHash === document.parseResult.outputHash,
				})
			: null;

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>File Parser</title>
				<style nonce="${nonce}">
					* {
						margin: 0;
						padding: 0;
						box-sizing: border-box;
					}

					body {
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu',
							'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
						background-color: var(--vscode-editor-background);
						color: var(--vscode-editor-foreground);
						overflow: hidden;
						display: flex;
						flex-direction: column;
						height: 100vh;
					}

					.header {
						padding: 12px 16px;
						border-bottom: 1px solid var(--vscode-panel-border);
						background-color: var(--vscode-panel-background);
						display: flex;
						justify-content: space-between;
						align-items: center;
						flex-shrink: 0;
					}

					.header-left {
						display: flex;
						gap: 12px;
						align-items: center;
					}

					.header-right {
						display: flex;
						gap: 8px;
						align-items: center;
					}

					.stats {
						font-size: 12px;
						color: var(--vscode-descriptionForeground);
						display: flex;
						gap: 16px;
					}

					.stat-item {
						display: flex;
						gap: 4px;
					}

					.stat-label {
						color: var(--vscode-descriptionForeground);
					}

					.stat-value {
						color: var(--vscode-editor-foreground);
						font-weight: 500;
					}

					.reconciliation-badge {
						display: flex;
						align-items: center;
						gap: 4px;
						padding: 4px 8px;
						border-radius: 4px;
						font-size: 12px;
						font-weight: 500;
					}

					.reconciliation-badge.match {
						background-color: rgba(76, 175, 80, 0.1);
						color: #4caf50;
					}

					.reconciliation-badge.mismatch {
						background-color: rgba(255, 152, 0, 0.1);
						color: #ff9800;
					}

					.button {
						padding: 6px 12px;
						border-radius: 2px;
						border: 1px solid var(--vscode-button-border);
						background-color: var(--vscode-button-background);
						color: var(--vscode-button-foreground);
						cursor: pointer;
						font-size: 12px;
						transition: background-color 0.2s;
					}

					.button:hover {
						background-color: var(--vscode-button-hoverBackground);
					}

					.button:active {
						opacity: 0.8;
					}

					.table-container {
						flex: 1;
						overflow: hidden;
						display: flex;
						flex-direction: column;
					}

					.table-wrapper {
						flex: 1;
						overflow-y: auto;
						overflow-x: auto;
						background-color: var(--vscode-editor-background);
					}

					table {
						width: 100%;
						border-collapse: collapse;
						font-size: 12px;
						font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
					}

					thead {
						position: sticky;
						top: 0;
						background-color: var(--vscode-editor-lineNumberForeground);
						z-index: 10;
					}

					thead tr {
						border-bottom: 1px solid var(--vscode-panel-border);
					}

					th {
						padding: 8px 12px;
						text-align: left;
						font-weight: 600;
						color: var(--vscode-editor-foreground);
						background-color: var(--vscode-editor-background);
						border-right: 1px solid var(--vscode-panel-border);
					}

					th:last-child {
						border-right: none;
					}

					td {
						padding: 8px 12px;
						border-right: 1px solid var(--vscode-panel-border);
						word-break: break-all;
						max-width: 400px;
						white-space: pre-wrap;
					}

					td:last-child {
						border-right: none;
					}

					tbody tr:nth-child(even) {
						background-color: rgba(255, 255, 255, 0.02);
					}

					tbody tr:hover {
						background-color: rgba(255, 255, 255, 0.05);
					}

					.empty-state {
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
						height: 100%;
						gap: 12px;
						color: var(--vscode-descriptionForeground);
					}

					.empty-state-icon {
						font-size: 48px;
						opacity: 0.5;
					}

					.loading {
						display: flex;
						align-items: center;
						justify-content: center;
						height: 100%;
						gap: 8px;
						color: var(--vscode-descriptionForeground);
					}

					.spinner {
						width: 20px;
						height: 20px;
						border: 2px solid var(--vscode-panel-border);
						border-top-color: var(--vscode-editor-foreground);
						border-radius: 50%;
						animation: spin 0.6s linear infinite;
					}

					@keyframes spin {
						to {
							transform: rotate(360deg);
						}
					}

					.error-banner {
						padding: 12px 16px;
						background-color: rgba(244, 67, 54, 0.1);
						color: #f44336;
						border-bottom: 1px solid #f44336;
						display: flex;
						gap: 8px;
						align-items: center;
					}

					.error-banner-icon {
						flex-shrink: 0;
					}

					.row-number {
						background-color: var(--vscode-editorLineNumber-background);
						color: var(--vscode-editorLineNumber-foreground);
						text-align: right;
						min-width: 50px;
						user-select: none;
					}

					.row-even {
						background-color: var(--vscode-editor-background);
					}

					.row-odd {
						background-color: rgba(255, 255, 255, 0.02);
					}

					tbody.scrolling tr {
						pointer-events: none;
					}

					.table-wrapper.virtual-scroll {
						overflow-y: scroll;
					}
				</style>
			</head>
			<body>
				<div class="header">
					<div class="header-left">
						<span style="font-weight: 600">Parsed Data</span>
					</div>
					<div class="header-right">
						<div class="stats" id="stats">
							<div class="stat-item">
								<span class="stat-label">Rows:</span>
								<span class="stat-value" id="row-count">—</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">Size:</span>
								<span class="stat-value" id="file-size">—</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">Hash:</span>
								<span class="stat-value" id="hash-value" title="Input Hash | Output Hash">—</span>
							</div>
						</div>
						<div id="reconciliation" class="reconciliation-badge"></div>
						<button class="button" id="export-btn" title="Export as JSON">📥 Export</button>
						<button class="button" id="copy-btn" title="Copy to Clipboard">📋 Copy</button>
					</div>
				</div>

				<div id="error-banner"></div>

				<div class="table-container">
					<div id="loading" class="loading" style="display: none">
						<div class="spinner"></div>
						<span>Parsing file...</span>
					</div>
					<div id="empty-state" class="empty-state" style="display: none">
						<div class="empty-state-icon">📄</div>
						<div>No data to display</div>
					</div>
					<div class="table-wrapper virtual-scroll" id="table-wrapper" style="display: none">
						<table id="data-table">
							<thead id="table-head"></thead>
							<tbody id="table-body"></tbody>
						</table>
					</div>
				</div>

				<script src="${virtualScrollerUri}" nonce="${nonce}"></script>
				<script nonce="${nonce}" type="module">
					const vscode = acquireVsCodeApi();
					const parseData = ${parseData || 'null'};
					let virtualScroller = null;

					document.getElementById('export-btn').addEventListener('click', () => {
						vscode.postMessage({ type: 'export-json' });
					});

					document.getElementById('copy-btn').addEventListener('click', () => {
						vscode.postMessage({ type: 'copy-to-clipboard' });
					});

					function formatFileSize(bytes) {
						if (bytes === 0) return '0 B';
						const k = 1024;
						const sizes = ['B', 'KB', 'MB', 'GB'];
						const i = Math.floor(Math.log(bytes) / Math.log(k));
						return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
					}

					function renderTable() {
						if (!parseData || !parseData.allData || parseData.allData.length === 0) {
							document.getElementById('empty-state').style.display = 'flex';
							return;
						}

						// Render headers
						const thead = document.getElementById('table-head');
						const headerRow = document.createElement('tr');
						headerRow.innerHTML = '<th class="row-number">#</th>';
						parseData.headers.forEach(header => {
							const th = document.createElement('th');
							th.textContent = header;
							headerRow.appendChild(th);
						});
						thead.appendChild(headerRow);

						// Initialize virtual scroller with all data
						const tbody = document.getElementById('table-body');
						const tableWrapper = document.getElementById('table-wrapper');
						
						virtualScroller = new window.VirtualScroller(tbody, {
							rowHeight: 35,
							bufferSize: 100,
							throttleMs: 100
						});

						// Transform data for virtual scroller compatibility
						const rows = parseData.allData.map(row => ({
							rowIndex: row.rowIndex,
							data: row.data,
							// Add metadata for rendering
							_headers: parseData.headers
						}));

						virtualScroller.setData(rows);
						
						// Store reference to headers in tbody for virtual scroller to access
						tbody.dataset.headers = JSON.stringify(parseData.headers);
						
						// Render initial visible rows
						virtualScroller.render();

						// Initial scroll position
						tableWrapper.scrollTop = 0;

						document.getElementById('table-wrapper').style.display = 'block';
					}

					function updateStats() {
						if (parseData) {
							document.getElementById('row-count').textContent = parseData.totalRows.toLocaleString();
							document.getElementById('file-size').textContent = formatFileSize(parseData.totalSize);
							document.getElementById('hash-value').textContent =
								parseData.inputHash + ' | ' + parseData.outputHash;

							const badge = document.getElementById('reconciliation');
							if (parseData.hashMatch) {
								badge.className = 'reconciliation-badge match';
								badge.textContent = '✅ Hash Match';
							} else {
								badge.className = 'reconciliation-badge mismatch';
								badge.textContent = '⚠️ Hash Mismatch';
							}
						}
					}

					if (parseData) {
						renderTable();
						updateStats();
					} else {
						document.getElementById('empty-state').style.display = 'flex';
					}

					// Handle window resize
					window.addEventListener('resize', () => {
						if (virtualScroller) {
							virtualScroller.refresh();
						}
					});

					// Cleanup on page unload
					window.addEventListener('beforeunload', () => {
						if (virtualScroller) {
							virtualScroller.destroy();
						}
					});
				</script>
			</body>
			</html>`;
	}

	private getNonce(): string {
		let text = '';
		const possible =
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}
}
