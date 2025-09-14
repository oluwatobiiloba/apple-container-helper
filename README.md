# Apple Container Helper

A VS Code extension designed specifically for Apple's Container CLI, providing a comprehensive graphical interface for managing containers and images on macOS systems.

![Apple Container Helper](https://img.shields.io/badge/platform-macOS-blue)
![VS Code Extension](https://img.shields.io/badge/VSCode-Extension-purple)

## Features

### **Container & Image Management**
- **Tree View Interface**: Browse containers and images in an organized, expandable tree structure
- **Real-time Status**: Live status indicators with color-coded icons (🟢 running, 🔴 stopped)
- **Smart Container Details**: Click any container to see detailed information including IP addresses, platform info, and connection examples
- **Bulk Operations**: Start, stop, remove containers with single clicks

### **Apple Container CLI Integration**
- **Native IP Networking**: Automatically detects and displays container IP addresses from `container ls`
- **Direct Access**: No port mapping needed - containers get their own IP addresses
- **Platform Information**: Shows OS/architecture details (e.g., `linux/arm64`)

### **Copyable Connection Information**
When you expand a running container, get instant access to copyable connection commands:

**And many more!** The extension intelligently detects the container type and provides relevant connection examples.

### **Real-time Log Streaming**
- **Live Logs**: Stream container logs in real-time using dedicated VS Code terminals
- **Multiple Containers**: Each container gets its own streaming terminal
- **Full Terminal Features**: Scroll, search, copy text from log output


## **Installation & Setup**

### Prerequisites
- **macOS**: This extension only works on macOS systems
- **Apple Container CLI**: Must be installed and available in your system PATH
- **VS Code**: Version 1.104.0 or higher

### Quick Start
1. **Install the extension** from the VS Code marketplace
2. **Start container system**: The extension automatically runs `container system start` on activation
3. **Access the interface**: Look for the "Apple Containers" view in your VS Code sidebar

## **Usage Guide**

### Basic Container Management
1. **View Containers**: Expand the "Containers" section to see all your containers
2. **Container Actions**: Right-click any container for options:
   - Start/Stop container
   - View streaming logs
   - Remove container
   - Show detailed information
3. **Quick Details**: Click a container name to open the detailed webview

### Creating New Containers
1. **Simple Creation**: Right-click an image → "Run Container"
2. **Advanced Creation**: Use the "Advanced Run" button for full configuration options
3. **Form Interface**: Fill out the comprehensive form with all container options

### Managing Images
1. **View Images**: Browse all available images in the "Images" section
2. **Image Actions**: Right-click images to:
   - Run containers from image
   - Advanced run with full configuration
   - Inspect image details
   - Remove unused images
3. **Prune Images**: Use the "Prune Images" button to clean up unused images

## **Extension Settings**

This extension contributes the following settings:

* `apple-container-helper.showInExplorer`: Show the container view in the Explorer sidebar (default: true)
* `apple-container-helper.autoRefresh`: Auto-refresh interval in seconds, 0 to disable (default: 30)

## **Apple Container CLI Compatibility**

This extension is specifically designed for Apple's Container CLI and handles its unique characteristics:

- **No Port Publishing**: Apple Container CLI doesn't support `--publish` flags - containers get direct IP access
- **Automatic IP Assignment**: Containers receive their own IP addresses accessible from the host
- **JSON + Table Parsing**: Combines JSON output for details with table output for IP addresses
- **Native Commands**: All operations use authentic Apple Container CLI commands

##  **Available Commands**

Access these commands through the Command Palette (`Cmd+Shift+P`):

- `Apple Container Helper: Refresh Containers`
- `Apple Container Helper: Refresh Images`
- `Apple Container Helper: Advanced Run`
- `Apple Container Helper: Prune Images`
- `Apple Container Helper: Stream Logs`
- `Apple Container Helper: Show Container Details`

## Requirements

- **macOS** (this extension only works on Apple systems)
- **Apple Container CLI** installed and available in PATH
- **VS Code** version 1.104.0 or higher

## Known Issues

- Extension only supports macOS systems with Apple Container CLI
- IP address detection depends on `container ls` output format
- Some container types may not have specialized connection examples

## Release Notes

### 0.0.1

Initial release of Apple Container Helper with comprehensive container and image management features.

---

