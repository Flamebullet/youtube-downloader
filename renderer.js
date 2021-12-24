const { ipcRenderer } = require('electron');
const remote = require('@electron/remote');
const updater = remote.require('electron-simple-updater');

const fs = require('fs');
const cp = require('child_process');

const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
const spotifyyt = require('spotify-to-yt');
const swal = require('sweetalert');

const videoRegex = /^\s*\<?(https?:\/\/)?((w{3}\.)|(m\.)|(music\.))?(youtube\.com\/(watch\?(\S+)?v\=)|youtu\.be\/)(?<urlkey>[\S]{11})\>?\s*/gim;
const spotifyMusicRegex = /^\s*\<?(https?:\/\/)?(open\.spotify\.com\/track\/)(?<urlkey>[\S]{22})(\?si\=\S{0,22})?\>?\s*/gim;

// Set text for version
updater.init('https://raw.githubusercontent.com/Flamebullet/youtube-downloader/main/updates.json');
document.getElementById('version').innerText = updater.version;
attachUpdaterHandlers();
let downloadingUpdates = false;

// Handling updates
function attachUpdaterHandlers() {
	updater.on('update-downloading', onUpdateDownloading);
	updater.on('update-downloaded', onUpdateDownloaded);

	function onUpdateDownloading() {
		downloadingUpdates = true;
		document.getElementById('version').innerText = 'Downloading new update...';
	}

	function onUpdateDownloaded() {
		downloadingUpdates = false;
		updater.quitAndInstall();
	}
}

// Get download url when download button clicked
document.getElementById('download').addEventListener('click', async (event) => {
	event.preventDefault();
	const url = document.getElementById('url').value;
	const audio = document.getElementById('audio').checked;
	const video = document.getElementById('video').checked;

	if (!audio && !video) {
		return swal('Error!', 'Either audio or video or both must be selected to download video!', 'error');
	}

	if (url.match(videoRegex) || url.match(spotifyMusicRegex)) {
		document.getElementById('directory').click();
	} else {
		swal('Error!', 'Invalid url entered!', 'error');
		document.getElementById('url').value = '';
	}
});

