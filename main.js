const { app, BrowserWindow, ipcMain, Menu, Tray, dialog } = require('electron');
const path = require('path');
const express = require('./server');
const net = require('net');
const { autoUpdater } = require('electron-updater');

// Set NODE_ENV
process.env.NODE_ENV = app.isPackaged ? 'production' : 'development';

let mainWindow;
let server;
let tray = null;
let forceClose = false;
let appPort = 3000; // Default port

// Configure auto updater
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = false;

// Set the GitHub repository for auto-updates
autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'prayagjasani',
    repo: 'patient-management-system',
    releaseType: 'release'
});

// Find an available port
function findAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const testServer = net.createServer();
        testServer.once('error', err => {
            if (err.code === 'EADDRINUSE') {
                // Port is in use, try the next one
                resolve(findAvailablePort(startPort + 1));
            } else {
                reject(err);
            }
        });
        testServer.once('listening', () => {
            // Found an available port
            const port = testServer.address().port;
            testServer.close(() => {
                resolve(port);
            });
        });
        testServer.listen(startPort);
    });
}

// Handle command line arguments for installer/uninstaller
const gotTheLock = app.requestSingleInstanceLock({
    userId: 'patient-management-system-instance'
});

if (!gotTheLock) {
    // Another instance is running - allow this second instance to force close the first
    console.log('Application already running. Exiting...');
    forceClose = true;
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

async function createWindow() {
    try {
        // Find an available port before starting the server
        appPort = await findAvailablePort(3000);
        console.log(`Using port: ${appPort}`);

        // Create the browser window
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
            icon: path.join(__dirname, 'assets/icon.ico'),
            show: false // Don't show until ready
        });

        // Create application menu
        const template = [{
                label: 'File',
                submenu: [{
                        label: 'New Patient',
                        accelerator: 'CmdOrCtrl+N',
                        click: () => {
                            mainWindow.loadURL(`http://localhost:${appPort}/add`);
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Exit',
                        accelerator: 'CmdOrCtrl+Q',
                        click: () => {
                            app.quit();
                        }
                    }
                ]
            },
            {
                label: 'View',
                submenu: [{
                    label: 'Toggle DevTools',
                    accelerator: 'CmdOrCtrl+Shift+I',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                }]
            },
            {
                label: 'Help',
                submenu: [{
                        label: 'Check for Updates',
                        click: () => {
                            checkForUpdates();
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'About',
                        click: () => {
                            // Show about dialog
                            dialog.showMessageBox({
                                title: 'About Patient Management System',
                                message: `Patient Management System v${app.getVersion()}\n\nA desktop application for managing patient records.`,
                                buttons: ['OK']
                            });
                        }
                    }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);

        // Create system tray
        try {
            tray = new Tray(path.join(__dirname, 'assets/icon.ico'));
            const contextMenu = Menu.buildFromTemplate([{
                    label: 'Show App',
                    click: () => mainWindow.show()
                },
                {
                    label: 'Hide App',
                    click: () => mainWindow.hide()
                },
                { type: 'separator' },
                {
                    label: 'Check for Updates',
                    click: () => checkForUpdates()
                },
                { type: 'separator' },
                {
                    label: 'Exit Application',
                    click: () => {
                        app.isQuiting = true;
                        app.quit();
                    }
                }
            ]);
            tray.setToolTip('Patient Management System');
            tray.setContextMenu(contextMenu);
        } catch (err) {
            console.warn('Failed to create system tray:', err);
        }

        // Set the port for Express
        process.env.PORT = appPort;

        // Start the server
        server = express.listen(appPort, () => {
            console.log(`Server running on port ${appPort}`);
            // Load the app after server is ready
            mainWindow.loadURL(`http://localhost:${appPort}`);
            // Show window when ready
            mainWindow.show();
        });

        // Handle server errors
        server.on('error', (error) => {
            console.error('Server error:', error);
            if (error.code === 'EADDRINUSE') {
                dialog.showErrorBox(
                    'Port in use',
                    `Port ${appPort} is already in use. Please close other instances of this application or services using this port.`
                );
                app.quit();
            }
        });

        // Open DevTools in development
        if (process.env.NODE_ENV === 'development') {
            mainWindow.webContents.openDevTools();
        }

        // Handle window state
        mainWindow.on('close', (event) => {
            // Check for conditions when we should actually close the app
            if (app.isQuiting || forceClose || process.argv.includes('--force-quit')) {
                // Actually close the window
                closeServer();
                return;
            }

            // If not quitting, just hide to system tray
            event.preventDefault();
            mainWindow.hide();
            return false;
        });

        mainWindow.on('closed', function() {
            mainWindow = null;
        });

        // Handle window minimize to tray
        mainWindow.on('minimize', () => {
            mainWindow.hide();
        });

        // Handle tray icon double click
        if (tray) {
            tray.on('double-click', () => {
                mainWindow.show();
            });
        }
    } catch (error) {
        console.error('Error during startup:', error);
        dialog.showErrorBox(
            'Startup Error',
            `An error occurred during application startup: ${error.message}`
        );
        app.quit();
    }
}

function closeServer() {
    if (server) {
        try {
            server.close();
            server = null;
        } catch (err) {
            console.error('Error closing server:', err);
        }
    }
}

// Check for updates
function checkForUpdates() {
    if (process.env.NODE_ENV === 'development') {
        dialog.showMessageBox({
            title: 'Updates',
            message: 'Update checking is disabled in development mode.',
            buttons: ['OK']
        });
        return;
    }

    autoUpdater.checkForUpdates();
}

// Setup auto-updater events
autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. Would you like to download it now?`,
        buttons: ['Yes', 'No'],
        defaultId: 0
    }).then(({ response }) => {
        if (response === 0) {
            autoUpdater.downloadUpdate();
        }
    });
});

autoUpdater.on('update-not-available', () => {
    dialog.showMessageBox({
        title: 'No Updates',
        message: 'You are running the latest version of the application.',
        buttons: ['OK']
    });
});

autoUpdater.on('error', (err) => {
    dialog.showErrorBox(
        'Update Error',
        `An error occurred while checking for updates: ${err.message}`
    );
});

autoUpdater.on('download-progress', (progressObj) => {
    let message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    console.log(message);
    // You could show a progress bar here if desired
});

autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
        title: 'Update Ready',
        message: 'Update downloaded. The application will restart to install the update.',
        buttons: ['Install now', 'Install later'],
        defaultId: 0
    }).then(({ response }) => {
        if (response === 0) {
            autoUpdater.quitAndInstall(false, true);
        }
    });
});

// Create window when app is ready
app.whenReady().then(() => {
    createWindow();

    // Check for updates after startup (only in production)
    if (process.env.NODE_ENV === 'production') {
        setTimeout(() => {
            autoUpdater.checkForUpdates();
        }, 5000); // Check after 5 seconds
    }
}).catch(error => {
    console.error('Failed to create window:', error);
    app.quit();
});

// Handle window-all-closed event
app.on('window-all-closed', function() {
    if (process.platform !== 'darwin') {
        closeServer();
        app.quit();
    }
});

// Handle activate event (macOS)
app.on('activate', function() {
    if (mainWindow === null) {
        createWindow();
    } else {
        mainWindow.show();
    }
});

// Handle app quit
app.on('before-quit', () => {
    app.isQuiting = true;
    closeServer();
});

// Handle IPC messages
ipcMain.on('quit-app', () => {
    app.isQuiting = true;
    app.quit();
});

// Handle manual update check from renderer
ipcMain.on('check-for-updates', () => {
    checkForUpdates();
});