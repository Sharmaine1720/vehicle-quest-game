/** Shared by two deployments: public student bridge and Google-authenticated teacher UI. */
const SCORE_HEADERS = [
  "Submission ID",
  "Timestamp",
  "Student Name",
  "Grade Level",
  "Class",
  "Student Number",
  "Vehicle",
  "Question Set Version",
  "Correct Answers",
  "Total Questions",
  "Final Score /100",
  "Level 1 Score",
  "Level 2 Score",
  "Level 3 Score",
  "Completion Time",
];
function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}
function db_() {
  const id = prop_("SPREADSHEET_ID");
  if (!id) throw Error("Teacher setup is incomplete.");
  return SpreadsheetApp.openById(id);
}
function sheet_(name) {
  const s = db_().getSheetByName(name);
  if (!s) throw Error("Run initialize in the script editor first.");
  return s;
}
function lock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
function teacher_() {
  const email = Session.getActiveUser().getEmail().toLowerCase();
  const allowed = (prop_("TEACHER_EMAILS") || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim());
  if (!email || !allowed.includes(email))
    throw Error(
      "Teacher access denied. Sign in with an authorized Google account.",
    );
  return email;
}
function initialize() {
  teacher_();
  const db = db_();
  for (const [name, headers] of [
    ["Draft", ["Revision", "Updated", "Questions", "Settings"]],
    ["Versions", ["Version", "Published", "Teacher", "Questions", "Settings"]],
    ["Sessions", ["Token", "Created", "State"]],
    ["Student Scores", SCORE_HEADERS],
  ]) {
    if (!db.getSheetByName(name)) db.insertSheet(name).appendRow(headers);
  }
  if (sheet_("Draft").getLastRow() === 1)
    sheet_("Draft").appendRow([
      1,
      new Date(),
      JSON.stringify(INITIAL_QUESTIONS),
      JSON.stringify(defaultSettings_()),
    ]);
  if (sheet_("Versions").getLastRow() === 1)
    publishVersion_(INITIAL_QUESTIONS, defaultSettings_(), teacher_());
}
function defaultSettings_() {
  return {
    speed: 230,
    obstacleFrequency: 1.8,
    hearts: 3,
    feedbackDuration: 1200,
    volume: 0.18,
  };
}
function doGet(e) {
  const mode = e.parameter.mode;
  if (mode === "teacher") {
    try {
      teacher_();
      return HtmlService.createHtmlOutputFromFile("Teacher").setTitle(
        "Vehicle Quest · Teacher Dashboard",
      );
    } catch (err) {
      return HtmlService.createHtmlOutput(
        "Access denied. Sign in with an authorized teacher account.",
      );
    }
  }
  if (mode === "bridge") {
    const origins = (prop_("STUDENT_ORIGINS") || "")
      .split(",")
      .map((s) => s.trim());
    const origin = e.parameter.origin,
      channel = e.parameter.channel;
    if (
      !origins.includes(origin) ||
      !/^https?:\/\/[^/]+$/.test(origin) ||
      !channel ||
      !/^[a-f0-9-]{36}$/.test(channel)
    )
      return HtmlService.createHtmlOutput("Student origin is not authorized.");
    const template = HtmlService.createTemplateFromFile("Bridge");
    template.origin = origin;
    template.channel = channel;
    return template
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutput(
    "Vehicle Quest class server. Open the student game or authorized teacher deployment.",
  );
}
function checkSettings_(s) {
  s = s || defaultSettings_();
  for (const [k, min, max] of [
    ["speed", 120, 400],
    ["obstacleFrequency", 1.2, 6],
    ["hearts", 1, 5],
    ["feedbackDuration", 500, 5000],
    ["volume", 0, 0.4],
  ])
    if (typeof s[k] !== "number" || !isFinite(s[k]) || s[k] < min || s[k] > max)
      throw Error("Invalid setting: " + k);
  if (!Number.isInteger(s.hearts))
    throw Error("Hearts must be a whole number.");
  return s;
}
function validateQuestions_(qs, checkImages = true) {
  if (!Array.isArray(qs) || qs.length < 3 || qs.length > 60)
    throw Error("Use 3–60 questions.");
  const ids = {},
    orders = {},
    levels = {};
  qs.forEach((q) => {
    if (
      !q ||
      typeof q.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,60}$/.test(q.id) ||
      ids[q.id]
    )
      throw Error(
        "Question IDs must be unique letters, digits, hyphens or underscores.",
      );
    ids[q.id] = true;
    if (![1, 2, 3].includes(q.level) || typeof q.active !== "boolean")
      throw Error("Invalid level or active status.");
    for (const k of ["text", "a", "b"])
      if (typeof q[k] !== "string" || q[k].length > 1500)
        throw Error("Question fields must be text, up to 1500 characters.");
    if (!["A", "B"].includes(q.correct))
      throw Error("Choose A or B as the correct answer.");
    if (q.image && !/^[a-zA-Z0-9_-]{10,100}$/.test(q.image))
      throw Error("Invalid image reference.");
    if (q.image && checkImages) imageFile_(q.image);
    if (!q.active) return;
    if (!q.text.trim() || !q.a.trim() || !q.b.trim())
      throw Error("Every active question needs text and two choices.");
    if (
      !Number.isInteger(q.order) ||
      q.order < 1 ||
      orders[q.level + ":" + q.order]
    )
      throw Error("Use unique positive display orders within each level.");
    orders[q.level + ":" + q.order] = true;
    levels[q.level] = true;
  });
  if (Object.keys(levels).length !== 3)
    throw Error("Each level needs at least one active question.");
  if (JSON.stringify(qs).length > 44000)
    throw Error("Question bank is too large. Shorten the question text.");
  return qs
    .filter((q) => q.active)
    .sort((a, b) => a.level - b.level || a.order - b.order);
}
function draft_() {
  const row = sheet_("Draft").getRange(2, 1, 1, 4).getValues()[0];
  return {
    revision: Number(row[0]),
    questions: JSON.parse(row[2]),
    settings: JSON.parse(row[3]),
  };
}
function version_(id) {
  // Read one immutable version row, not the entire publication history.
  const sheet = sheet_("Versions");
  const match = id
    ? sheet
        .getRange("A:A")
        .createTextFinder(id)
        .matchEntireCell(true)
        .findNext()
    : null;
  const index = id ? (match ? match.getRow() : 0) : sheet.getLastRow();
  if (index < 2) throw Error("Question version unavailable.");
  const row = sheet.getRange(index, 1, 1, 5).getValues()[0];
  return {
    id: row[0],
    published: String(row[1]),
    teacher: row[2],
    questions: JSON.parse(row[3]),
    settings: JSON.parse(row[4]),
  };
}
function publishVersion_(questions, settings, email) {
  validateQuestions_(questions);
  checkSettings_(settings);
  const id = Utilities.getUuid();
  sheet_("Versions").appendRow([
    id,
    new Date(),
    email,
    JSON.stringify(questions),
    JSON.stringify(settings),
  ]);
  return id;
}
function teacherRequest(action, p) {
  const email = teacher_();
  p = p || {};
  if (action === "image") return cachedImage_(p.id);
  return lock_(() => {
    if (action === "load")
      return { draft: draft_(), published: version_(), email };
    if (action === "save") {
      const d = draft_();
      if (p.revision !== d.revision)
        throw Error("Another editor saved changes. Reload before saving.");
      validateDraft_(p.questions);
      checkSettings_(p.settings);
      sheet_("Draft")
        .getRange(2, 1, 1, 4)
        .setValues([
          [
            d.revision + 1,
            new Date(),
            JSON.stringify(p.questions),
            JSON.stringify(p.settings),
          ],
        ]);
      return { revision: d.revision + 1 };
    }
    if (action === "publish") {
      const d = draft_();
      if (p.revision !== d.revision)
        throw Error("Save or reload your draft before publishing.");
      return { version: publishVersion_(d.questions, d.settings, email) };
    }
    if (action === "history")
      return sheet_("Versions")
        .getDataRange()
        .getValues()
        .slice(1)
        .reverse()
        .map((r) => ({
          id: r[0],
          published: String(r[1]),
          teacher: r[2],
          count: JSON.parse(r[3]).filter((q) => q.active).length,
        }));
    if (action === "inspect") return version_(p.id);
    if (action === "restore") {
      const v = version_(p.id);
      return { version: publishVersion_(v.questions, v.settings, email) };
    }
    if (action === "upload") return upload_(p);
    throw Error("Unknown teacher action.");
  });
}
function imageFile_(id) {
  const folder = DriveApp.getFolderById(prop_("IMAGE_FOLDER_ID"));
  const file = DriveApp.getFileById(id);
  const parents = file.getParents();
  let found = false;
  while (parents.hasNext())
    if (parents.next().getId() === folder.getId()) found = true;
  if (
    !found ||
    file.isTrashed() ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.getMimeType()) ||
    file.getSize() > 200000
  )
    throw Error("Question image unavailable in the configured folder.");
  return file;
}
function image_(id) {
  const file = imageFile_(id);
  const blob = file.getBlob();
  return (
    "data:" +
    blob.getContentType() +
    ";base64," +
    Utilities.base64Encode(blob.getBytes())
  );
}
function upload_(p) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(p.mime) ||
    typeof p.data !== "string" ||
    p.data.length > 267000
  )
    throw Error("Upload a JPG, PNG, or WebP image under 200 KB.");
  const bytes = Utilities.base64Decode(p.data);
  if (bytes.length > 200000 || bytes.length < 12)
    throw Error("Image must be under 200 KB.");
  const u = bytes.map((b) => (b + 256) % 256);
  const png = u.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  const jpg = u[0] === 255 && u[1] === 216 && u[2] === 255;
  const webp =
    String.fromCharCode(...u.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...u.slice(8, 12)) === "WEBP";
  if (
    !(
      (p.mime === "image/png" && png) ||
      (p.mime === "image/jpeg" && jpg) ||
      (p.mime === "image/webp" && webp)
    )
  )
    throw Error("The image contents do not match its file type.");
  const file = DriveApp.getFolderById(prop_("IMAGE_FOLDER_ID")).createFile(
    Utilities.newBlob(bytes, p.mime, Utilities.getUuid()),
  );
  return { id: file.getId(), preview: "data:" + p.mime + ";base64," + p.data };
}
function clean_(v) {
  const s = String(v);
  return /^[\s]*[=+@\-\t\r\n]/.test(s) ? "'" + s : s;
}
function student_(s) {
  if (
    !s ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    s.name.length > 80 ||
    ![4, 5, 6].includes(Number(s.grade)) ||
    typeof s.class !== "string" ||
    !/^[\p{L}\p{N} -]{1,30}$/u.test(s.class) ||
    (/^\d{3}$/.test(s.class) && Number(s.class[0]) !== Number(s.grade)) ||
    typeof s.number !== "string" ||
    !/^[\p{L}\p{N} -]{1,20}$/u.test(s.number)
  )
    throw Error("Invalid student registration.");
  return {
    name: s.name.trim(),
    grade: Number(s.grade),
    class: s.class,
    number: s.number,
  };
}
function session_(token) {
  if (typeof token !== "string" || !/^[a-f0-9-]{73}$/.test(token))
    throw Error("Invalid play session.");
  const s = sheet_("Sessions"),
    match = s
      .getRange("A:A")
      .createTextFinder(token)
      .matchEntireCell(true)
      .findNext();
  if (!match) throw Error("Play session not found.");
  const row = match.getRow(),
    data = JSON.parse(s.getRange(row, 3).getValue());
  if (Date.now() - data.started > 24 * 3600000)
    throw Error(
      "This play session expired after 24 hours. Ask your teacher for help.",
    );
  return { row, data };
}
function publicRequest(action, p) {
  p = p || {};
  if (JSON.stringify(p).length > 10000) throw Error("Request too large.");
  if (action === "image") {
    // Only pictures from this session's published version are accessible.
    // Drive reads run outside the score/session lock so they cannot block classmates.
    const session = session_(p.token);
    const v = version_(session.data.version);
    const q = validateQuestions_(v.questions, false).find(
      (q) => q.id === p.questionId,
    );
    if (!q) throw Error("Question does not belong to this play session.");
    return { image: q.image ? cachedImage_(q.image) : "" };
  }
  if (action === "start") {
    const student = student_(p.student);
    if (!["car", "bus", "taxi", "bicycle", "motorcycle"].includes(p.vehicle))
      throw Error("Invalid vehicle.");
    const v = version_(),
      qs = validateQuestions_(v.questions, false);
    const token = Utilities.getUuid() + "-" + Utilities.getUuid();
    const deferred = p.assetMode === "deferred";
    lock_(() => {
      const cache = CacheService.getScriptCache();
      const key = "starts:" + Math.floor(Date.now() / 60000);
      const count = Number(cache.get(key) || 0);
      if (count >= 120)
        throw Error("Class server is busy. Please try again in a minute.");
      cache.put(key, String(count + 1), 120);
      const data = {
        started: Date.now(),
        student,
        vehicle: p.vehicle,
        version: v.id,
        answers: [],
        receipt: null,
      };
      sheet_("Sessions").appendRow([token, new Date(), JSON.stringify(data)]);
    });
    // New clients start with lightweight question metadata; old clients retain inline pictures.
    return {
      token,
      version: v.id,
      settings: v.settings,
      assetMode: deferred ? "deferred" : "inline",
      questions: qs.map((q) => ({
        id: q.id,
        text: q.text,
        a: q.a,
        b: q.b,
        level: q.level,
        image: !deferred && q.image ? cachedImage_(q.image) : "",
        imageRef: deferred ? q.image || "" : "",
      })),
    };
  }
  return lock_(() => {
    const session = session_(p.token),
      data = session.data,
      v = version_(data.version),
      qs = validateQuestions_(v.questions, false);
    if (action === "answer") {
      if (!["A", "B"].includes(p.choice)) throw Error("Invalid answer.");
      const index = qs.findIndex((q) => q.id === p.questionId);
      if (index < 0 || index > data.answers.length)
        throw Error("Answer the current question first.");
      if (index === data.answers.length) {
        data.answers.push(p.choice);
        sheet_("Sessions")
          .getRange(session.row, 3)
          .setValue(JSON.stringify(data));
      } else if (data.answers[index] !== p.choice)
        throw Error("This answer is already locked.");
      return {
        correct: data.answers[index] === qs[index].correct,
        answer: qs[index].correct,
      };
    }
    if (action === "complete") {
      if (data.answers.length !== qs.length)
        throw Error("Finish every question before submitting.");
      if (data.receipt) return data.receipt;
      const scores = sheet_("Student Scores");
      const existing = scores
        .getRange("A:A")
        .createTextFinder(p.token)
        .matchEntireCell(true)
        .findNext();
      const counts = [0, 0, 0],
        totals = [0, 0, 0];
      qs.forEach((q, i) => {
        totals[q.level - 1]++;
        if (data.answers[i] === q.correct) counts[q.level - 1]++;
      });
      const correct = counts.reduce((a, b) => a + b, 0),
        score = Math.round((correct / qs.length) * 10000) / 100;
      const receipt = {
        submissionId: p.token,
        correct,
        total: qs.length,
        score,
      };
      if (!existing) {
        const s = data.student;
        scores.appendRow([
          p.token,
          new Date(),
          clean_(s.name),
          s.grade,
          clean_(s.class),
          "'" + s.number,
          clean_(data.vehicle),
          data.version,
          correct,
          qs.length,
          score,
          ...counts.map((n, i) => Math.round((n / totals[i]) * 10000) / 100),
          Math.round((Date.now() - data.started) / 1000),
        ]);
      }
      data.receipt = receipt;
      sheet_("Sessions")
        .getRange(session.row, 3)
        .setValue(JSON.stringify(data));
      return receipt;
    }
    throw Error("Unknown student action.");
  });
}