document.getElementById('directory').addEventListener(
	'change',
	async (event) => {
		if (document.getElementById('directory').files.length == 0) {
			return swal('Error!', 'Download path must be selected!', 'error');
		}

		let files = event.target.files;

		let filePathArray = files[0].path.split('\\');
		filePathArray.pop();
		let filePath = filePathArray.join('\\');
		const url = document.getElementById('url').value;
		const audioElement = document.getElementById('audio').checked;
		const videoElement = document.getElementById('video').checked;

		var fullYoutubeURL = '';

		if (url.match(videoRegex)) {
			var urlkey = videoRegex.exec(url);
			var youtubeBase = 'https://www.youtube.com/watch?v=';
			fullYoutubeURL = youtubeBase.concat(urlkey.groups.urlkey);
		}

		if (url.match(spotifyMusicRegex)) {
			var urlkey = spotifyMusicRegex.exec(url);
			var music = [urlkey.groups.urlkey];

			await spotifyyt
				.trackGet(`https://open.spotify.com/track/${music}`)
				.then(async (result) => {
					fullYoutubeURL = result.url;
				})
				.catch(() => {
					return swal('Error!', 'Invalid Spotify URL entered!', 'error');
				});
		}

		document.getElementById('url').disabled = true;
		document.getElementById('download').disabled = true;
		document.getElementById('url').style.cursor = 'not-allowed';
		document.getElementById('download').style.cursor = 'not-allowed';
		swal('Download Started!', 'Do not close window while download is in progress', 'info');
		// TODO Download video to directory
		const tracker = {
			start: Date.now(),
			audio: { downloaded: 0, total: 0 },
			video: { downloaded: 0, total: 0 }
		};
		const videoName = await ytdl.getInfo(fullYoutubeURL);

		let audio, video;
		if (audioElement) {
			audio = ytdl(fullYoutubeURL, { filter: 'audioonly', quality: 'highestaudio' }).on('progress', (_, downloaded, total) => {
				tracker.audio = { downloaded, total };
			});
		}

		if (videoElement) {
			video = ytdl(fullYoutubeURL, { filter: 'videoonly', quality: 'highestvideo' }).on('progress', (_, downloaded, total) => {
				tracker.video = { downloaded, total };
			});
		}

		let progressbarHandle = null;
		const progressbarInterval = 1000;
		const showProgress = () => {
			let output = 'Download Progress:\n';
			const toMB = (i) => (i / 1024 / 1024).toFixed(2);

			var percentage = ((tracker.audio.downloaded / tracker.audio.total) * 100).toFixed(2);
			if (isNaN(percentage)) percentage = 0;
			output += `Audio | ${percentage}% processed `;
			output += `(${toMB(tracker.audio.downloaded)}MB of ${toMB(tracker.audio.total)}MB).${' '.repeat(10)}\n`;

			var percentage = ((tracker.video.downloaded / tracker.video.total) * 100).toFixed(2);
			if (isNaN(percentage)) percentage = 0;
			output += `Video | ${percentage}% processed `;
			output += `(${toMB(tracker.video.downloaded)}MB of ${toMB(tracker.video.total)}MB).${' '.repeat(10)}\n`;

			if (tracker.merged) {
				output += `Merged | processing frame ${tracker.merged.frame} `;
				output += `(at ${tracker.merged.fps} fps => ${tracker.merged.speed}).${' '.repeat(10)}\n`;
			}

			output += `Uptime: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(2)} Minutes.`;

			document.getElementById('download-progress').innerText = output;
		};

		if (audioElement && videoElement) {
			// Start the ffmpeg child process
			const ffmpegProcess = cp.spawn(
				ffmpeg,
				[
					// Remove ffmpeg's console spamming
					'-loglevel',
					'8',
					'-hide_banner',
					// Redirect/Enable progress messages
					'-progress',
					'pipe:3',
					// Set inputs
					'-i',
					'pipe:4',
					'-i',
					'pipe:5',
					// Map audio & video from streams
					'-map',
					'0:a',
					'-map',
					'1:v',
					// Keep encoding
					'-c:v',
					'copy',
					// Define output file
					'-y',
					`${filePath}\\${videoName.videoDetails.title.replaceAll(/\*|\.|\"|\/|\\|\[|\]|\:|\;|\||\,/gi, '')}.mp4`
				],
				{
					windowsHide: true,
					stdio: [
						/* Standard: stdin, stdout, stderr */
						'inherit',
						'inherit',
						'inherit',
						/* Custom: pipe:3, pipe:4, pipe:5 */
						'pipe',
						'pipe',
						'pipe'
					]
				}
			);
			ffmpegProcess.on('close', () => {
				clearInterval(progressbarHandle);
				document.getElementById('download-progress').innerText = '';
				document.getElementById('url').value = '';
				document.getElementById('url').disabled = false;
				document.getElementById('download').disabled = false;
				document.getElementById('url').style.cursor = 'text';
				document.getElementById('download').style.cursor = 'pointer';
				document.getElementById('directory').value = '';

				swal('Video Downloaded!', 'Video has successfully been downloaded and saved to selected folder', 'success');
				return;
			});

			ffmpegProcess.stdio[3].on('data', (chunk) => {
				// Start the progress bar
				if (!progressbarHandle) progressbarHandle = setInterval(showProgress, progressbarInterval);
				// Parse the param=value list returned by ffmpeg
				const lines = chunk.toString().trim().split('\n');
				const args = {};
				for (const l of lines) {
					const [key, value] = l.split('=');
					args[key.trim()] = value.trim();
				}
				tracker.merged = args;
			});
			audio.pipe(ffmpegProcess.stdio[4]);
			video.pipe(ffmpegProcess.stdio[5]);
		} else if (audioElement) {
			if (!progressbarHandle) progressbarHandle = setInterval(showProgress, progressbarInterval);
			audio.pipe(fs.createWriteStream(`${filePath}\\${videoName.videoDetails.title.replaceAll(/\*|\.|\"|\/|\\|\[|\]|\:|\;|\||\,/gi, '')}.mp4`));
			audio.on('end', () => {
				clearInterval(progressbarHandle);
				document.getElementById('download-progress').innerText = '';
				document.getElementById('url').value = '';
				document.getElementById('url').disabled = false;
				document.getElementById('download').disabled = false;
				document.getElementById('url').style.cursor = 'text';
				document.getElementById('download').style.cursor = 'pointer';
				document.getElementById('directory').value = '';

				swal('Video Downloaded!', 'Video has successfully been downloaded and saved to selected folder', 'success');
				return;
			});
		} else if (videoElement) {
			if (!progressbarHandle) progressbarHandle = setInterval(showProgress, progressbarInterval);
			video.pipe(fs.createWriteStream(`${filePath}\\${videoName.videoDetails.title.replaceAll(/\*|\.|\"|\/|\\|\[|\]|\:|\;|\||\,/gi, '')}.mp4`));
			video.on('end', () => {
				clearInterval(progressbarHandle);
				document.getElementById('download-progress').innerText = '';
				document.getElementById('url').value = '';
				document.getElementById('url').disabled = false;
				document.getElementById('download').disabled = false;
				document.getElementById('url').style.cursor = 'text';
				document.getElementById('download').style.cursor = 'pointer';
				document.getElementById('directory').value = '';

				swal('Video Downloaded!', 'Video has successfully been downloaded and saved to selected folder', 'success');
				return;
			});
		}
	},
	false
);

document.getElementById('toggle-dark-mode').addEventListener('click', async () => {
	// const isDarkMode = await window.darkMode.toggle();
	ipcRenderer.invoke('dark-mode:toggle');
});

document.getElementById('reset-to-system').addEventListener('click', async () => {
	// await window.darkMode.system();
	ipcRenderer.invoke('dark-mode:system');
});

window.addEventListener('beforeunload', function (e) {
	if (downloadingUpdates) {
		e.returnValue = '';
		swal('Update downloading', 'Closing of application will only be available after application is updated', 'info');
	}
});
