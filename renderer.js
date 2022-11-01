const { ipcRenderer } = require('electron');
const remote = require('@electron/remote');
const updater = remote.require('electron-simple-updater');

const swal = require('sweetalert');

// Downloading/file management modules
const fs = require('fs');
const cp = require('child_process');

// Youtube modules
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
const spotifyyt = require('spotify-to-yt');
const search = require('yt-search');

const videoRegex = /^\s*\<?(https?:\/\/)?((w{3}\.)|(m\.)|(music\.))?(youtube\.com\/(watch\?(\S+)?v\=)|youtu\.be\/)(?<urlkey>[\S]{11})\>?\s*/gim;
const spotifyMusicRegex = /^\s*\<?(https?:\/\/)?(open\.spotify\.com\/track\/)(?<urlkey>[\S]{22})(\?si\=\S{0,22})?\>?\s*/gim;

let videoName, videoItag;

// Set text for version
document.getElementById('version').innerText = updater.version;
attachUpdaterHandlers();
updater.checkForUpdates();
let downloadingUpdates = false;
var modal = document.getElementById('myModal');
var modalCloseButton = document.getElementById('close');
var previewModal = document.getElementById('videoModal');
var previewModalCloseButton = document.getElementById('video-close');
var qualityModal = document.getElementById('qualityModal');
var qualityModalCloseButton = document.getElementById('quality-close');

// When the user clicks on <span> (x), close the search modal
modalCloseButton.onclick = function () {
	modal.style.display = 'none';
};

// When the user clicks on <span> (x), close the preview modal
previewModalCloseButton.onclick = function () {
	document.getElementById('video-modal-body').innerHTML = '<div class="loader"></div>';
	previewModal.style.display = 'none';
};

// When the user clicks on <span> (x), close the quality modal
qualityModalCloseButton.onclick = function () {
	qualityModal.style.display = 'none';
};

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
	if (event.target == modal) {
		modal.style.display = 'none';
	} else if (event.target == previewModal) {
		document.getElementById('video-modal-body').innerHTML = '<div class="loader"></div>';
		previewModal.style.display = 'none';
	} else if (event.target == qualityModal) {
		qualityModal.style.display = 'none';
	}
};

window.addEventListener('resize', () => {
	document
		.getElementById('modal-body')
		.style.setProperty('height', 'calc(100% - ' + document.getElementById('modal-header-block').clientHeight + 'px - 4px)');
	document
		.getElementById('video-modal-body')
		.style.setProperty('height', 'calc(100% - ' + document.getElementById('video-modal-header-block').clientHeight + 'px - 4px)');
	document
		.getElementById('quality-modal-body')
		.style.setProperty('height', 'calc(100% - ' + document.getElementById('quality-modal-header-block').clientHeight + 'px - 4px)');
});

