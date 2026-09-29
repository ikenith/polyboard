import puppeteer from "puppeteer-core";

const CHROME_PATH = "/usr/bin/google-chrome";

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  console.log("1. Loading home...");
  await page.goto("http://localhost:8787", { waitUntil: "networkidle0" });
  await page.screenshot({ path: "/tmp/flow_1_home.png" });
  console.log("Saved /tmp/flow_1_home.png");

  await page.waitForSelector("input[placeholder*='Alex']");
  await page.type("input[placeholder*='Alex']", "Alice");

  // Click create new game
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const btn = btns.find(b => b.textContent?.includes("Create"));
    if (btn) btn.click();
  });

  // Wait for room navigation
  await page.waitForFunction(() => window.location.pathname.startsWith("/room/"), { timeout: 10000 });
  const roomPath = await page.evaluate(() => window.location.pathname);
  console.log("2. Navigated to room:", roomPath);

  // Wait for lobby to load
  await page.waitForFunction(() => document.querySelector(".ludo-card") !== null, { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));

  const roomUrl = await page.evaluate(() => window.location.href);

  // Player 2 joins in incognito context
  console.log("3. Player 2 joining...");
  const context2 = await browser.createBrowserContext();
  const page2 = await context2.newPage();
  await page2.setViewport({ width: 1200, height: 900 });
  await page2.evaluateOnNewDocument(() => {
    localStorage.setItem("polyboard_player_name", "Bob");
  });
  await page2.goto(roomUrl, { waitUntil: "networkidle0" });

  // Wait for both players to show in lobby
  console.log("4. Waiting for 2 players in lobby...");
  await page.bringToFront();
  await page.waitForFunction(() => {
    return document.body.innerText.includes("Bob") && document.body.innerText.includes("Alice");
  }, { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: "/tmp/flow_4_lobby_2p.png" });
  console.log("Saved /tmp/flow_4_lobby_2p.png");

  // Start game from host (Alice)
  console.log("5. Starting game...");
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const btn = btns.find(b => b.textContent?.includes("Start Game"));
    if (btn) btn.click();
  });

  // Wait for game view (dice roller or board)
  await page.waitForFunction(() => {
    return document.querySelector("svg") !== null && (document.body.innerText.includes("TURN") || document.body.innerText.includes("ROLL"));
  }, { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: "/tmp/flow_5_game_active.png" });
  console.log("Saved /tmp/flow_5_game_active.png");

  await browser.close();
  console.log("Capture completed successfully!");
}

run().catch(err => {
  console.error("Error in capture flow:", err);
  process.exit(1);
});
