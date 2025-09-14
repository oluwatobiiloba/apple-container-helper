import * as vscode from 'vscode';
import { ContainerManager } from './containerUtils';

export class ContainerFormPanel {
    public static currentPanel: ContainerFormPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, imageReference?: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ContainerFormPanel.currentPanel) {
            ContainerFormPanel.currentPanel._panel.reveal(column);
            if (imageReference) {
                ContainerFormPanel.currentPanel._updateImageReference(imageReference);
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'containerForm',
            'Advanced Container Run',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            }
        );

        ContainerFormPanel.currentPanel = new ContainerFormPanel(panel, extensionUri, imageReference);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, imageReference?: string) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update(imageReference);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'runContainer':
                        this._handleRunContainer(message.data);
                        return;
                    case 'closePanel':
                        this.dispose();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private _updateImageReference(imageReference: string) {
        this._panel.webview.postMessage({
            command: 'updateImageReference',
            imageReference: imageReference
        });
    }

    private async _handleRunContainer(data: any) {
        try {
            const success = await ContainerManager.runContainerAdvanced(data.image, {
                name: data.name || undefined,
                detach: data.detach,
                interactive: data.interactive,
                tty: data.tty,
                remove: data.remove,
                referencePorts: data.ports ? data.ports.split('\n').filter((p: string) => p.trim()) : [],
                volumes: data.volumes ? data.volumes.split('\n').filter((v: string) => v.trim()) : [],
                env: data.env ? data.env.split('\n').filter((e: string) => e.trim()) : [],
                workdir: data.workdir || undefined,
                user: data.user || undefined,
                entrypoint: data.entrypoint || undefined,
                command: data.command || undefined,
                cpus: data.cpus ? parseFloat(data.cpus) : undefined,
                memory: data.memory || undefined,
                network: data.network || undefined,
                labels: data.labels ? data.labels.split('\n').filter((l: string) => l.trim()) : [],
                dns: data.dns ? data.dns.split('\n').filter((d: string) => d.trim()) : []
            });

            if (success) {
                vscode.window.showInformationMessage('Container started successfully');
                this._panel.dispose();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to run container: ${error}`);
        }
    }

    public dispose() {
        ContainerFormPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update(imageReference?: string) {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview, imageReference);
    }

    private _getHtmlForWebview(webview: vscode.Webview, imageReference?: string) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Advanced Container Run</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        
        .form-section {
            margin-bottom: 25px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 15px;
        }
        
        .form-section h3 {
            margin-top: 0;
            margin-bottom: 15px;
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        
        .form-row {
            display: flex;
            margin-bottom: 15px;
            align-items: flex-start;
        }
        
        .form-row.full-width {
            flex-direction: column;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            min-width: 120px;
            margin-right: 15px;
        }
        
        .full-width label {
            min-width: auto;
            margin-right: 0;
        }
        
        input[type="text"], input[type="number"], textarea, select {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            padding: 8px 12px;
            border-radius: 2px;
            flex: 1;
            font-family: inherit;
            font-size: inherit;
        }
        
        textarea {
            min-height: 80px;
            resize: vertical;
            font-family: var(--vscode-editor-font-family);
        }
        
        input[type="checkbox"] {
            margin-right: 8px;
            transform: scale(1.1);
        }
        
        .checkbox-row {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .checkbox-row label {
            margin-bottom: 0;
            min-width: auto;
            margin-right: 0;
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 2px;
            cursor: pointer;
            font-size: inherit;
            margin-right: 10px;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .button-row {
            display: flex;
            justify-content: flex-end;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        .help-text {
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        
        .required {
            color: var(--vscode-errorForeground);
        }
    </style>
</head>
<body>
    <h2>Advanced Container Run Configuration</h2>
    
    <form id="containerForm">
        <div class="form-section">
            <h3>Basic Configuration</h3>
            
            <div class="form-row full-width">
                <label for="image">Image <span class="required">*</span></label>
                <input type="text" id="image" required value="${imageReference || ''}" placeholder="e.g., docker.io/library/nginx:latest">
                <div class="help-text">Full image reference including registry and tag</div>
            </div>
            
            <div class="form-row">
                <label for="name">Container Name</label>
                <input type="text" id="name" placeholder="Optional container name">
            </div>
            
            <div class="form-row">
                <label for="command">Command</label>
                <input type="text" id="command" placeholder="Override default command">
            </div>
        </div>
        
        <div class="form-section">
            <h3>Runtime Options</h3>
            
            <div class="checkbox-row">
                <input type="checkbox" id="detach" checked>
                <label for="detach">Detach (-d) - Run container in background</label>
            </div>
            
            <div class="checkbox-row">
                <input type="checkbox" id="interactive" checked>
                <label for="interactive">Interactive (-i) - Keep STDIN open</label>
            </div>
            
            <div class="checkbox-row">
                <input type="checkbox" id="tty" checked>
                <label for="tty">TTY (-t) - Allocate a pseudo-TTY</label>
            </div>
            
            <div class="checkbox-row">
                <input type="checkbox" id="remove">
                <label for="remove">Auto Remove (--rm) - Remove container when it exits</label>
            </div>
        </div>
        
        <div class="form-section">
            <h3>Networking</h3>
            
            <div class="help-text" style="margin-bottom: 15px; padding: 10px; background-color: var(--vscode-editorWidget-background); border-left: 3px solid var(--vscode-textLink-foreground);">
                <strong>Note:</strong> Apple Container CLI doesn't support port publishing. Containers get their own IP addresses. Specify ports below for reference - you'll access them directly via the container's IP.
            </div>
            
            <div class="form-row full-width">
                <label for="ports">Ports to Expose (for reference)</label>
                <textarea id="ports" placeholder="80&#10;3000&#10;6379"></textarea>
                <div class="help-text">Container ports you want to access. One port per line. Use <code>container ls</code> to get the container IP address.</div>
            </div>
            
            <div class="form-row full-width">
                <label for="dns">DNS Servers</label>
                <textarea id="dns" placeholder="8.8.8.8&#10;1.1.1.1"></textarea>
                <div class="help-text">One DNS server per line</div>
            </div>
        </div>
        
        <div class="form-section">
            <h3>Storage</h3>
            
            <div class="form-row full-width">
                <label for="volumes">Volume Mounts (-v)</label>
                <textarea id="volumes" placeholder="/host/path:/container/path&#10;/another/host/path:/another/container/path:ro"></textarea>
                <div class="help-text">One volume mount per line. Format: host-path:container-path[:options]</div>
            </div>
        </div>
        
        <div class="form-section">
            <h3>Process & Resources</h3>
            
            <div class="form-row">
                <label for="workdir">Working Directory (-w)</label>
                <input type="text" id="workdir" placeholder="/app">
            </div>
            
            <div class="form-row">
                <label for="user">User (-u)</label>
                <input type="text" id="user" placeholder="1000:1000 or username">
            </div>
            
            <div class="form-row">
                <label for="entrypoint">Entrypoint</label>
                <input type="text" id="entrypoint" placeholder="Override image entrypoint">
            </div>
            
            <div class="form-row">
                <label for="cpus">CPUs (-c)</label>
                <input type="number" id="cpus" step="0.1" min="0.1" placeholder="2">
            </div>
            
            <div class="form-row">
                <label for="memory">Memory (-m)</label>
                <input type="text" id="memory" placeholder="1G, 512M, 2048MB">
            </div>
        </div>
        
        <div class="form-section">
            <h3>Environment & Labels</h3>
            
            <div class="form-row full-width">
                <label for="env">Environment Variables (-e)</label>
                <textarea id="env" placeholder="NODE_ENV=production&#10;PORT=3000&#10;API_KEY=secret"></textarea>
                <div class="help-text">One environment variable per line. Format: KEY=value</div>
            </div>
            
            <div class="form-row full-width">
                <label for="labels">Labels (-l)</label>
                <textarea id="labels" placeholder="version=1.0&#10;environment=production"></textarea>
                <div class="help-text">One label per line. Format: key=value</div>
            </div>
        </div>
        
        <div class="button-row">
            <button type="button" onclick="runContainer()">Run Container</button>
            <button type="button" onclick="closePanel()">Cancel</button>
        </div>
    </form>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function runContainer() {
            const form = document.getElementById('containerForm');
            const formData = new FormData(form);
            
            const data = {
                image: document.getElementById('image').value,
                name: document.getElementById('name').value,
                command: document.getElementById('command').value,
                detach: document.getElementById('detach').checked,
                interactive: document.getElementById('interactive').checked,
                tty: document.getElementById('tty').checked,
                remove: document.getElementById('remove').checked,
                ports: document.getElementById('ports').value,
                dns: document.getElementById('dns').value,
                volumes: document.getElementById('volumes').value,
                workdir: document.getElementById('workdir').value,
                user: document.getElementById('user').value,
                entrypoint: document.getElementById('entrypoint').value,
                cpus: document.getElementById('cpus').value,
                memory: document.getElementById('memory').value,
                env: document.getElementById('env').value,
                labels: document.getElementById('labels').value
            };
            
            if (!data.image) {
                alert('Image is required');
                return;
            }
            
            vscode.postMessage({
                command: 'runContainer',
                data: data
            });
        }
        
        function closePanel() {
            vscode.postMessage({
                command: 'closePanel'
            });
        }
        
        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateImageReference':
                    document.getElementById('image').value = message.imageReference;
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}