// Handling updates
function attachUpdaterHandlers() {
	updater.on('update-available', onUpdateAvailable);
	updater.on('update-downloading', onUpdateDownloading);
	updater.on('update-downloaded', onUpdateDownloaded);

	function onUpdateAvailable() {
		console.log('update available');
		downloadingUpdates = true;
		document.getElementById('download').disabled = true;
		document.getElementById('download').style.cursor = 'not-allowed';
		document.getElementById('version').innerText = 'Updating...';
		updater.downloadUpdate();
	}

	function onUpdateDownloading() {
		console.log('update downloading');
		downloadingUpdates = true;
		document.getElementById('version').innerText = 'Updating...';
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
		selectVideoQuality(url);
	} else if (url != '') {
		document.getElementById('url').value = '';
		document.getElementById('modal-header-content').innerHTML = `Search Results for: ${url}`;
		document.getElementById('modal-body').style.height = `calc(100% - ${document.getElementById('modal-header-content').style.height}) !important`;
		document.getElementById('modal-body').innerHTML = '<div class="loader"></div>';
		search(url, async (err, res) => {
			if (err) return swal('Error!', 'Encountered error while searching for a song, please try again', 'error');
			if (res.videos.length === 0) return swal('No Results', 'No results found, please try another title', 'error');

			// Create table to show list of available videos
			let videos = res.videos;
			htmlTableOutput = `<table id="result-table">
            <thead>
            <tr>
            <th>ID</th>
            <th>Thumbnail</th>
            <th>Track Title (Timestamp)</th>
            <th>Uploaded</th>
            <th>Channel</th>
            <th>Views</th>
            <th>Download</th>
            </tr>
            </thead>
            <tbody>
            `;

			for (var i in videos) {
				htmlTableOutput += `<tr>
                <td>${parseInt(i) + 1}</td>
                <td><img title="preview video" class="show-preview" id="preview${i}" src="${videos[i].thumbnail}" alt="${
					videos[i].title
				}" width="177" height="100" style="cursor: pointer;"></td>
                <td class="show-preview" id="preview${i}" style="cursor: pointer;" title="preview video">${videos[i].title} (${videos[i].timestamp})</td>
                <td>${videos[i].ago}</td>
                <td>${videos[i].author.name}</td>
                <td>${String(videos[i].views)}</td>
                <td><button class="search-download-button" id="download${i}">Download</button></td>
                </tr>`;
			}

			htmlTableOutput += `</tbody></table>`;

			// Update modal content with list of searched videos
			document.getElementById('modal-body').innerHTML = htmlTableOutput;

			// function to select video associated to download button
			async function searchDownloadButtonFunction() {
				var id = parseInt(this.getAttribute('id').slice(8));
				document.getElementById('url').value = videos[id].url;
				modal.style.display = 'none';
				selectVideoQuality(videos[id].url);
			}

			// function to show another modal with preview of selected video
			async function showVideoPreview() {
				var id = parseInt(this.getAttribute('id').slice(7));
				previewModal.style.display = 'block';

				// Display spinner while loading
				document.getElementById('video-modal-header-content').innerHTML = `Previewing: ${videos[id].title}`;
				document
					.getElementById('video-modal-body')
					.style.setProperty('height', 'calc(100% - ' + document.getElementById('video-modal-header-block').clientHeight + 'px - 4px)');
				document.getElementById('video-modal-body').innerHTML = '<div class="loader"></div>';

				var videourl = '';
				try {
					const video = await ytdl.getInfo(videos[id].url);
					videourl = video.player_response.streamingData.formats[video.player_response.streamingData.formats.length - 1].url;
				} catch (err) {
					console.log(err);
				}
				document.getElementById('video-modal-body').innerHTML = `
                    <video controls="true" class="embed-responsive-item" height="98%" width="100%" aspect-ratio="16/9" poster="${videos[id].thumbnail}">
                        <source
                            src="${videourl}"
                            type="video/mp4"
                        />
                    </video>
                `;
			}

			// Add listeners to listen for clicks on title or thumbnail
			let resultElements = document.getElementsByClassName('show-preview');
			for (var i = 0; i < resultElements.length; i++) {
				resultElements[i].addEventListener('click', showVideoPreview, false);
			}

			// Add listeners to listen for clicks on download buttons
			resultElements = document.getElementsByClassName('search-download-button');
			for (var i = 0; i < resultElements.length; i++) {
				resultElements[i].addEventListener('click', searchDownloadButtonFunction, false);
			}
		});
		modal.style.display = 'block';
		document
			.getElementById('modal-body')
			.style.setProperty('height', 'calc(100% - ' + document.getElementById('modal-header-block').clientHeight + 'px - 4px)');
	} else {
		swal('Error!', 'Search cannot be empty, enter a url or title to search', 'error');
	}
});

async function selectVideoQuality(url) {
	if (document.getElementById('video').checked) {
		videoName = await ytdl.getInfo(url).catch((err) => {
			swal(`${err}`, 'Unable to get information for this video, try again or try another video', 'error');
		});
		// create a html dropdown menu to select video quality
		let videoQualityHTML = `<div class="selectdiv"><label><select id="video-quality">`;
		let videoFormats = ytdl.filterFormats(videoName.formats, 'videoonly');
		for (i in videoFormats) {
			let video = videoFormats[i];
			videoQualityHTML += `<option value="${video.itag}">bitrate: ${video.bitrate} | ${video.container} | ${video.qualityLabel}</option>`;
		}
		videoQualityHTML += `</select>`;
		videoQualityHTML += `<button class="search-download-button" id="videoqualitydownload" style="float: right !important;">Download</button></label></div>`;
		videoQualityHTML += `<link rel="stylesheet" type="text/css" href=".\\content\\dropdown.css">`;

		document.getElementById('quality-modal-body').innerHTML = videoQualityHTML;

		document.getElementById('videoqualitydownload').addEventListener('click', async (event) => {
			videoItag = document.getElementById('video-quality').value;
			qualityModal.style.display = 'none';
			document.getElementById('directory').click();
		});
		qualityModal.style.display = 'block';
	} else {
		document.getElementById('directory').click();
	}
}

