import "./styles.css";

let tracks = [
  { title: "Blinding Lights", artist: "The Weeknd", art: "../app/src/main/res/drawable/weeknd.webp", tone: "linear-gradient(135deg, #ce291f, #271612)" },
  { title: "Nightcall", artist: "Kavinsky", art: "../app/src/main/res/drawable/viviwrapped_v2.jpg", tone: "linear-gradient(135deg, #75dcca, #164765)" },
  { title: "After Dark", artist: "Mr.Kitty", art: "../app/src/main/res/drawable/viviwrapped_v1.jpg", tone: "linear-gradient(135deg, #20204f, #be5047)" },
  { title: "Dreaming", artist: "VIVI Radio", art: "../app/src/main/res/drawable/apple_headset.png", tone: "linear-gradient(135deg, #877a5d, #d8dbcf)" }
];

let activeTrack = 0;
let animationFrame;
let audioContext;
let analyser;
const audio = document.querySelector("#audio-player");
const playButton = document.querySelector("#play-button");
const heroPlay = document.querySelector("#hero-play");
const seekBar = document.querySelector("#seek-bar");
const timeLabel = document.querySelector("#time-label");
const canvas = document.querySelector("#visualizer");
const ctx = canvas.getContext("2d");
const authPanel = document.querySelector("#auth-panel");
const authStatus = document.querySelector("#auth-status");
const profileButton = document.querySelector("#profile-button");
const auth = { accessToken: null, tokenClient: null, youtubePlayer: null, youtubeTimer: null, isYouTubeTrack: false };
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const youtubeApiKey = import.meta.env.VITE_YOUTUBE_API_KEY;

function renderQueue() {
  const list = document.querySelector("#queue-list");
  list.innerHTML = tracks.map((track, index) => `
    <li class="queue-item ${index === activeTrack ? "is-active" : ""}" data-track="${index}">
      <div class="queue-thumb" style="--thumb:${track.tone}"><img src="${track.art}" alt="" /></div>
      <div><div class="queue-song">${track.title}</div><div class="queue-artist">${track.artist}</div></div>
    </li>`).join("");
}

function renderMixes() {
  document.querySelector("#mix-grid").innerHTML = tracks.map((track, index) => `
    <button class="mix-card" data-track="${index}">
      <img src="${track.art}" alt="" />
      <b>${track.title}</b><span>${track.artist}</span>
    </button>`).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function setTrack(index) {
  activeTrack = (index + tracks.length) % tracks.length;
  const track = tracks[activeTrack];
  document.querySelector("#now-playing").innerHTML = `${track.title.split(" ").slice(0, -1).join(" ") || track.title}<br /><em>${track.title.split(" ").slice(-1)}</em>`;
  document.querySelector("#artist-name").innerHTML = `${track.artist} <span>/ browser session</span>`;
  document.querySelector("#album-image").src = track.art;
  document.querySelector("#album-image").alt = track.artist;
  document.querySelector("#dock-art").src = track.art;
  document.querySelector("#dock-title").textContent = track.title;
  document.querySelector("#dock-artist").textContent = track.artist;
  auth.isYouTubeTrack = Boolean(track.videoId);
  audio.pause();
  audio.removeAttribute("src");
  if (auth.isYouTubeTrack) playYouTubeTrack(track.videoId).catch(() => updatePlayState(false));
  else if (auth.youtubePlayer) auth.youtubePlayer.pauseVideo();
  updatePlayState(false);
  renderQueue();
}

function updatePlayState(isPlaying) {
  playButton.textContent = isPlaying ? "PAUSE" : "PLAY";
  playButton.setAttribute("aria-label", isPlaying ? "Pause track" : "Play track");
  heroPlay.innerHTML = `${isPlaying ? "Pause track" : "Play track"} <span>--&gt;</span>`;
  document.querySelector("#dock-play").textContent = isPlaying ? "PAUSE" : "PLAY";
}

function togglePlayback() {
  if (auth.isYouTubeTrack && auth.youtubePlayer) {
    if (auth.youtubePlayer.getPlayerState() === window.YT.PlayerState.PLAYING) auth.youtubePlayer.pauseVideo();
    else auth.youtubePlayer.playVideo();
    return;
  }
  if (!audio.src) {
    document.querySelector("#audio-file").click();
    return;
  }
  if (audio.paused) audio.play(); else audio.pause();
}

function setupAudioGraph() {
  if (audioContext) return;
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 128;
  const source = audioContext.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioContext.destination);
}

