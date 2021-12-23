const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');

if (require('electron-squirrel-startup')) return app.quit();

const createWindow = () => {
	const win = new BrowserWindow({
		width: 900,
		height: 600,
		minWidth: 700,
		minHeight: 400,
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js')
		}
	});

	// win.setMenuBarVisibility(false);
	win.loadFile('index.html');

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

app.whenReady().then(() => {
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