document.getElementById('directory').addEventListener('change', async (event) => {
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

	const tracker = {
		start: Date.now(),
		audio: { downloaded: 0, total: Infinity },
		video: { downloaded: 0, total: Infinity },
		merged: { frame: 0, speed: '0x', fps: 0 }
	};

	if (!videoName) return;
	if (videoName.videoDetails.isLiveContent) {
		proceedLive = await swal({
			title: 'Warning!',
			text: 'This video is live! Proceeding is not recommended, if you wish to proceed, click "Proceed" and leave window open until stream ends',
			icon: 'warning',
			buttons: {
				cancel: true,
				proceed: {
					text: 'Proceed',
					value: 'proceed',
					className: 'swal-button--danger'
				}
			}
		});

		if (proceedLive == null) return (document.getElementById('directory').value = '');
	}

	let audio, video;
	if (audioElement) {
		audio = ytdl(fullYoutubeURL, {
			filter: 'audioonly',
			quality: 'highestaudio',
			encoderArgs: ['-af', "firequalizer=gain_entry='entry(0,20);entry(250,14);entry(1000,7);entry(4000,0);entry(16000,4)'", 'dynaudnorm=f=200']
		}).on('progress', (_, downloaded, total) => {
			tracker.audio = { downloaded, total };
		});
	}

	if (videoElement) {
		video = ytdl(fullYoutubeURL, {
			quality: `${videoItag}`
		}).on('progress', (_, downloaded, total) => {
			tracker.video = { downloaded, total };
		});
	}

	document.getElementById('url').disabled = true;
	document.getElementById('download').disabled = true;
	document.getElementById('url').style.cursor = 'not-allowed';
	document.getElementById('download').style.cursor = 'not-allowed';
	swal('Download Started!', 'Do not close window while download is in progress', 'info');

	// Prepare the progress bar
	let progressbarHandle = null;
	const progressbarInterval = 1000;
	const showProgress = () => {
		let output = 'Download Progress:\n';
		const toMB = (i) => (i / 1024 / 1024).toFixed(2);

		output += `Audio  | ${((tracker.audio.downloaded / tracker.audio.total) * 100).toFixed(2)}% processed `;
		output += `(${toMB(tracker.audio.downloaded)}MB of ${toMB(tracker.audio.total)}MB).${' '.repeat(10)}\n`;

		output += `Video  | ${((tracker.video.downloaded / tracker.video.total) * 100).toFixed(2)}% processed `;
		output += `(${toMB(tracker.video.downloaded)}MB of ${toMB(tracker.video.total)}MB).${' '.repeat(10)}\n`;

		output += `Merged | processing frame ${tracker.merged.frame} `;
		output += `(at ${tracker.merged.fps} fps => ${tracker.merged.speed}).${' '.repeat(10)}\n`;

		output += `Running for: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(2)} Minutes.`;

		document.getElementById('download-progress').innerText = output;
	};

	let filename;
	if (videoElement) {
		filename = `${filePath}\\${videoName.videoDetails.title.replaceAll(/\*|\.|\?|\"|\/|\\|\:|\||\<|\>/gi, '')}.mp4`;
	} else {
		filename = `${filePath}\\${videoName.videoDetails.title.replaceAll(/\*|\.|\?|\"|\/|\\|\:|\||\<|\>/gi, '')}.mp3`;
	}

	if (fs.existsSync(filename)) {
		let i = 1;
		while (fs.existsSync(filename)) {
			videoElement
				? (filename = `${filePath}\\${videoName.videoDetails.title.replaceAll(/\*|\.|\?|\"|\/|\\|\:|\||\<|\>/gi, '')} (${i}).mp4`)
				: (filename = `${filePath}\\${videoName.videoDetails.title.replaceAll(/\*|\.|\?|\"|\/|\\|\:|\||\<|\>/gi, '')} (${i}).mp3`);
			i++;
		}
	}

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
				filename
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

		// Link streams
		// FFmpeg creates the transformer streams and we just have to insert / read data
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
		// output audio as mp3 file
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
				// Map audio & video from streams
				'-map',
				'0:a',
				'-codec:a',
				'libmp3lame',
				'-qscale:a',
				'0',
				'-y',
				filename
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

		audio.pipe(ffmpegProcess.stdio[4]);
	} else if (videoElement) {
		if (!progressbarHandle) progressbarHandle = setInterval(showProgress, progressbarInterval);
		video.pipe(fs.createWriteStream(filename));
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
});

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