function drawVisualizer() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  ctx.scale(scale, scale);
  const width = rect.width;
  const height = rect.height;
  const now = performance.now() / 750;
  const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
  if (analyser) analyser.getByteFrequencyData(data);
  ctx.clearRect(0, 0, width, height);
  const bars = 52;
  const gap = 3;
  const barWidth = (width - gap * (bars - 1)) / bars;
  for (let i = 0; i < bars; i += 1) {
    const signal = data ? data[Math.floor(i * data.length / bars)] / 255 : 0.18 + Math.abs(Math.sin(now + i * .4)) * .38;
    const barHeight = Math.max(4, signal * height * .83);
    const x = i * (barWidth + gap);
    const y = height - barHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, height);
    gradient.addColorStop(0, i % 7 === 0 ? "#ff684d" : "#d5ff58");
    gradient.addColorStop(1, "rgba(213, 255, 88, .1)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, 4);
    ctx.fill();
  }
  animationFrame = requestAnimationFrame(drawVisualizer);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function syncProgress(currentTime, duration) {
  const progress = duration ? currentTime / duration : 0;
  seekBar.value = Math.round(progress * 100);
  timeLabel.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  document.querySelector("#dock-current-time").textContent = formatTime(currentTime);
  document.querySelector("#dock-duration").textContent = formatTime(duration);
  document.querySelector("#dock-seek").value = seekBar.value;
  updateLyrics(progress);
}

function updateLyrics(progress) {
  const lines = [...document.querySelectorAll(".lyrics-window p")];
  const current = Math.min(lines.length - 1, Math.floor(progress * lines.length));
  lines.forEach((line, index) => line.classList.toggle("is-current", index === current));
}

document.querySelector("#audio-file").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  document.querySelector("#now-playing").innerHTML = `${file.name.replace(/\.[^/.]+$/, "")}<br /><em>Local</em>`;
  document.querySelector("#artist-name").innerHTML = "Your browser <span>/ local audio</span>";
  setupAudioGraph();
  audioContext.resume();
  audio.play();
});

audio.addEventListener("play", () => updatePlayState(true));
audio.addEventListener("pause", () => updatePlayState(false));
audio.addEventListener("ended", () => setTrack(activeTrack + 1));
audio.addEventListener("timeupdate", () => {
  syncProgress(audio.currentTime, audio.duration);
});

function seekTrack(value) {
  if (auth.isYouTubeTrack && auth.youtubePlayer) {
    const duration = auth.youtubePlayer.getDuration();
    if (duration) auth.youtubePlayer.seekTo(duration * value / 100, true);
  } else if (audio.duration) audio.currentTime = audio.duration * value / 100;
}

