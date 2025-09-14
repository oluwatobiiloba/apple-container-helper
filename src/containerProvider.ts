import * as vscode from 'vscode';
import { ContainerManager, Container, Image } from './containerUtils';

export class ContainerProvider implements vscode.TreeDataProvider<ContainerItem | ImageItem | SectionItem | ContainerDetailItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ContainerItem | ImageItem | SectionItem | ContainerDetailItem | undefined | null | void> = new vscode.EventEmitter<ContainerItem | ImageItem | SectionItem | ContainerDetailItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ContainerItem | ImageItem | SectionItem | ContainerDetailItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private showAllContainers = false;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    toggleShowAll(): void {
        this.showAllContainers = !this.showAllContainers;
        this.refresh();
    }

    getTreeItem(element: ContainerItem | ImageItem | SectionItem | ContainerDetailItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ContainerItem | ImageItem | SectionItem | ContainerDetailItem): Promise<(ContainerItem | ImageItem | SectionItem | ContainerDetailItem)[]> {
        if (!element) {
            // Root level - return containers and images sections
            return [
                new SectionItem('Containers', 'containers'),
                new SectionItem('Images', 'images')
            ];
        }

        if (element instanceof SectionItem) {
            if (element.type === 'containers') {
                return this.getContainerItems();
            } else if (element.type === 'images') {
                return this.getImageItems();
            }
        }

        if (element instanceof ContainerItem) {
            return this.getContainerDetails(element.container);
        }

        return [];
    }

    private async getContainerItems(): Promise<ContainerItem[]> {
        try {
            const containers = await ContainerManager.listContainers(this.showAllContainers);
            return containers.map(container => new ContainerItem(container));
        } catch {
            return [];
        }
    }

    private async getImageItems(): Promise<ImageItem[]> {
        try {
            const images = await ContainerManager.listImages();
            return images.map(image => new ImageItem(image));
        } catch {
            return [];
        }
    }

    private getContainerDetails(container: Container): ContainerDetailItem[] {
        const details: ContainerDetailItem[] = [];
        const isRunning = container.status.toLowerCase().includes('running');
        
        // Container ID (copyable)
        details.push(new ContainerDetailItem('📋 Container ID', container.id, 'copy-id', container.id));
        
        // IP Address (copyable if available)
        if (container.ipAddress) {
            details.push(new ContainerDetailItem('🌐 IP Address', container.ipAddress, 'copy-ip', container.ipAddress));
        }
        
        // Image (copyable)
        details.push(new ContainerDetailItem('📦 Image', container.image, 'copy-image', container.image));
        
        // Status (informational)
        const statusIcon = isRunning ? '▶️' : '⏹️';
        details.push(new ContainerDetailItem('📊 Status', `${statusIcon} ${container.status}`, 'status'));
        
        // Dynamic connection examples based on container image (copyable for running containers)
        if (container.ipAddress && isRunning) {
            const connectionExamples = this.getConnectionExamples(container);
            connectionExamples.forEach(example => {
                details.push(new ContainerDetailItem(example.label, example.value, 'copy-command', example.copyValue));
            });
            
            // Always include generic connection options
            details.push(new ContainerDetailItem('🌍 Base URL', `http://${container.ipAddress}`, 'copy-url', `http://${container.ipAddress}`));
            details.push(new ContainerDetailItem('🖥️ SSH Access', `ssh user@${container.ipAddress}`, 'copy-command', `ssh user@${container.ipAddress}`));
        }
        
        // Platform info
        if (container.os && container.arch) {
            details.push(new ContainerDetailItem('💻 Platform', `${container.os}/${container.arch}`, 'platform'));
        }
        
        // Created timestamp
        if (container.created && container.created !== 'Unknown') {
            details.push(new ContainerDetailItem('🕒 Created', container.created, 'created'));
        }
        
        return details;
    }

    private getConnectionExamples(container: Container): Array<{label: string, value: string, copyValue: string}> {
        const examples: Array<{label: string, value: string, copyValue: string}> = [];
        const ip = container.ipAddress!;
        const imageLower = container.image.toLowerCase();
        
        // Database connections
        if (imageLower.includes('redis')) {
            examples.push({
                label: '🔗 Redis CLI',
                value: `redis-cli -h ${ip} -p 6379`,
                copyValue: `redis-cli -h ${ip} -p 6379`
            });
        } else if (imageLower.includes('postgres') || imageLower.includes('postgresql')) {
            examples.push({
                label: '🐘 PostgreSQL',
                value: `psql -h ${ip} -p 5432 -U postgres`,
                copyValue: `psql -h ${ip} -p 5432 -U postgres`
            });
        } else if (imageLower.includes('mysql') || imageLower.includes('mariadb')) {
            const tool = imageLower.includes('mariadb') ? 'mariadb' : 'mysql';
            examples.push({
                label: '🐬 MySQL/MariaDB',
                value: `${tool} -h ${ip} -P 3306 -u root -p`,
                copyValue: `${tool} -h ${ip} -P 3306 -u root -p`
            });
        } else if (imageLower.includes('mongo')) {
            examples.push({
                label: '🍃 MongoDB',
                value: `mongosh mongodb://${ip}:27017`,
                copyValue: `mongosh mongodb://${ip}:27017`
            });
        } else if (imageLower.includes('cassandra')) {
            examples.push({
                label: '🔸 Cassandra',
                value: `cqlsh ${ip} 9042`,
                copyValue: `cqlsh ${ip} 9042`
            });
        }
        
        // Web servers and frameworks
        else if (imageLower.includes('nginx') || imageLower.includes('apache') || imageLower.includes('httpd')) {
            examples.push({
                label: '🌐 Web Server',
                value: `curl http://${ip}:80`,
                copyValue: `curl http://${ip}:80`
            });
        } else if (imageLower.includes('node') || imageLower.includes('express')) {
            examples.push({
                label: '📗 Node.js App',
                value: `curl http://${ip}:3000`,
                copyValue: `curl http://${ip}:3000`
            });
        } else if (imageLower.includes('python') || imageLower.includes('flask') || imageLower.includes('django')) {
            examples.push({
                label: '🐍 Python App',
                value: `curl http://${ip}:8000`,
                copyValue: `curl http://${ip}:8000`
            });
        } else if (imageLower.includes('java') || imageLower.includes('spring') || imageLower.includes('tomcat')) {
            examples.push({
                label: '☕ Java App',
                value: `curl http://${ip}:8080`,
                copyValue: `curl http://${ip}:8080`
            });
        }
        
        // Message brokers and caches
        else if (imageLower.includes('rabbitmq')) {
            examples.push({
                label: '🐰 RabbitMQ Management',
                value: `http://${ip}:15672`,
                copyValue: `http://${ip}:15672`
            });
        } else if (imageLower.includes('kafka')) {
            examples.push({
                label: '📨 Kafka Bootstrap',
                value: `${ip}:9092`,
                copyValue: `${ip}:9092`
            });
        } else if (imageLower.includes('elasticsearch')) {
            examples.push({
                label: '🔍 Elasticsearch',
                value: `curl http://${ip}:9200`,
                copyValue: `curl http://${ip}:9200`
            });
        }
        
        // Development tools
        else if (imageLower.includes('jenkins')) {
            examples.push({
                label: '🔧 Jenkins',
                value: `http://${ip}:8080`,
                copyValue: `http://${ip}:8080`
            });
        } else if (imageLower.includes('gitlab')) {
            examples.push({
                label: '🦊 GitLab',
                value: `http://${ip}:80`,
                copyValue: `http://${ip}:80`
            });
        }
        
        // Generic fallbacks for common web ports
        else {
            // Check if it's likely a web service
            if (imageLower.includes('web') || imageLower.includes('server') || imageLower.includes('api')) {
                examples.push({
                    label: '🌐 Default Web Port',
                    value: `http://${ip}:8080`,
                    copyValue: `http://${ip}:8080`
                });
            }
            
            // Always suggest common ports
            examples.push({
                label: '🔗 Common Ports',
                value: `${ip}:PORT (80, 8080, 3000, 5000)`,
                copyValue: `${ip}:`
            });
        }
        
        return examples;
    }
}

