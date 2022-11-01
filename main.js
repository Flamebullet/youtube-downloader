const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const checkInternetConnected = require('check-internet-connected');
require('@electron/remote/main').initialize();
const updater = require('electron-simple-updater');

if (require('electron-squirrel-startup')) app.quit();

updater.init({
	checkUpdateOnStart: false,
	autoDownload: false,
	url: 'https://raw.githubusercontent.com/Flamebullet/youtube-downloader/main/updates.json'
});

// Create Application window
const createWindow = () => {
	// Application window settings
	const win = new BrowserWindow({
		width: 1100,
		height: 650,
		minWidth: 1100,
		minHeight: 650,
		autoHideMenuBar: true,
		sandbox: true,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true,
			devTools: true
		}
	});

	require('@electron/remote/main').enable(win.webContents);

	win.setIcon(path.join(__dirname, '/content/youtube-icon.ico'));
	// win.webContents.openDevTools();

	const config = {
		timeout: 5000, //timeout connecting to each try (default 5000)
		retries: 3, //number of retries to do before failing (default 5)
		domain: 'youtube.com' //the domain to check DNS record of
	};

	checkInternetConnected(config)
		.then(() => {
			win.loadFile(path.join(__dirname, 'index.html'));
		})
		.catch(() => {
			win.loadFile(path.join(__dirname, '/content/404.html'));
		});

	// Dark mode code
	ipcMain.handle('dark-mode:toggle', () => {
		if (nativeTheme.shouldUseDarkColors) {
			nativeTheme.themeSource = 'light';
		} else {
			nativeTheme.themeSource = 'dark';
		}
		return nativeTheme.shouldUseDarkColors;
	});

	ipcMain.handle('dark-mode:system', () => {
		nativeTheme.themeSource = 'system';
	});
};

// Create window when ready
app.whenReady().then(() => {
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

// Close window when press 'x' button
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
