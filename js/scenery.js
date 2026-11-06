export function scenery(ctx, level, road) {
  ctx.fillStyle = "#fff1a6";
  ctx.beginPath();
  ctx.arc(965, 63, 31, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffffaa";
  for (const x of [70, 250, 780]) {
    ctx.beginPath();
    ctx.ellipse(x, 54, 52, 12, 0, 0, 7);
    ctx.ellipse(x + 20, 46, 31, 18, 0, 0, 7);
    ctx.fill();
  }
  if (level === 1) {
    for (let n = 0; n < 5; n++) {
      ctx.fillStyle = n % 2 ? "#a8c65e" : "#d8cb6d";
      ctx.fillRect(0, 240 + n * 80 + ((road * 0.15) % 80), 75, 22);
      ctx.fillRect(1020, 240 + n * 80 + ((road * 0.15) % 80), 80, 22);
    }
    const y = 210 + ((road * 0.12) % 420);
    ctx.fillStyle = "#e47b60";
    ctx.fillRect(175, y, 80, 70);
    ctx.fillStyle = "#744a4c";
    ctx.beginPath();
    ctx.moveTo(165, y);
    ctx.lineTo(215, y - 45);
    ctx.lineTo(265, y);
    ctx.fill();
    ctx.fillStyle = "#fff0c2";
    ctx.fillRect(198, y + 25, 30, 45);
    ctx.strokeStyle = "#fff0c2";
    ctx.lineWidth = 4;
    ctx.strokeRect(181, y + 6, 68, 60);
  } else if (level === 2) {
    for (const x of [274, 825])
      for (let i = 0; i < 3; i++) {
        const y = ((i * 230 + road * 0.6) % 750) - 70;
        ctx.strokeStyle = "#374b63";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x, y + 100);
        ctx.lineTo(x, y);
        ctx.lineTo(x + (x < 500 ? -28 : 28), y);
        ctx.stroke();
        ctx.fillStyle = "#fff1a5";
        ctx.beginPath();
        ctx.arc(x + (x < 500 ? -28 : 28), y + 6, 10, 0, 7);
        ctx.fill();
      }
    ctx.fillStyle = "#fff0c1";
    ctx.fillRect(10, 118, 150, 30);
    ctx.fillStyle = "#37566b";
    ctx.font = "bold 17px system-ui";
    ctx.fillText("HELLO, CITY!", 20, 140);
  } else {
    for (const [x, y] of [
      [50, 25],
      [190, 60],
      [870, 35],
    ]) {
      ctx.fillStyle = "#647c90";
      ctx.beginPath();
      ctx.moveTo(x - 85, 180);
      ctx.lineTo(x + 35, y);
      ctx.lineTo(x + 160, 180);
      ctx.fill();
      ctx.fillStyle = "#edf9f6";
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 43);
      ctx.lineTo(x + 35, y);
      ctx.lineTo(x + 72, y + 43);
      ctx.lineTo(x + 38, y + 30);
      ctx.fill();
    }
    ctx.fillStyle = "#88e5eb";
    ctx.fillRect(100, 160, 22, 120);
    ctx.strokeStyle = "#d6ffff";
    ctx.lineWidth = 3;
    for (let n = 0; n < 3; n++) {
      const y = 175 + ((road * 0.5 + n * 30) % 90);
      ctx.beginPath();
      ctx.moveTo(106, y);
      ctx.lineTo(106, y + 17);
      ctx.stroke();
    }
    ctx.fillStyle = "#82d5dc";
    ctx.beginPath();
    ctx.ellipse(111, 286, 54, 15, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#d7e4df";
    ctx.lineWidth = 9;
    for (const x of [279, 821]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const y = (i * 90 + road) % 720;
        ctx.fillStyle = "#5f7179";
        ctx.fillRect(x - 4, y, 8, 35);
      }
    }
  }
}
