import * as vscode from 'vscode';
import { ContainerManager, Container } from './containerUtils';

export class ContainerDetailsPanel {
    public static currentPanel: ContainerDetailsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _container: Container;

    public static async createOrShow(extensionUri: vscode.Uri, container: Container) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ContainerDetailsPanel.currentPanel) {
            ContainerDetailsPanel.currentPanel._container = container;
            ContainerDetailsPanel.currentPanel._panel.reveal(column);
            await ContainerDetailsPanel.currentPanel._update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'containerDetails',
            `Container: ${container.name || container.id}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            }
        );

        ContainerDetailsPanel.currentPanel = new ContainerDetailsPanel(panel, extensionUri, container);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, container: Container) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._container = container;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'startContainer':
                        await ContainerManager.startContainer(this._container.id);
                        this._refreshContainer();
                        return;
                    case 'stopContainer':
                        await ContainerManager.stopContainer(this._container.id);
                        this._refreshContainer();
                        return;
                    case 'removeContainer':
                        const confirm = await vscode.window.showWarningMessage(
                            `Are you sure you want to remove container "${this._container.name || this._container.id}"?`,
                            'Yes', 'No'
                        );
                        if (confirm === 'Yes') {
                            await ContainerManager.removeContainer(this._container.id);
                            this.dispose();
                        }
                        return;
                    case 'viewLogs':
                        ContainerManager.streamContainerLogs(this._container.id, this._container.name);
                        return;
                    case 'refresh':
                        this._refreshContainer();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private async _refreshContainer() {
        try {
            const containers = await ContainerManager.listContainers(true);
            const updated = containers.find(c => c.id === this._container.id);
            if (updated) {
                this._container = updated;
                this._panel.title = `Container: ${this._container.name || this._container.id}`;
                await this._update();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh container: ${error}`);
        }
    }

    public dispose() {
        ContainerDetailsPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _update() {
        const webview = this._panel.webview;
        
        // Get detailed inspection data
        let inspectionData = null;
        try {
            inspectionData = await ContainerManager.inspectContainer(this._container.id);
        } catch (error) {
            // Inspection might fail if container doesn't exist anymore
        }

        this._panel.webview.html = this._getHtmlForWebview(webview, inspectionData);
    }

    private _getHtmlForWebview(webview: vscode.Webview, inspectionData: any) {
        const container = this._container;
        const isRunning = container.status.toLowerCase().includes('running');
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Container Details</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
            margin: 0;
        }
        
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }
        
        .header h1 {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .status-badge {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .status-running {
            background-color: rgba(40, 167, 69, 0.2);
            color: var(--vscode-gitDecoration-addedResourceForeground);
            border: 1px solid rgba(40, 167, 69, 0.5);
        }
        
        .status-stopped {
            background-color: rgba(220, 53, 69, 0.2);
            color: var(--vscode-gitDecoration-deletedResourceForeground);
            border: 1px solid rgba(220, 53, 69, 0.5);
        }
        
        .actions {
            display: flex;
            gap: 10px;
        }
        
        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 0.9em;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .btn-danger {
            background-color: var(--vscode-errorBackground);
            color: var(--vscode-errorForeground);
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .detail-section {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 20px;
        }
        
        .detail-section h3 {
            margin: 0 0 15px 0;
            color: var(--vscode-textLink-foreground);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .detail-item {
            margin-bottom: 12px;
        }
        
        .detail-label {
            font-weight: 500;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
            display: block;
        }
        
        .detail-value {
            font-family: var(--vscode-editor-font-family);
            background-color: var(--vscode-input-background);
            padding: 8px 12px;
            border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            word-break: break-all;
            font-size: 0.9em;
        }
        
        .detail-value.highlight {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
        }
        
        .access-info {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
            padding: 15px;
            border-radius: 0 6px 6px 0;
            margin: 20px 0;
        }
        
        .access-info h4 {
            margin: 0 0 10px 0;
            color: var(--vscode-textLink-foreground);
        }
        
        .access-command {
            font-family: var(--vscode-editor-font-family);
            background-color: var(--vscode-terminal-background);
            color: var(--vscode-terminal-foreground);
            padding: 10px;
            border-radius: 3px;
            margin: 8px 0;
            font-size: 0.9em;
        }
        
        .json-section {
            margin-top: 30px;
        }
        
        .json-content {
            background-color: var(--vscode-terminal-background);
            color: var(--vscode-terminal-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: 0.8em;
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            white-space: pre;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .icon {
            width: 16px;
            height: 16px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            <span class="icon">${isRunning ? '▶️' : '⏹️'}</span>
            ${container.name || container.id}
            <span class="status-badge ${isRunning ? 'status-running' : 'status-stopped'}">
                ${container.status}
            </span>
        </h1>
        <div class="actions">
            <button class="btn btn-secondary" onclick="refreshContainer()">
                🔄 Refresh
            </button>
            ${isRunning ? 
                '<button class="btn" onclick="stopContainer()">⏹️ Stop</button>' : 
                '<button class="btn" onclick="startContainer()">▶️ Start</button>'
            }
            <button class="btn btn-secondary" onclick="viewLogs()">
                📋 Stream Logs
            </button>
            <button class="btn btn-danger" onclick="removeContainer()">
                🗑️ Remove
            </button>
        </div>
    </div>
    
    <div class="details-grid">
        <div class="detail-section">
            <h3>📋 Basic Information</h3>
            
            <div class="detail-item">
                <label class="detail-label">Container ID</label>
                <div class="detail-value">${container.id}</div>
            </div>
            
            <div class="detail-item">
                <label class="detail-label">Name</label>
                <div class="detail-value">${container.name || 'N/A'}</div>
            </div>
            
            <div class="detail-item">
                <label class="detail-label">Image</label>
                <div class="detail-value">${container.image}</div>
            </div>
            
            <div class="detail-item">
                <label class="detail-label">Status</label>
                <div class="detail-value highlight">${container.status}</div>
            </div>
        </div>
        
        <div class="detail-section">
            <h3>🌐 Network Information</h3>
            
            ${container.ipAddress ? `
            <div class="detail-item">
                <label class="detail-label">IP Address</label>
                <div class="detail-value highlight">${container.ipAddress}</div>
            </div>
            ` : '<div class="detail-item">No network information available</div>'}
            
            ${container.os && container.arch ? `
            <div class="detail-item">
                <label class="detail-label">Platform</label>
                <div class="detail-value">${container.os}/${container.arch}</div>
            </div>
            ` : ''}
        </div>
        
        <div class="detail-section">
            <h3>🕒 Timeline</h3>
            
            <div class="detail-item">
                <label class="detail-label">Created</label>
                <div class="detail-value">${container.created || 'Unknown'}</div>
            </div>
        </div>
    </div>
    
    ${container.ipAddress && isRunning ? `
    <div class="access-info">
        <h4>🔗 How to Access This Container</h4>
        <p>Since this container is running, you can connect to it directly using its IP address:</p>
        <div class="access-command">
            # For Redis (default port 6379):
            redis-cli -h ${container.ipAddress} -p 6379
        </div>
        <div class="access-command">
            # For HTTP services (port 80):
            curl http://${container.ipAddress}:80
        </div>
        <div class="access-command">
            # Or access in browser:
            http://${container.ipAddress}:YOUR_PORT
        </div>
    </div>
    ` : isRunning ? `
    <div class="access-info">
        <h4>🔗 How to Access This Container</h4>
        <p>Run <code>container ls</code> to get the container's IP address, then connect directly to that IP.</p>
    </div>
    ` : ''}
    
    ${inspectionData ? `
    <div class="json-section">
        <h3>🔍 Raw Container Inspection</h3>
        <div class="json-content">${JSON.stringify(inspectionData, null, 2)}</div>
    </div>
    ` : ''}
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function startContainer() {
            vscode.postMessage({ command: 'startContainer' });
        }
        
        function stopContainer() {
            vscode.postMessage({ command: 'stopContainer' });
        }
        
        function removeContainer() {
            vscode.postMessage({ command: 'removeContainer' });
        }
        
        function viewLogs() {
            vscode.postMessage({ command: 'viewLogs' });
        }
        
        function refreshContainer() {
            vscode.postMessage({ command: 'refresh' });
        }
    </script>
</body>
</html>`;
    }
}