export class SectionItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly type: 'containers' | 'images'
    ) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = `section-${type}`;
        this.iconPath = new vscode.ThemeIcon(type === 'containers' ? 'server-environment' : 'package');
    }
}

export class ContainerItem extends vscode.TreeItem {
    constructor(public readonly container: Container) {
        // Display container name or short ID as the main label
        const displayName = container.name || container.id.substring(0, 12);
        super(displayName, vscode.TreeItemCollapsibleState.Collapsed);
        
        // Enhanced description showing key info
        const imageShort = container.image.includes('/') 
            ? container.image.split('/').pop() || container.image 
            : container.image;
        
        let description = `${imageShort} • ${container.status}`;
        if (container.ipAddress) {
            description += ` • ${container.ipAddress}`;
        }
        
        this.description = description;
        
        // Enhanced tooltip with all details
        this.tooltip = this.buildTooltip(container);
        this.contextValue = `container-${container.status.toLowerCase()}`;
        
        // Set icon based on status
        if (container.status.toLowerCase().includes('running')) {
            this.iconPath = new vscode.ThemeIcon('play', new vscode.ThemeColor('charts.green'));
        } else if (container.status.toLowerCase().includes('stopped') || container.status.toLowerCase().includes('exited')) {
            this.iconPath = new vscode.ThemeIcon('debug-stop', new vscode.ThemeColor('charts.red'));
        } else {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
        }

        this.command = {
            command: 'apple-container-helper.showContainerDetails',
            title: 'Show Container Details',
            arguments: [this.container]
        };
    }

