export const VEHICLES = ["car", "bus", "taxi", "bicycle", "motorcycle"];
export function validateStudent(s) {
  if (!s || !String(s.name || "").trim() || String(s.name).length > 80)
    return "Please enter your name (up to 80 letters).";
  if (![4, 5, 6].includes(Number(s.grade))) return "Choose Grade 4, 5, or 6.";
  if (!/^[\p{L}\p{N} -]{1,30}$/u.test(s.class || ""))
    return "Enter your class, for example 401 or Grade 4 A.";
  if (/^\d{3}$/.test(s.class) && Number(s.class[0]) !== Number(s.grade))
    return "Your class code must match your grade.";
  if (!/^[\p{L}\p{N} -]{1,20}$/u.test(s.number || ""))
    return "Enter your student number (up to 20 characters).";
  return "";
}
export function score(answers, questions) {
  const counts = [0, 0, 0],
    totals = [0, 0, 0];
  questions.forEach((q, i) => {
    totals[q.level - 1]++;
    if (answers[i] === q.correct) counts[q.level - 1]++;
  });
  const correct = counts.reduce((a, b) => a + b, 0);
  return {
    correct,
    total: questions.length,
    score: Math.round((correct / questions.length) * 10000) / 100,
    levels: counts.map((n, i) => Math.round((n / totals[i]) * 10000) / 100),
  };
}
export function validateBank(questions) {
  if (
    !Array.isArray(questions) ||
    questions.length < 3 ||
    questions.length > 60
  )
    throw Error(
      "Use 3–60 questions, with at least one active question per level.",
    );
  const ids = new Set(),
    orders = new Set(),
    levels = new Set();
  questions.forEach((q) => {
    if (!q.id || ids.has(q.id)) throw Error("Question IDs must be unique.");
    ids.add(q.id);
    if (![1, 2, 3].includes(q.level)) throw Error("Choose level 1, 2, or 3.");
    if (typeof q.active !== "boolean")
      throw Error("Active status is required.");
    if (!q.active) return;
    if (
      !q.text?.trim() ||
      !q.a?.trim() ||
      !q.b?.trim() ||
      !["A", "B"].includes(q.correct)
    )
      throw Error(
        "Each active question needs text, two choices, and a correct answer.",
      );
    if (
      !Number.isInteger(q.order) ||
      q.order < 1 ||
      orders.has(`${q.level}:${q.order}`)
    )
      throw Error("Use unique positive display orders within each level.");
    orders.add(`${q.level}:${q.order}`);
    levels.add(q.level);
  });
  if (levels.size !== 3)
    throw Error("Each of the three levels needs an active question.");
  return questions
    .filter((q) => q.active)
    .sort((a, b) => a.level - b.level || a.order - b.order);
}
export function collision(player, obstacle) {
  return (
    Math.abs(player.x - obstacle.x) < player.w * 0.38 + obstacle.w * 0.38 &&
    Math.abs(player.y - obstacle.y) < player.h * 0.33 + obstacle.h * 0.33
  );
}
