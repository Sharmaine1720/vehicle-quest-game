import {
  VEHICLES,
  validateStudent,
  validateBank,
  score,
  collision,
} from "./core.js";
import { Backend } from "./api.js";
import { QuestionPictures } from "./pictures.js";
import { loadArt } from "./art.js";
import { scenery } from "./scenery.js";
const $ = (id) => document.getElementById(id),
  cfg = window.VEHICLE_QUEST_CONFIG;
const api = cfg.studentApiUrl ? new Backend(cfg.studentApiUrl) : null;
const names = ["Sunny Countryside", "Busy City", "Mountain Adventure"];
let student,
  vehicle,
  questions = [],
  bank = [],
  answers = [],
  receipts = [],
  version,
  token,
  settings = {
    speed: 230,
    obstacleFrequency: 1.8,
    hearts: 3,
    feedbackDuration: 1200,
    volume: 0.18,
  },
  current = 0,
  level = 1,
  state = "idle",
  last = 0,
  elapsed = 0,
  started = 0,
  checkpointDistance = 0,
  spawn = 0,
  road = 0,
  boost = 0,
  immunity = 0,
  recovery = 0,
  hearts = 3,
  obstacles = [],
  steering = 0,
  answerBusy = false,
  answerAt = 0,
  pendingChoice = null,
  pictures = null;
let effects = true,
  musicEnabled = false,
  audio,
  music,
  player = { x: 550, y: 492, w: 80, h: 100 },
  frame = 0;
const images = {};
for (const v of VEHICLES)
  loadArt(`assets/vehicles/${v}-gameplay.png`)
    .then((image) => (images[v] = image))
    .catch(() => {});
function toast(message) {
  $("toast").textContent = message;
  $("toast").style.display = "block";
  setTimeout(() => ($("toast").style.display = "none"), 4000);
}
function show(id) {
  document.querySelectorAll(".screen").forEach((s) => (s.hidden = s.id !== id));
}
function sound(kind = "click") {
  if (!effects) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const seq = {
      correct: [523, 659, 784],
      wrong: [330, 262],
      bump: [140, 90],
      victory: [523, 659, 784, 1047],
      count: [440],
      boost: [440, 880],
      checkpoint: [659, 523],
      level: [523, 784],
      click: [550],
    }[kind] || [550];
    seq.forEach((f, i) => {
      const o = audio.createOscillator(),
        g = audio.createGain(),
        t = audio.currentTime + i * 0.12;
      o.type = kind === "bump" ? "triangle" : "sine";
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(settings.volume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g);
      g.connect(audio.destination);
      o.start(t);
      o.stop(t + 0.2);
    });
  } catch {
    /* Audio is optional. */
  }
}
function playMusic() {
  music?.pause();
  if (musicEnabled && cfg.musicTracks[level - 1]) {
    music = new Audio(cfg.musicTracks[level - 1]);
    music.loop = true;
    music.volume = settings.volume;
    music.play().catch(() => toast("Music could not play."));
  }
}
$("sound").onclick = () => {
  effects = !effects;
  $("sound").textContent = effects ? "♫ Sound on" : "♫ Sound off";
  $("sound").setAttribute("aria-pressed", String(effects));
  sound();
};
if (cfg.musicTracks.some(Boolean)) {
  $("music").disabled = false;
  $("music").textContent = "Music off";
  $("music").onclick = () => {
    musicEnabled = !musicEnabled;
    $("music").textContent = musicEnabled ? "Music on" : "Music off";
    playMusic();
  };
}
$("teacher").onclick = () => {
  if (cfg.teacherUrl) {
    window.open(cfg.teacherUrl, "_blank", "noopener");
    return;
  }
  $("teacher-message").textContent =
    "Teacher Mode uses a separate Google-authenticated dashboard. Ask your teacher to follow the Apps Script setup in README.md and configure the teacher URL. No teacher password is stored in this game.";
  $("teacher-info").showModal();
};
$("mode-note").textContent = api
  ? "Class mode · Scores are verified and recorded by your class server."
  : "Practice mode · Play all 15 questions. Scores stay on this device and are not recorded in Google Sheets.";