    private buildTooltip(container: Container): string {
        const lines = [
            `Container: ${container.name || 'N/A'}`,
            `ID: ${container.id}`,
            `Image: ${container.image}`,
            `Status: ${container.status}`,
            `Created: ${container.created}`,
            container.ports ? `Ports: ${container.ports}` : 'Ports: N/A'
        ];
        return lines.join('\n');
    }
}

export class ImageItem extends vscode.TreeItem {
    constructor(public readonly image: Image) {
        super(`${image.repository}:${image.tag}`, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = `ID: ${image.id}\nSize: ${image.size}\nCreated: ${image.created}`;
        this.description = image.size;
        this.contextValue = 'image';
        this.iconPath = new vscode.ThemeIcon('package');

        this.command = {
            command: 'apple-container-helper.inspectImage',
            title: 'Inspect Image',
            arguments: [this.image]
        };
    }
}

export class ContainerDetailItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly value: string,
        public readonly type: string,
        public readonly copyValue?: string
    ) {
        super(`${label}: ${value}`, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = this.copyValue ? `${label}: ${value}\nClick to copy: ${this.copyValue}` : `${label}: ${value}`;
        this.contextValue = `container-detail-${type}`;
        
        // Set appropriate icons for different detail types
        switch (type) {
            case 'copy-id':
                this.iconPath = new vscode.ThemeIcon('clippy');
                break;
            case 'copy-ip':
                this.iconPath = new vscode.ThemeIcon('globe');
                break;
            case 'copy-image':
                this.iconPath = new vscode.ThemeIcon('package');
                break;
            case 'copy-command':
                this.iconPath = new vscode.ThemeIcon('terminal');
                break;
            case 'copy-url':
                this.iconPath = new vscode.ThemeIcon('link-external');
                break;
            case 'status':
                this.iconPath = new vscode.ThemeIcon(value.includes('running') ? 'play' : 'debug-stop');
                break;
            case 'platform':
                this.iconPath = new vscode.ThemeIcon('device-desktop');
                break;
            case 'created':
                this.iconPath = new vscode.ThemeIcon('clock');
                break;
            case 'id':
                this.iconPath = new vscode.ThemeIcon('symbol-string');
                break;
            case 'image':
                this.iconPath = new vscode.ThemeIcon('package');
                break;
            case 'ip':
                this.iconPath = new vscode.ThemeIcon('globe');
                break;
            case 'ports':
                this.iconPath = new vscode.ThemeIcon('plug');
                break;
            case 'access':
                this.iconPath = new vscode.ThemeIcon('link-external');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('circle-outline');
        }

        // Make copyable items clickable
        if (this.copyValue && type.startsWith('copy-')) {
            this.command = {
                command: 'apple-container-helper.copyToClipboard',
                title: 'Copy to Clipboard',
                arguments: [this.copyValue, this.label]
            };
        }
    }
}