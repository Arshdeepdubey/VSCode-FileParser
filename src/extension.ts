// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CustomEditorProvider } from './providers/CustomEditorProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('File Parser extension is now active!');

	// Register Custom Editor Provider for .txt and .csv files
	const customEditorProvider = new CustomEditorProvider(context);
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(
			CustomEditorProvider.viewType,
			customEditorProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			}
		)
	);

	console.log('✅ Custom Editor Provider registered for .txt and .csv files');
}

// This method is called when your extension is deactivated
export function deactivate() {}
