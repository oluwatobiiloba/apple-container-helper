import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Container {
    id: string;
    name: string;
    image: string;
    status: string;
    ports?: string;
    created: string;
    ipAddress?: string;
    os?: string;
    arch?: string;
}

export interface Image {
    id: string;
    repository: string;
    tag: string;
    size: string;
    created: string;
    reference: string;
}

export class ContainerManager {
    
    static async isContainerCliAvailable(): Promise<boolean> {
        try {
            await execAsync('which container');
            return true;
        } catch {
            return false;
        }
    }

    static async checkContainerCliInstallation(): Promise<void> {
        const isAvailable = await this.isContainerCliAvailable();
        
        if (!isAvailable) {
            const action = await vscode.window.showWarningMessage(
                'Apple Container CLI is not installed. This extension requires the container CLI to be available.',
                'Learn More', 'Dismiss'
            );
            
            if (action === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://developer.apple.com/documentation/virtualization'));
            }
        }
    }

    static async startContainerSystem(): Promise<void> {
        try {
            await execAsync('container system start');
            vscode.window.showInformationMessage('Container system started successfully');
        } catch (error) {
            vscode.window.showWarningMessage(`Failed to start container system: ${error}`);
        }
    }

    static async listContainers(all = false): Promise<Container[]> {
        try {
            // First try to get JSON format for detailed info
            const jsonCmd = all ? 'container list --all --format json' : 'container list --format json';
            const { stdout: jsonOutput } = await execAsync(jsonCmd);
            const rawContainers = JSON.parse(jsonOutput);
            
            // Then get table format for IP addresses
            const tableCmd = all ? 'container ls --all' : 'container ls';
            const { stdout: tableOutput } = await execAsync(tableCmd);
            const containerTable = this.parseContainerTable(tableOutput);
            
            return rawContainers.map((rawContainer: any) => {
                const config = rawContainer.configuration || {};
                const id = config.id || 'unknown';
                const image = config.image?.reference || 'unknown';
                
                // Find matching container in table for IP address
                const tableEntry = containerTable.find(entry => entry.id === id);
                
                return {
                    id: id,
                    name: config.hostname || id,
                    image: image,
                    status: rawContainer.status || 'unknown',
                    ports: '', // Apple Container CLI doesn't expose ports in JSON format
                    created: 'unknown',
                    ipAddress: tableEntry?.ipAddress,
                    os: tableEntry?.os,
                    arch: tableEntry?.arch
                } as Container;
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to list containers: ${error}`);
            return [];
        }
    }

    private static parseContainerTable(output: string): Array<{id: string, ipAddress?: string, os?: string, arch?: string}> {
        const lines = output.split('\n').slice(1); // Skip header
        return lines.map(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 6) {
                return {
                    id: parts[0],
                    os: parts[2],
                    arch: parts[3],
                    ipAddress: parts[5] !== 'N/A' ? parts[5] : undefined
                };
            }
            return { id: '' };
        }).filter(entry => entry.id);
    }

    static async listImages(): Promise<Image[]> {
        try {
            const { stdout } = await execAsync('container image list --format json');
            const rawImages = JSON.parse(stdout);
            
            return rawImages.map((rawImage: any) => {
                const reference = rawImage.reference || '';
                const [repositoryWithTag] = reference.split('@');
                const [repository, tag] = repositoryWithTag.split(':');
                
                return {
                    id: rawImage.descriptor?.digest || '',
                    repository: repository || 'unknown',
                    tag: tag || 'latest',
                    size: rawImage.descriptor?.size ? `${Math.round(rawImage.descriptor.size / 1024)} KB` : 'unknown',
                    created: 'unknown',
                    reference: reference
                } as Image;
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to list images: ${error}`);
            return [];
        }
    }

    static async startContainer(containerId: string): Promise<boolean> {
        try {
            await execAsync(`container start ${containerId}`);
            vscode.window.showInformationMessage(`Container ${containerId} started successfully`);
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start container: ${error}`);
            return false;
        }
    }

    static async stopContainer(containerId: string): Promise<boolean> {
        try {
            await execAsync(`container stop ${containerId}`);
            vscode.window.showInformationMessage(`Container ${containerId} stopped successfully`);
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to stop container: ${error}`);
            return false;
        }
    }

