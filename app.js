// started this for GUVI AI for India 2.0 — only had COCO-SSD back then
// added MediaPipe later when I wanted gesture detection too
// whole thing runs in browser, no backend needed

let cocoModel = null;
let handDetector = null;

let lastTime = performance.now();
let frameCount = 0;
let smoothedConf = 0;

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

document.getElementById("theme-toggle").addEventListener("click", function() {
  const root = document.documentElement;
  const isLight = root.getAttribute("data-theme") === "light";
  root.setAttribute("data-theme", isLight ? "dark" : "light");
  this.innerHTML = isLight ? "🌙 <span>Light</span>" : "☀️ <span>Dark</span>";
});

// mediapipe gives 21 keypoints per hand
// I check which fingers are "up" based on y-coordinate of tip vs base
// thumb is different — it extends sideways so I use x instead of y
function classifyGesture(kp) {
  const thumbUp  = kp[4].x < kp[3].x - 15;
  const indexUp  = kp[8].y  < kp[6].y  - 10;
  const middleUp = kp[12].y < kp[10].y - 10;
  const ringUp   = kp[16].y < kp[14].y - 10;
  const pinkyUp  = kp[20].y < kp[18].y - 10;

  // fist check — all fingers curled below their base knuckle
  const fist =
    kp[8].y  > kp[5].y &&
    kp[12].y > kp[9].y &&
    kp[16].y > kp[13].y &&
    kp[20].y > kp[17].y;

  const count = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;

  if (fist && !thumbUp)                                        return { e: "✊", n: "Fist" };
  if ( thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) return { e: "👍", n: "Thumbs Up" };
  if (!thumbUp &&  indexUp &&  middleUp && !ringUp && !pinkyUp) return { e: "✌️", n: "Peace" };
  if (!thumbUp &&  indexUp && !middleUp && !ringUp && !pinkyUp) return { e: "☝️", n: "Pointing" };
  if ( thumbUp && !indexUp && !middleUp && !ringUp &&  pinkyUp) return { e: "🤙", n: "Call Me" };
  if ( thumbUp &&  indexUp && !middleUp && !ringUp && !pinkyUp) return { e: "🤘", n: "Rock On" };
  if ( indexUp &&  middleUp && ringUp   &&  pinkyUp)            return { e: "🖐️", n: "Open Hand" };
  if ( thumbUp &&  indexUp  && middleUp && ringUp  &&  pinkyUp) return { e: "🙌", n: "All Five!" };

  return { e: "🤟", n: count + " Fingers" };
}

// hand bone connections from mediapipe docs
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17]
];

function drawHand(kp) {
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2;

  for (const [i, j] of CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(kp[i].x, kp[i].y);
    ctx.lineTo(kp[j].x, kp[j].y);
    ctx.stroke();
  }

  for (let i = 0; i < kp.length; i++) {
    const tip = [4, 8, 12, 16, 20].includes(i);
    ctx.beginPath();
    ctx.arc(kp[i].x, kp[i].y, tip ? 6 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = tip ? "#4ade80" : "#22c55e";
    ctx.fill();
  }
}

// had a bug where the label text was mirrored — fixed it by temporarily unflipping canvas before drawing text
function drawBoxes(preds) {
  for (const pred of preds) {
    if (pred.class !== "person" || pred.score < 0.45) continue;

    const [x, y, w, h] = pred.bbox;
    const conf = (pred.score * 100).toFixed(1);

    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "rgba(34,197,94,0.06)";
    ctx.fillRect(x, y, w, h);

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    const mx = canvas.width - x - w;
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(mx, y - 26, 145, 26);
    ctx.fillStyle = "#052e16";
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.fillText("Person  " + conf + "%", mx + 8, y - 7);
    ctx.restore();
  }
}

function updatePersonUI(preds) {
  const people = preds.filter(p => p.class === "person" && p.score >= 0.45);
  const count = people.length;
  const raw = count > 0 ? Math.max(...people.map(p => p.score)) : 0;

  // smoothing so confidence doesn't jump around every frame
  smoothedConf = smoothedConf * 0.8 + raw * 0.2;
  const conf = count > 0 ? (smoothedConf * 100).toFixed(1) : null;

  document.getElementById("val-count").textContent = count;
  document.getElementById("val-conf").textContent  = conf ? conf + "%" : "--%";
  document.getElementById("main-conf").textContent = conf || "--";
  document.getElementById("main-label").textContent = count > 0
    ? count + " Person" + (count > 1 ? "s" : "") + " Detected"
    : "No Person";

  if (count > 0) {
    document.getElementById("val-status").textContent = "Detected";
    document.getElementById("card-status").className  = "stat-card alert";
    document.getElementById("card-count").className   = "stat-card alert";
  } else {
    smoothedConf = 0;
    document.getElementById("val-status").textContent = "Clear";
    document.getElementById("card-status").className  = "stat-card safe";
    document.getElementById("card-count").className   = "stat-card";
  }
}

function updateFPS() {
  frameCount++;
  const now = performance.now();
  const elapsed = now - lastTime;
  if (elapsed >= 1000) {
    const fps = Math.round((frameCount * 1000) / elapsed);
    document.getElementById("fps-display").textContent = fps + " FPS";
    frameCount = 0;
    lastTime = now;
  }
}

async function detectLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (cocoModel) {
    const preds = await cocoModel.detect(video);
    drawBoxes(preds);
    updatePersonUI(preds);
  }

  if (handDetector) {
    try {
      const hands = await handDetector.estimateHands(video, { flipHorizontal: false });
      if (hands.length > 0) {
        for (const h of hands) drawHand(h.keypoints);
        const g = classifyGesture(hands[0].keypoints);
        document.getElementById("gesture-label").textContent = g.n;
        document.getElementById("gesture-emoji").textContent = g.e;
        document.getElementById("gesture-icon").textContent  = g.e;
        document.getElementById("val-gesture").textContent   = g.n;
        document.getElementById("card-gesture").className    = "stat-card active";
      } else {
        document.getElementById("gesture-label").textContent = "No Hand";
        document.getElementById("gesture-emoji").textContent = "🤔";
        document.getElementById("gesture-icon").textContent  = "✋";
        document.getElementById("val-gesture").textContent   = "—";
        document.getElementById("card-gesture").className    = "stat-card";
      }
    } catch (e) {}
  }

  updateFPS();
  requestAnimationFrame(detectLoop);
}

async function main() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    await new Promise(res => {
      video.onloadedmetadata = () => {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        res();
      };
    });

    document.getElementById("status").textContent = "Loading COCO-SSD...";
    cocoModel = await cocoSsd.load();

    document.getElementById("status").textContent = "Loading MediaPipe Hands...";
    document.getElementById("tag-coco").className = "tag ready";

    handDetector = await handPoseDetection.createDetector(
      handPoseDetection.SupportedModels.MediaPipeHands,
      {
        runtime: "mediapipe",
        solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240",
        modelType: "full",
        maxHands: 2
      }
    );

    document.getElementById("status").textContent = "Ready ✓";
    document.getElementById("tag-mp").className = "tag ready";
    document.getElementById("live-dot").style.background = "#22c55e";

    detectLoop();

  } catch (err) {
    document.getElementById("status").textContent = "Error: " + err.message;
  }
}

main();