seekBar.addEventListener("input", () => seekTrack(seekBar.value));
document.querySelector("#dock-seek").addEventListener("input", (event) => seekTrack(event.target.value));
document.querySelector("#volume").addEventListener("input", (event) => { audio.volume = event.target.value / 100; });
playButton.addEventListener("click", togglePlayback);
heroPlay.addEventListener("click", togglePlayback);
document.querySelector("#previous-button").addEventListener("click", () => setTrack(activeTrack - 1));
document.querySelector("#next-button").addEventListener("click", () => setTrack(activeTrack + 1));
document.querySelector("#dock-previous").addEventListener("click", () => setTrack(activeTrack - 1));
document.querySelector("#dock-next").addEventListener("click", () => setTrack(activeTrack + 1));
document.querySelector("#dock-play").addEventListener("click", togglePlayback);
document.querySelector("#queue-list").addEventListener("click", (event) => {
  const item = event.target.closest(".queue-item");
  if (item) setTrack(Number(item.dataset.track));
});
document.querySelector("#mix-grid").addEventListener("click", (event) => {
  const card = event.target.closest(".mix-card");
  if (card) setTrack(Number(card.dataset.track));
});
document.querySelector("#like-button").addEventListener("click", (event) => {
  event.currentTarget.classList.toggle("is-saved");
  event.currentTarget.textContent = event.currentTarget.classList.contains("is-saved") ? "Saved to library" : "Save to library";
});
document.querySelector("#lyrics-toggle").addEventListener("click", (event) => {
  document.querySelector(".lyrics-card").classList.toggle("is-focus");
  event.currentTarget.textContent = document.querySelector(".lyrics-card").classList.contains("is-focus") ? "Close" : "Focus";
});
document.querySelector("#queue-clear").addEventListener("click", () => { document.querySelector("#queue-list").innerHTML = "<li class=\"queue-artist\">Queue cleared for this session.</li>"; });
document.querySelector("#fullscreen-button").addEventListener("click", () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); });
const themePicker = document.querySelector("#theme-picker");
function setTheme(theme) {
  document.body.dataset.theme = theme === "lagoon" ? "" : theme;
  localStorage.setItem("vivi-theme", theme);
  document.querySelectorAll(".theme-option").forEach((item) => item.classList.toggle("is-selected", item.dataset.theme === theme));
}
document.querySelector("#theme-button").addEventListener("click", () => { themePicker.hidden = !themePicker.hidden; document.querySelector("#theme-button").setAttribute("aria-expanded", String(!themePicker.hidden)); });
document.querySelector("#theme-close").addEventListener("click", () => { themePicker.hidden = true; document.querySelector("#theme-button").setAttribute("aria-expanded", "false"); });
document.querySelectorAll(".theme-option").forEach((option) => option.addEventListener("click", () => setTheme(option.dataset.theme)));
function openAuthPanel() {
  authPanel.hidden = false;
}

function setAuthStatus(message) {
  authStatus.textContent = message;
}

function loadScript(src, id) {
  if (document.querySelector(`#${id}`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("The provider script could not load."));
    document.head.append(script);
  });
}

async function loadGoogleIdentity() {
  await loadScript("https://accounts.google.com/gsi/client", "google-identity-services");
  if (!window.google?.accounts?.oauth2) throw new Error("Google Identity Services is unavailable.");
}

async function loadYouTubePlayerApi() {
  if (window.YT?.Player) return;
  if (!document.querySelector("#youtube-iframe-api")) {
    window.onYouTubeIframeAPIReady = () => window.dispatchEvent(new Event("youtube-api-ready"));
    const script = document.createElement("script");
    script.id = "youtube-iframe-api";
    script.src = "https://www.youtube.com/iframe_api";
    document.head.append(script);
  }
  await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("YouTube player timed out.")), 12000);
    window.addEventListener("youtube-api-ready", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
  });
}

async function playYouTubeTrack(videoId) {
  await loadYouTubePlayerApi();
  if (!auth.youtubePlayer) {
    auth.youtubePlayer = new window.YT.Player("youtube-player", {
      height: "1",
      width: "1",
      videoId,
      playerVars: { autoplay: 1, controls: 0, playsinline: 1, rel: 0 },
      events: {
        onReady: (event) => event.target.playVideo(),
        onStateChange: (event) => {
          const state = event.data;
          const playing = state === window.YT.PlayerState.PLAYING;
          updatePlayState(playing);
          if (playing) {
            window.clearInterval(auth.youtubeTimer);
            auth.youtubeTimer = window.setInterval(() => syncProgress(auth.youtubePlayer.getCurrentTime(), auth.youtubePlayer.getDuration()), 500);
          } else window.clearInterval(auth.youtubeTimer);
          if (state === window.YT.PlayerState.ENDED) setTrack(activeTrack + 1);
        }
      }
    });
  } else {
    auth.youtubePlayer.loadVideoById(videoId);
  }
}

async function fetchGoogleProfile() {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  if (!response.ok) throw new Error("Google profile request failed.");
  const profile = await response.json();
  profileButton.textContent = (profile.name || profile.email || "Google").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  profileButton.classList.remove("profile-signin");
  profileButton.setAttribute("aria-label", "Open Google account and playlists");
  setAuthStatus(`Connected as ${profile.email || profile.name}. Choose a playlist to load it into your queue.`);
}

function renderPlaylists(playlists) {
  const list = document.querySelector("#playlist-list");
  list.innerHTML = playlists.map((playlist) => {
    const thumbnail = playlist.snippet.thumbnails?.default?.url || "../app/src/main/res/drawable/icon.png";
    return `<button class="playlist-item" data-playlist-id="${escapeHtml(playlist.id)}"><img src="${escapeHtml(thumbnail)}" alt="" /><span><b>${escapeHtml(playlist.snippet.title)}</b><span>${playlist.contentDetails.itemCount || 0} tracks</span></span></button>`;
  }).join("") || "<p class=\"queue-artist\">No playlists are available for this account.</p>";
}

