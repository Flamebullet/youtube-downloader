const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const checkInternetConnected = require('check-internet-connected');

if (require('electron-squirrel-startup')) return app.quit();

// Create Application window
const createWindow = () => {
	// Application window settings
	const win = new BrowserWindow({
		width: 900,
		height: 600,
		minWidth: 700,
		minHeight: 400,
		autoHideMenuBar: true,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true,
			devTools: false
		}
	});

	win.setIcon('./content/youtube-icon.ico');
	// win.webContents.openDevTools();

	const config = {
		timeout: 5000, //timeout connecting to each try (default 5000)
		retries: 3, //number of retries to do before failing (default 5)
		domain: 'apple.com' //the domain to check DNS record of
	};

	checkInternetConnected(config)
		.then(() => {
			win.loadFile('index.html');
		})
		.catch(() => {
			win.loadFile('./content/404.html');
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
