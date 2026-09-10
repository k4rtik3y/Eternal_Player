import "./styles.css";

const tracks = [
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

function renderQueue() {
  const list = document.querySelector("#queue-list");
  list.innerHTML = tracks.map((track, index) => `
    <li class="queue-item ${index === activeTrack ? "is-active" : ""}" data-track="${index}">
      <div class="queue-thumb" style="--thumb:${track.tone}"><img src="${track.art}" alt="" /></div>
      <div><div class="queue-song">${track.title}</div><div class="queue-artist">${track.artist}</div></div>
    </li>`).join("");
}

function setTrack(index) {
  activeTrack = (index + tracks.length) % tracks.length;
  const track = tracks[activeTrack];
  document.querySelector("#now-playing").innerHTML = `${track.title.split(" ").slice(0, -1).join(" ") || track.title}<br /><em>${track.title.split(" ").slice(-1)}</em>`;
  document.querySelector("#artist-name").innerHTML = `${track.artist} <span>/ browser session</span>`;
  document.querySelector("#album-image").src = track.art;
  document.querySelector("#album-image").alt = track.artist;
  audio.pause();
  audio.removeAttribute("src");
  updatePlayState(false);
  renderQueue();
}

function updatePlayState(isPlaying) {
  playButton.textContent = isPlaying ? "PAUSE" : "PLAY";
  playButton.setAttribute("aria-label", isPlaying ? "Pause track" : "Play track");
  heroPlay.innerHTML = `${isPlaying ? "Pause track" : "Play track"} <span>--&gt;</span>`;
}

function togglePlayback() {
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
  const progress = audio.duration ? audio.currentTime / audio.duration : 0;
  seekBar.value = Math.round(progress * 100);
  timeLabel.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  updateLyrics(progress);
});

seekBar.addEventListener("input", () => { if (audio.duration) audio.currentTime = audio.duration * seekBar.value / 100; });
document.querySelector("#volume").addEventListener("input", (event) => { audio.volume = event.target.value / 100; });
playButton.addEventListener("click", togglePlayback);
heroPlay.addEventListener("click", togglePlayback);
document.querySelector("#previous-button").addEventListener("click", () => setTrack(activeTrack - 1));
document.querySelector("#next-button").addEventListener("click", () => setTrack(activeTrack + 1));
document.querySelector("#queue-list").addEventListener("click", (event) => {
  const item = event.target.closest(".queue-item");
  if (item) setTrack(Number(item.dataset.track));
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
document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("is-active"));
  button.classList.add("is-active");
}));
window.addEventListener("resize", () => { cancelAnimationFrame(animationFrame); drawVisualizer(); });

renderQueue();
drawVisualizer();