    static async removeContainer(containerId: string, force = false): Promise<boolean> {
        try {
            const forceFlag = force ? ' --force' : '';
            await execAsync(`container delete${forceFlag} ${containerId}`);
            vscode.window.showInformationMessage(`Container ${containerId} removed successfully`);
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to remove container: ${error}`);
            return false;
        }
    }

    static async removeImage(imageId: string): Promise<boolean> {
        try {
            await execAsync(`container image delete ${imageId}`);
            vscode.window.showInformationMessage(`Image ${imageId} removed successfully`);
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to remove image: ${error}`);
            return false;
        }
    }

    static async getContainerLogs(containerId: string, follow = false): Promise<string> {
        try {
            const followFlag = follow ? ' --follow' : '';
            const { stdout } = await execAsync(`container logs${followFlag} ${containerId}`);
            return stdout;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to get container logs: ${error}`);
            return '';
        }
    }

    static streamContainerLogs(containerId: string, containerName?: string): vscode.Terminal {
        const terminalName = `Logs: ${containerName || containerId}`;
        const terminal = vscode.window.createTerminal(terminalName);
        
        // Send the streaming logs command
        terminal.sendText(`container logs --follow ${containerId}`);
        terminal.show();
        
        return terminal;
    }

    static async inspectContainer(containerId: string): Promise<any> {
        try {
            const { stdout } = await execAsync(`container inspect ${containerId}`);
            return JSON.parse(stdout);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to inspect container: ${error}`);
            return null;
        }
    }

    static async inspectImageJson(imageReference: string): Promise<any> {
        try {
            const { stdout } = await execAsync(`container image inspect ${imageReference}`);
            return JSON.parse(stdout);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to inspect image: ${error}`);
            return null;
        }
    }

    static async buildImage(contextPath: string, tag?: string, dockerfile?: string): Promise<boolean> {
        try {
            let cmd = `container build ${contextPath}`;
            if (tag) {
                cmd += ` --tag ${tag}`;
            }
            if (dockerfile) {
                cmd += ` --file ${dockerfile}`;
            }

            const terminal = vscode.window.createTerminal('Container Build');
            terminal.sendText(cmd);
            terminal.show();
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to build image: ${error}`);
            return false;
        }
    }

    static async runContainerAdvanced(image: string, options?: {
        name?: string;
        ports?: string[];
        referencePorts?: string[];
        volumes?: string[];
        env?: string[];
        detach?: boolean;
        interactive?: boolean;
        tty?: boolean;
        remove?: boolean;
        command?: string;
        workdir?: string;
        user?: string;
        entrypoint?: string;
        cpus?: number;
        memory?: string;
        network?: string;
        labels?: string[];
        dns?: string[];
    }): Promise<boolean> {
        try {
            let cmd = `container run`;
            
            // Runtime options
            if (options?.detach) {
                cmd += ' --detach';
            }
            if (options?.interactive) {
                cmd += ' --interactive';
            }
            if (options?.tty) {
                cmd += ' --tty';
            }
            if (options?.remove) {
                cmd += ' --rm';
            }
            
            // Container management
            if (options?.name) {
                cmd += ` --name ${options.name}`;
            }
            if (options?.workdir) {
                cmd += ` --workdir "${options.workdir}"`;
            }
            if (options?.user) {
                cmd += ` --user ${options.user}`;
            }
            if (options?.entrypoint) {
                cmd += ` --entrypoint "${options.entrypoint}"`;
            }
            // Note: Apple Container CLI doesn't support --network option
            // Networks are managed via separate container network commands
            
            // Resources
            if (options?.cpus) {
                cmd += ` --cpus ${options.cpus}`;
            }
            if (options?.memory) {
                cmd += ` --memory ${options.memory}`;
            }
            
            // Note: Apple Container CLI doesn't support port publishing via --publish/-p
            // Networking is handled differently - containers get their own IP addresses
            
            if (options?.dns) {
                options.dns.forEach(dns => {
                    cmd += ` --dns ${dns}`;
                });
            }
            
            // Storage
            if (options?.volumes) {
                options.volumes.forEach(volume => {
                    cmd += ` -v ${volume}`;
                });
            }
            
            // Environment and labels
            if (options?.env) {
                options.env.forEach(env => {
                    cmd += ` -e ${env}`;
                });
            }
            
            if (options?.labels) {
                options.labels.forEach(label => {
                    cmd += ` -l ${label}`;
                });
            }

            cmd += ` ${image}`;
            
            if (options?.command) {
                cmd += ` ${options.command}`;
            }

            const terminal = vscode.window.createTerminal('Container Run');
            terminal.sendText(cmd);
            terminal.show();
            
            // Show access instructions if ports were specified
            if (options?.referencePorts && options.referencePorts.length > 0) {
                const containerName = options.name || 'your container';
                const portsList = options.referencePorts.join(', ');
                
                setTimeout(() => {
                    vscode.window.showInformationMessage(
                        `Container started! Use 'container ls' to get the IP address, then access ports ${portsList} directly on that IP.`,
                        'Show Container List'
                    ).then(selection => {
                        if (selection === 'Show Container List') {
                            const listTerminal = vscode.window.createTerminal('Container List');
                            listTerminal.sendText('container ls');
                            listTerminal.show();
                        }
                    });
                }, 2000);
            }
            
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to run container: ${error}`);
            return false;
        }
    }

    static async runContainer(image: string, options?: {
        name?: string;
        ports?: string[];
        referencePorts?: string[];
        volumes?: string[];
        env?: string[];
        detach?: boolean;
        interactive?: boolean;
        tty?: boolean;
        command?: string;
    }): Promise<boolean> {
        // Backward compatibility - use the advanced method
        return this.runContainerAdvanced(image, options);
    }

    static async pullImage(image: string): Promise<boolean> {
        try {
            const terminal = vscode.window.createTerminal('Image Pull');
            terminal.sendText(`container image pull ${image}`);
            terminal.show();
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to pull image: ${error}`);
            return false;
        }
    }

    static async execInContainer(containerId: string, command: string): Promise<void> {
        try {
            const terminal = vscode.window.createTerminal(`Container Exec - ${containerId}`);
            terminal.sendText(`container exec --interactive --tty ${containerId} ${command}`);
            terminal.show();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to exec in container: ${error}`);
        }
    }

    static async pruneImages(): Promise<boolean> {
        try {
            const confirm = await vscode.window.showWarningMessage(
                'Are you sure you want to prune unused images? This will remove all dangling images.',
                'Yes', 'No'
            );
            
            if (confirm === 'Yes') {
                await execAsync('container image prune --force');
                vscode.window.showInformationMessage('Images pruned successfully');
                return true;
            }
            return false;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to prune images: ${error}`);
            return false;
        }
    }
}