function validateDraft_(questions) {
  if (
    !Array.isArray(questions) ||
    questions.length > 60 ||
    JSON.stringify(questions).length > 44000
  )
    throw Error("Draft is too large.");
  const ids = {};
  questions.forEach((q) => {
    if (
      !q ||
      typeof q.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,60}$/.test(q.id) ||
      ids[q.id] ||
      ![1, 2, 3].includes(q.level) ||
      typeof q.active !== "boolean" ||
      !["A", "B"].includes(q.correct) ||
      !Number.isInteger(q.order) ||
      q.order < 1
    )
      throw Error("Invalid draft question fields or duplicate ID.");
    ids[q.id] = true;
    for (const key of ["text", "a", "b"])
      if (typeof q[key] !== "string" || q[key].length > 1500)
        throw Error("Question fields must be text up to 1500 characters.");
    if (q.image) {
      if (!/^[a-zA-Z0-9_-]{10,100}$/.test(q.image))
        throw Error("Invalid image reference.");
      imageFile_(q.image);
    }
  });
}

// Cache raster data in bounded chunks (Apps Script limits each cache value to 100 KB).
// Cache eviction or failure only affects performance; Drive remains the source of truth.
function cachedImage_(id) {
  const cache = CacheService.getScriptCache();
  const prefix = "picture:" + id + ":";
  try {
    const count = Number(cache.get(prefix + "count"));
    if (count >= 1 && count <= 5) {
      const keys = Array.from({ length: count }, (_, i) => prefix + i);
      const chunks = cache.getAll(keys);
      if (keys.every((key) => typeof chunks[key] === "string"))
        return keys.map((key) => chunks[key]).join("");
    }
  } catch (error) {
    /* A cache miss must not prevent loading. */
  }
  const image = image_(id);
  try {
    const values = {},
      size = 64000,
      count = Math.ceil(image.length / size);
    for (let i = 0; i < count; i++)
      values[prefix + i] = image.slice(i * size, (i + 1) * size);
    cache.putAll(values, 900);
    cache.put(prefix + "count", String(count), 900);
  } catch (error) {
    /* Returning the verified Drive image is still safe. */
  }
  return image;
}
