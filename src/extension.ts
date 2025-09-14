import * as vscode from 'vscode';
import * as os from 'os';
import { ContainerManager } from './containerUtils';
import { ContainerProvider, ContainerItem, ImageItem } from './containerProvider';
import { ContainerFormPanel } from './containerForm';
import { ContainerDetailsPanel } from './containerDetails';

let containerProvider: ContainerProvider;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
    // Check if running on macOS
    if (os.platform() !== 'darwin') {
        vscode.window.showErrorMessage('Apple Container Helper is only supported on macOS');
        return;
    }

    // Check if container CLI is available
    await ContainerManager.checkContainerCliInstallation();

    // Start container system
    await ContainerManager.startContainerSystem();

    // Initialize tree data provider
    containerProvider = new ContainerProvider();
    vscode.window.registerTreeDataProvider('containerExplorer', containerProvider);

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'apple-container-helper.refreshContainers';
    updateStatusBar();
    statusBarItem.show();

    // Register commands
    const commands = [
        // Container management
        vscode.commands.registerCommand('apple-container-helper.refreshContainers', () => {
            containerProvider.refresh();
            updateStatusBar();
        }),

        vscode.commands.registerCommand('apple-container-helper.refreshImages', () => {
            containerProvider.refresh();
        }),

        vscode.commands.registerCommand('apple-container-helper.pruneImages', async () => {
            const success = await ContainerManager.pruneImages();
            if (success) {
                containerProvider.refresh();
            }
        }),
        
        vscode.commands.registerCommand('apple-container-helper.toggleShowAllContainers', () => {
            containerProvider.toggleShowAll();
        }),

        vscode.commands.registerCommand('apple-container-helper.startContainer', async (item: ContainerItem) => {
            if (item && item.container) {
                await ContainerManager.startContainer(item.container.id);
                containerProvider.refresh();
                updateStatusBar();
            }
        }),

        vscode.commands.registerCommand('apple-container-helper.stopContainer', async (item: ContainerItem) => {
            if (item && item.container) {
                await ContainerManager.stopContainer(item.container.id);
                containerProvider.refresh();
                updateStatusBar();
            }
        }),

        vscode.commands.registerCommand('apple-container-helper.removeContainer', async (item: ContainerItem) => {
            if (item && item.container) {
                const confirm = await vscode.window.showWarningMessage(
                    `Are you sure you want to remove container "${item.container.name || item.container.id}"?`,
                    'Yes', 'No'
                );
                
                if (confirm === 'Yes') {
                    await ContainerManager.removeContainer(item.container.id);
                    containerProvider.refresh();
                    updateStatusBar();
                }
            }
        }),

        vscode.commands.registerCommand('apple-container-helper.forceRemoveContainer', async (item: ContainerItem) => {
            if (item && item.container) {
                const confirm = await vscode.window.showWarningMessage(
                    `Are you sure you want to force remove container "${item.container.name || item.container.id}"?`,
                    'Yes', 'No'
                );
                
                if (confirm === 'Yes') {
                    await ContainerManager.removeContainer(item.container.id, true);
                    containerProvider.refresh();
                    updateStatusBar();
                }
            }
        }),

        vscode.commands.registerCommand('apple-container-helper.inspectContainer', async (container) => {
            const inspection = await ContainerManager.inspectContainer(container.id);
            if (inspection) {
                const doc = await vscode.workspace.openTextDocument({
                    content: JSON.stringify(inspection, null, 2),
                    language: 'json'
                });
                vscode.window.showTextDocument(doc);
            }
        }),

        vscode.commands.registerCommand('apple-container-helper.showContainerDetails', (container) => {
            ContainerDetailsPanel.createOrShow(context.extensionUri, container);
        }),

        vscode.commands.registerCommand('apple-container-helper.containerLogs', (item: ContainerItem) => {
            if (item && item.container) {
                ContainerManager.streamContainerLogs(item.container.id, item.container.name);
            }
        }),

        vscode.commands.registerCommand('apple-container-helper.execInContainer', async (item: ContainerItem) => {
            if (item && item.container) {
                const command = await vscode.window.showInputBox({
                    prompt: 'Enter command to execute',
                    value: '/bin/bash'
                });
                
                if (command !== undefined && command) {
                    await ContainerManager.execInContainer(item.container.id, command);
                }
            }
        }),

        // Image management
        vscode.commands.registerCommand('apple-container-helper.removeImage', async (item: ImageItem) => {
            if (item && item.image) {
                const confirm = await vscode.window.showWarningMessage(
                    `Are you sure you want to remove image "${item.image.repository}:${item.image.tag}"?`,
                    'Yes', 'No'
                );
                
                if (confirm === 'Yes') {
                    await ContainerManager.removeImage(item.image.id);
                    containerProvider.refresh();
                }
            }
        }),

        vscode.commands.registerCommand('apple-container-helper.inspectImage', async (image) => {
            const inspection = await ContainerManager.inspectImageJson(image.reference);
            if (inspection) {
                const doc = await vscode.workspace.openTextDocument({
                    content: JSON.stringify(inspection, null, 2),
                    language: 'json'
                });
                vscode.window.showTextDocument(doc);
            }
        }),

        vscode.commands.registerCommand('apple-container-helper.runFromImage', async (item: ImageItem) => {
            if (item && item.image) {
                const name = await vscode.window.showInputBox({
                    prompt: 'Container name (optional)'
                });
                
                // Check if user cancelled the input
                if (name === undefined) {
                    return;
                }

                const ports = await vscode.window.showInputBox({
                    prompt: 'Ports to expose (for reference, comma-separated, e.g., 80,3000,6379)',
                    placeHolder: 'Container ports you want to access'
                });

                // Check if user cancelled the input
                if (ports === undefined) {
                    return;
                }

                const options: any = {
                    detach: true,
                    interactive: true,
                    tty: true
                };

                if (name) {
                    options.name = name;
                }

                // Store ports for reference (not used in command but for user info)
                if (ports) {
                    options.referencePorts = ports.split(',').map(p => p.trim()).filter(p => p);
                }

                await ContainerManager.runContainer(`${item.image.repository}:${item.image.tag}`, options);
                containerProvider.refresh();
                updateStatusBar();
            }
        }),

        vscode.commands.registerCommand('apple-container-helper.pullImage', async () => {
            const image = await vscode.window.showInputBox({
                prompt: 'Enter image name to pull (e.g., nginx:latest)'
            });
            
            if (image !== undefined && image) {
                await ContainerManager.pullImage(image);
                containerProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('apple-container-helper.buildImage', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }

            const contextPath = await vscode.window.showInputBox({
                prompt: 'Build context path',
                value: workspaceFolder.uri.fsPath
            });

            if (contextPath === undefined) {
                return;
            }

            const tag = await vscode.window.showInputBox({
                prompt: 'Image tag (optional)'
            });

            if (tag === undefined) {
                return;
            }

            const dockerfile = await vscode.window.showInputBox({
                prompt: 'Dockerfile path (optional)'
            });

            if (dockerfile === undefined) {
                return;
            }

            if (contextPath) {
                await ContainerManager.buildImage(contextPath, tag, dockerfile);
                containerProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('apple-container-helper.advancedRun', () => {
            ContainerFormPanel.createOrShow(context.extensionUri);
        }),

        vscode.commands.registerCommand('apple-container-helper.advancedRunFromImage', (item: ImageItem) => {
            if (item && item.image) {
                ContainerFormPanel.createOrShow(context.extensionUri, item.image.reference);
            }
        }),

        vscode.commands.registerCommand('apple-container-helper.copyToClipboard', (text: string, label: string) => {
            vscode.env.clipboard.writeText(text).then(() => {
                vscode.window.showInformationMessage(`Copied ${label} to clipboard: ${text}`);
            });
        }),

        vscode.commands.registerCommand('apple-container-helper.streamLogs', (item: ContainerItem) => {
            if (item && item.container) {
                ContainerManager.streamContainerLogs(item.container.id, item.container.name);
            }
        })
    ];

    context.subscriptions.push(statusBarItem, ...commands);

    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
        containerProvider.refresh();
        updateStatusBar();
    }, 30000);

    context.subscriptions.push({ dispose: () => clearInterval(refreshInterval) });
}

async function updateStatusBar() {
    try {
        const containers = await ContainerManager.listContainers();
        const runningContainers = containers.filter(c => 
            c.status.toLowerCase().includes('running')
        ).length;
        
        statusBarItem.text = `$(server-environment) ${runningContainers} running`;
        statusBarItem.tooltip = `${runningContainers} containers running. Click to refresh.`;
    } catch {
        statusBarItem.text = '$(server-environment) Container CLI unavailable';
        statusBarItem.tooltip = 'Apple Container CLI is not available';
    }
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