for (const v of VEHICLES) {
  const card = document.createElement("article");
  card.className = "vehicle";
  const image = document.createElement("img");
  image.src = `assets/vehicles/${v}-selection.png`;
  image.alt = v;
  loadArt(image.src)
    .then((art) => (image.src = art.toDataURL()))
    .catch(() => {});
  image.onerror = () => {
    image.hidden = true;
  };
  const title = document.createElement("h2");
  title.textContent = v;
  const button = document.createElement("button");
  button.textContent = "Select";
  button.onclick = () => {
    vehicle = v;
    sound();
    document
      .querySelectorAll(".vehicle")
      .forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    document
      .querySelectorAll(".vehicle button")
      .forEach((b) => b.setAttribute("aria-pressed", "false"));
    button.setAttribute("aria-pressed", "true");
    $("selected-label").textContent = `Your ${v} is ready!`;
    $("race-start").disabled = false;
  };
  card.append(image, title, button);
  $("vehicles").append(card);
}
$("registration").onsubmit = (e) => {
  e.preventDefault();
  student = Object.fromEntries(new FormData(e.target));
  Object.keys(student).forEach((k) => (student[k] = student[k].trim()));
  const error = validateStudent(student);
  $("registration-error").textContent = error;
  if (error) return;
  sound();
  show("selection");
};
$("race-start").onclick = async () => {
  const button = $("race-start");
  button.disabled = true;
  button.textContent = "Preparing your adventure…";
  $("race-loading-status").hidden = !api;
  try {
    if (api) {
      const result = await api.request("start", {
        student,
        vehicle,
        assetMode: "deferred",
      });
      ({ questions, version, token } = result);
      settings = { ...settings, ...result.settings };
      pictures = new QuestionPictures(api, token);
      pictures.prefetch(questions.slice(0, 2));
    } else {
      bank = validateBank(
        await fetch("data/questions.json").then((r) => {
          if (!r.ok) throw Error("Question bank unavailable.");
          return r.json();
        }),
      );
      questions = bank.map(({ correct, ...q }) => q);
      version = "practice-v1";
    }
    if (!questions.length) throw Error("No questions available.");
    answers = [];
    receipts = [];
    current = 0;
    level = 1;
    elapsed = 0;
    started = Date.now();
    hearts = settings.hearts;
    player.x = 550;
    obstacles = [];
    checkpointDistance = 0;
    spawn = 0;
    show("race");
    draw();
    $("progress").max = questions.length;
    updateHud();
    await countdown();
  } catch (e) {
    toast(e.message);
  } finally {
    button.disabled = false;
    button.textContent = "READY TO RACE! →";
    $("race-loading-status").hidden = true;
  }
};
async function countdown() {
  state = "countdown";
  playMusic();
  for (const n of ["3", "2", "1", "GO!"]) {
    $("race-message").textContent = n;
    sound("count");
    await new Promise((r) => setTimeout(r, 650));
  }
  $("race-message").textContent = "";
  state = "racing";
  last = performance.now();
  if (!frame) frame = requestAnimationFrame(tick);
}
function updateHud() {
  $("level-label").textContent = `${level} / 3 · ${names[level - 1]}`;
  $("progress-label").textContent =
    `Questions ${current} / ${questions.length}`;
  $("hearts").textContent =
    "♥".repeat(hearts) + "♡".repeat(settings.hearts - hearts);
  $("ride-label").textContent = vehicle;
  $("progress").value = current;
}
function steer(direction) {
  steering = state === "racing" ? direction : 0;
}
for (const [id, d] of [
  ["left", -1],
  ["right", 1],
]) {
  const b = $(id);
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    sound();
    steer(d);
  };
  b.onpointerup = b.onpointercancel = b.onlostpointercapture = () => steer(0);
}
window.addEventListener("keydown", (e) => {
  if (state !== "racing") return;
  if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(e.key)) {
    e.preventDefault();
    steer(["ArrowLeft", "a", "A"].includes(e.key) ? -1 : 1);
  }
});
window.addEventListener("keyup", () => steer(0));
window.addEventListener("blur", () => {
  steer(0);
  pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
function pause() {
  if (state === "racing") {
    state = "paused";
    $("pause").textContent = "▶ Resume";
    $("race-message").textContent = "Take a breath!";
    music?.pause();
  }
  steering = 0;
}
$("pause").onclick = () => {
  if (state === "paused") {
    state = "racing";
    $("pause").textContent = "Ⅱ Pause";
    $("race-message").textContent = "";
    playMusic();
  } else pause();
};
const canvas = $("track"),
  ctx = canvas.getContext("2d");
function draw() {
  const w = 1100,
    h = 600;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = ["#8fd6bd", "#a9cbd9", "#8ebec3"][level - 1];
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = ["#e0f2c6", "#dde8ef", "#cadbd9"][level - 1];
  ctx.beginPath();
  ctx.moveTo(0, 190);
  for (let x = 0; x <= 1100; x += 110)
    ctx.lineTo(x, 90 + Math.sin(x * 0.012) * 65);
  ctx.lineTo(1100, 600);
  ctx.lineTo(0, 600);
  ctx.fill();
  ctx.fillStyle = ["#6eb774", "#8197a2", "#608a80"][level - 1];
  ctx.fillRect(0, 200, w, 400);
  for (let i = 0; i < 9; i++) {
    const y = ((i * 95 + road * 0.4) % 760) - 120;
    for (const x of [125, 945]) {
      if (level === 2) {
        ctx.fillStyle = ["#ffc77e", "#e68c81", "#a7b7e5"][i % 3];
        ctx.fillRect(x - 55, y, 100, 110);
        ctx.fillStyle = "#fff4bc";
        for (let a = 0; a < 3; a++)
          for (let b = 0; b < 3; b++)
            ctx.fillRect(x - 42 + a * 29, y + 12 + b * 28, 16, 17);
      } else {
        ctx.fillStyle = level === 1 ? "#257f63" : "#2d6963";
        ctx.beginPath();
        ctx.moveTo(x, y - 40);
        ctx.lineTo(x - 45, y + 50);
        ctx.lineTo(x + 45, y + 50);
        ctx.fill();
        ctx.fillStyle = "#775e46";
        ctx.fillRect(x - 7, y + 45, 14, 25);
      }
    }
  }
  scenery(ctx, level, road);
  ctx.fillStyle = "#f5ebca";
  ctx.fillRect(290, 0, 520, h);
  ctx.fillStyle = "#526574";
  ctx.fillRect(310, 0, 480, h);
  ctx.strokeStyle = "#ecf0df";
  ctx.lineWidth = 5;
  ctx.setLineDash([35, 35]);
  ctx.lineDashOffset = -road;
  for (const x of [470, 630]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  obstacles.forEach((o) => {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.font = "52px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(["🚧", "🪨", "📦", "🪵", "🔺", "💧"][o.kind], 0, 0);
    ctx.restore();
  });
  ctx.save();
  if (immunity > 0 && Math.floor(immunity * 10) % 2) ctx.globalAlpha = 0.45;
  if (boost > 0) {
    ctx.fillStyle = "#ffdb60";
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 35, 28, 45, 0, 0, 7);
    ctx.fill();
  }
  const img = images[vehicle];
  if (img?.width) {
    ctx.drawImage(img, player.x - 76, player.y - 55, 152, 102);
  } else {
    ctx.fillStyle = "#ffd34e";
    ctx.fillRect(player.x - 30, player.y - 45, 60, 90);
    ctx.fillStyle = "#1e5969";
    ctx.fillRect(player.x - 22, player.y - 28, 44, 20);
  }
  ctx.restore();
  if (recovery > 0) {
    ctx.fillStyle = "#fff9de";
    ctx.fillRect(360, 250, 380, 75);
    ctx.fillStyle = "#123d54";
    ctx.font = "bold 24px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Pit stop! You’ve got this 💛", 550, 295);
  }
}
function tick(now) {
  frame = requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (state === "racing") {
    elapsed += dt;
    immunity = Math.max(0, immunity - dt);
    boost = Math.max(0, boost - dt);
    recovery = Math.max(0, recovery - dt);
    if (recovery === 0 && hearts === 0) {
      hearts = settings.hearts;
      updateHud();
    }
    const speed =
      settings.speed *
      (boost > 0 ? 1.45 : 1) *
      (immunity > 0 ? 0.65 : 1) *
      (recovery > 0 ? 0 : 1);
    road += speed * dt;
    checkpointDistance += speed * dt;
    player.x = Math.max(350, Math.min(750, player.x + steering * 380 * dt));
    spawn += dt;
    if (spawn > settings.obstacleFrequency && checkpointDistance < 1250) {
      spawn = 0;
      obstacles.push({
        x: [390, 550, 710][Math.floor(Math.random() * 3)],
        y: -65,
        w: 55,
        h: 55,
        kind: Math.floor(Math.random() * 6),
      });
    }
    for (const o of obstacles) {
      o.y += speed * dt;
      if (immunity === 0 && recovery === 0 && collision(player, o)) {
        hearts--;
        immunity = 2.2;
        o.y = 700;
        sound("bump");
        if (hearts === 0) {
          recovery = 2.5;
          immunity = 4.7;
          obstacles = [];
        }
        updateHud();
      }
    }
    obstacles = obstacles.filter((o) => o.y < 680);
    if (checkpointDistance >= 1600) openQuestion();
  }
  draw();
}
function openQuestion() {
  state = "question";
  steering = 0;
  obstacles = [];
  sound("checkpoint");
  const q = questions[current];
  $("question-label").textContent =
    `CHECKPOINT ${current + 1} OF ${questions.length} · LEVEL ${q.level}`;
  $("question-text").textContent = q.text;
  $("question-image").onerror = null;
  $("question-image").hidden = !q.image || Boolean(q.imageRef);
  if (q.image && !q.imageRef) {
    $("question-image").src = q.image;
    $("question-image").onerror = () => {
      $("question-image").hidden = true;
      toast("Picture unavailable. You can still answer the question.");
    };
  }
  $("picture-status").textContent = "";
  $("retry-picture").hidden = true;
  $("feedback").textContent = "";
  $("continue").hidden = true;
  $("retry-answer").hidden = true;
  answerBusy = false;
  pendingChoice = null;
  $("answers").replaceChildren();
  for (const [letter, key] of [
    ["A", "a"],
    ["B", "b"],
  ]) {
    const b = document.createElement("button");
    b.textContent = `${letter}. ${q[key]}`;
    b.disabled = Boolean(q.imageRef);
    b.onclick = () => answer(letter);
    $("answers").append(b);
  }
  $("checkpoint").showModal();
  if (q.imageRef) preparePicture(q);
}
async function preparePicture(question) {
  $("retry-picture").hidden = true;
  $("picture-status").textContent = "Loading this question’s picture…";
  try {
    const source = await pictures.load(question);
    if (questions[current] !== question || state !== "question") return;
    $("question-image").src = source;
    await $("question-image").decode();
    if (questions[current] !== question || state !== "question") return;
    $("question-image").hidden = false;
    $("picture-status").textContent = "";
    [...$("answers").children].forEach((button) => (button.disabled = false));
  } catch (error) {
    if (questions[current] !== question || state !== "question") return;
    question.image = "";
    pictures.tasks.delete(question.imageRef);
    $("question-image").hidden = true;
    $("picture-status").textContent = "Picture not loaded. " + error.message;
    $("retry-picture").hidden = false;
  }
}
$("retry-picture").onclick = () => preparePicture(questions[current]);
$("checkpoint").addEventListener("cancel", (e) => e.preventDefault());
async function answer(choice) {
  if (answerBusy || receipts[current]) return;
  answerBusy = true;
  pendingChoice = choice;
  $("retry-answer").hidden = true;
  [...$("answers").children].forEach((b) => (b.disabled = true));
  $("feedback").textContent = "Checking your answer…";
  try {
    const r = api
      ? await api.request("answer", {
          token,
          questionId: questions[current].id,
          choice,
        })
      : {
          correct: bank[current].correct === choice,
          answer: bank[current].correct,
        };
    answers[current] = choice;
    receipts[current] = r;
    answerAt = performance.now();
    [...$("answers").children].forEach((b, i) => {
      if (["A", "B"][i] === r.answer) b.classList.add("correct");
      else if (["A", "B"][i] === choice) b.classList.add("wrong");
    });
    $("feedback").textContent = r.correct
      ? "★ Brilliant! A speed boost for you!"
      : `Good try! The correct answer is ${r.answer}. ${questions[current][r.answer === "A" ? "a" : "b"]}`;
    sound(r.correct ? "correct" : "wrong");
    $("continue").hidden = false;
  } catch (e) {
    $("feedback").textContent = e.message + " Your answer is saved for retry.";
    $("retry-answer").hidden = false;
  } finally {
    answerBusy = false;
  }
}
$("retry-answer").onclick = () => answer(pendingChoice);
$("continue").onclick = () => {
  if (
    !receipts[current] ||
    performance.now() - answerAt < settings.feedbackDuration
  )
    return;
  const correct = receipts[current].correct;
  current++;
  pictures?.prefetch(questions.slice(current, current + 2));
  $("checkpoint").close();
  checkpointDistance = 0;
  boost = correct ? 3 : 0;
  if (correct) sound("boost");
  updateHud();
  if (current === questions.length) {
    finish();
    return;
  }
  if (questions[current].level !== level) {
    state = "transition";
    $("transition-title").textContent = `Level ${level} complete!`;
    $("transition-text").textContent =
      `Next stop: ${names[questions[current].level - 1]}. Keep going, explorer!`;
    $("transition").showModal();
    sound("level");
  } else state = "racing";
};
$("transition").addEventListener("cancel", (e) => e.preventDefault());
$("next-level").onclick = () => {
  level = questions[current].level;
  hearts = settings.hearts;
  updateHud();
  $("transition").close();
  countdown();
};
function safeStore(key, value) {
  try {
    value === null
      ? localStorage.removeItem(key)
      : localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function readPending() {
  try {
    return JSON.parse(localStorage.getItem("vq-pending"));
  } catch {
    return null;
  }
}
async function finish() {
  state = "finished";
  cancelAnimationFrame(frame);
  frame = 0;
  music?.pause();
  show("results");
  confetti();
  sound("victory");
  $("final-score").classList.add("celebrate");
  const correct = receipts.filter((r) => r.correct).length;
  const result = api
    ? {
        correct,
        total: questions.length,
        score: Math.round((correct / questions.length) * 10000) / 100,
      }
    : score(answers, bank);
  $("final-score").replaceChildren(
    document.createTextNode(String(result.score)),
    Object.assign(document.createElement("small"), { textContent: " / 100" }),
  );
  $("result-detail").textContent =
    `Well done, ${student.name}! Class ${student.class} · ${vehicle}`;
  $("result-stats").textContent =
    `${result.correct} / ${result.total} correct · ${Math.round(elapsed)} seconds of racing`;
  if (!api) {
    $("submission").textContent =
      "Practice complete. This result has not been sent to Google Sheets.";
    return;
  }
  if (!safeStore("vq-pending", { token, apiUrl: cfg.studentApiUrl }))
    toast(
      "This browser cannot save a retry. Keep this tab open until your score is recorded.",
    );
  await submit({ token, apiUrl: cfg.studentApiUrl });
}
async function submit(pending) {
  $("retry").hidden = true;
  $("submission").textContent = "Recording your verified result…";
  try {
    if (pending.apiUrl !== cfg.studentApiUrl)
      throw Error("This pending result belongs to a different class server.");
    const r = await api.request("complete", { token: pending.token });
    $("submission").textContent =
      `✓ Recorded in Google Sheets · Receipt ${r.submissionId}`;
    safeStore("vq-pending", null);
    $("resume-result").hidden = true;
  } catch (e) {
    $("submission").textContent = `Not recorded yet: ${e.message}`;
    $("retry").hidden = false;
  }
}
$("retry").onclick = () =>
  submit(readPending() || { token, apiUrl: cfg.studentApiUrl });
$("resume-result").hidden = !api || !readPending();
$("resume-result").onclick = () => {
  show("results");
  $("result-detail").textContent = "Retrying your previously completed game.";
  submit(readPending());
};
$("again").onclick = () => location.reload();
window.addEventListener("pagehide", () => {
  music?.pause();
});

function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 45; i++) {
    const p = document.createElement("span");
    p.className = "confetti";
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = ["#ffce46", "#e97974", "#178e79", "#7c9ce3"][i % 4];
    p.style.animationDelay = Math.random() * 2 + "s";
    document.body.append(p);
    setTimeout(() => p.remove(), 6000);
  }
}

loadArt("assets/vehicles/car-selection.png")
  .then((art) => (document.querySelector(".hero-car").src = art.toDataURL()))
  .catch(() => (document.querySelector(".hero-car").hidden = true));