async function fetchPlaylists() {
  if (!auth.accessToken) return;
  setAuthStatus("Loading your YouTube playlists...");
  const params = new URLSearchParams({ part: "snippet,contentDetails", mine: "true", maxResults: "25" });
  if (youtubeApiKey) params.set("key", youtubeApiKey);
  const response = await fetch(`https://www.googleapis.com/youtube/v3/playlists?${params}`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  if (!response.ok) throw new Error("YouTube playlist access failed. Confirm that YouTube Data API v3 is enabled and your API key is restricted to this app origin.");
  const data = await response.json();
  renderPlaylists(data.items || []);
  setAuthStatus("Select a playlist to replace the current queue.");
}

async function loadPlaylist(playlistId) {
  setAuthStatus("Importing playlist tracks...");
  const params = new URLSearchParams({ part: "snippet,contentDetails", playlistId, maxResults: "50" });
  if (youtubeApiKey) params.set("key", youtubeApiKey);
  const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  if (!response.ok) throw new Error("The selected playlist could not be loaded.");
  const data = await response.json();
  const importedTracks = (data.items || []).map((item) => ({
    title: item.snippet.title,
    artist: item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle || "YouTube",
    art: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "../app/src/main/res/drawable/icon.png",
    tone: "linear-gradient(135deg, #a12b25, #251817)",
    videoId: item.contentDetails.videoId
  })).filter((track) => track.videoId && track.title !== "Private video" && track.title !== "Deleted video");
  if (!importedTracks.length) throw new Error("This playlist does not contain playable videos.");
  tracks = importedTracks;
  activeTrack = 0;
  renderQueue();
  renderMixes();
  setTrack(0);
  setAuthStatus(`${tracks.length} tracks imported. Select any item in your queue to play it.`);
  authPanel.hidden = true;
}

async function beginGoogleLogin() {
  if (!googleClientId) {
    setAuthStatus("Add VITE_GOOGLE_CLIENT_ID and VITE_YOUTUBE_API_KEY to web/.env, then restart the Vite server.");
    return;
  }
  try {
    setAuthStatus("Opening Google sign-in...");
    await loadGoogleIdentity();
    auth.tokenClient ??= window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
      callback: async (response) => {
        if (response.error || !response.access_token) {
          setAuthStatus("Google sign-in was not completed.");
          return;
        }
        auth.accessToken = response.access_token;
        document.querySelector("#playlist-area").hidden = false;
        try {
          await fetchGoogleProfile();
          await fetchPlaylists();
        } catch (error) {
          setAuthStatus(error.message);
        }
      }
    });
    auth.tokenClient.requestAccessToken({ prompt: "consent" });
  } catch (error) {
    setAuthStatus(error.message);
  }
}

profileButton.addEventListener("click", openAuthPanel);
document.querySelector("#auth-close").addEventListener("click", () => { authPanel.hidden = true; });
document.querySelector("#google-login").addEventListener("click", beginGoogleLogin);
document.querySelector("#playlist-refresh").addEventListener("click", () => fetchPlaylists().catch((error) => setAuthStatus(error.message)));
document.querySelector("#playlist-list").addEventListener("click", (event) => {
  const playlist = event.target.closest(".playlist-item");
  if (playlist) loadPlaylist(playlist.dataset.playlistId).catch((error) => setAuthStatus(error.message));
});
document.querySelector("#google-logout").addEventListener("click", () => {
  if (auth.accessToken && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(auth.accessToken);
  auth.accessToken = null;
  document.querySelector("#playlist-area").hidden = true;
  profileButton.textContent = "Sign in";
  profileButton.classList.add("profile-signin");
  setAuthStatus("Signed out. Connect Google to import your YouTube Music playlists.");
});
document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("is-active"));
  button.classList.add("is-active");
}));
window.addEventListener("resize", () => { cancelAnimationFrame(animationFrame); drawVisualizer(); });

renderQueue();
renderMixes();
setTheme(localStorage.getItem("vivi-theme") || "lagoon");
drawVisualizer();
