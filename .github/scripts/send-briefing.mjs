// scripts/send-briefing.mjs
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const WATCHLIST = ["AMD", "NBIS", "MVIS", "BULL", "IREN"];
const TODAY = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric"
});

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are AXIOM, an elite market analyst. Give a concise pre-market briefing using these exact headers:

## MARKET_PULSE
## OPPORTUNITIES
## WATCHLIST_DEEP
## EARNINGS_RADAR
## RISK_WARNINGS
## AXIOM_CALL

For WATCHLIST_DEEP cover each ticker: price, key news, verdict (BUY_SETUP / WATCH / AVOID).
For AXIOM_CALL give your single best trade today with entry and stop loss.
Be specific with numbers. Keep each section to 3-5 lines max.`;

Rules:
- No fluff. Every sentence must be actionable.
- For WATCHLIST_DEEP, cover each ticker: price, news, entry zone, verdict (BUY_SETUP / WATCH / AVOID)
- For OPPORTUNITIES, give 3-5 specific tickers with setup type and risk level
- For AXIOM_CALL, give your single best trade of the day with entry price and stop loss
- Flag all HIGH impact macro events today`;

// ─── CALL CLAUDE API ──────────────────────────────────────────────────────────
async function getBriefing() {
  console.log("🔍 Calling Claude API...");
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `Today is ${TODAY}. 
Watchlist: ${WATCHLIST.join(", ")}
Run the full pre-market intelligence briefing. Search for live data on each ticker and today's macro events.`
      }]
    })
  });

  const data = await response.json();
  
  if (data.error) throw new Error(`API Error: ${data.error.message}`);
  
  let text = "";
  for (const block of data.content || []) {
    if (block.type === "text") text += block.text;
  }
  return text;
}

// ─── PARSE SECTIONS ───────────────────────────────────────────────────────────
function parseSection(text, key) {
  const re = new RegExp(`## ${key}([\\s\\S]*?)(?=## [A-Z_]+|$)`);
  const m = text.match(re);
  return m ? m[1].trim() : "No data available.";
}

// ─── FORMAT AS HTML EMAIL ─────────────────────────────────────────────────────
function buildEmail(briefingText) {
  const sections = {
    MARKET_PULSE:    parseSection(briefingText, "MARKET_PULSE"),
    MACRO_EVENTS:    parseSection(briefingText, "MACRO_EVENTS"),
    SECTOR_ROTATION: parseSection(briefingText, "SECTOR_ROTATION"),
    OPPORTUNITIES:   parseSection(briefingText, "OPPORTUNITIES"),
    EARNINGS_RADAR:  parseSection(briefingText, "EARNINGS_RADAR"),
    WATCHLIST_DEEP:  parseSection(briefingText, "WATCHLIST_DEEP"),
    DONT_MISS:       parseSection(briefingText, "DONT_MISS"),
    RISK_WARNINGS:   parseSection(briefingText, "RISK_WARNINGS"),
    AXIOM_CALL:      parseSection(briefingText, "AXIOM_CALL"),
  };

  const renderSection = (icon, title, content, accentColor) => {
    // Format content: bold BUY_SETUP/WATCH/AVOID, format bullets
    const formatted = content
      .replace(/BUY_SETUP/g, `<span style="color:#22c55e;font-weight:700;background:#22c55e18;padding:2px 8px;border-radius:4px;">BUY SETUP ✓</span>`)
      .replace(/\bWATCH\b/g, `<span style="color:#f59e0b;font-weight:700;background:#f59e0b18;padding:2px 8px;border-radius:4px;">WATCH 👁</span>`)
      .replace(/\bAVOID\b/g, `<span style="color:#ef4444;font-weight:700;background:#ef444418;padding:2px 8px;border-radius:4px;">AVOID ✗</span>`)
      .replace(/^[-•] (.+)$/gm, `<div style="display:flex;gap:8px;margin:4px 0;"><span style="color:${accentColor}">▸</span><span>$1</span></div>`)
      .replace(/\n\n/g, '<br/>')
      .replace(/\n/g, '<br/>');

    return `
    <div style="margin-bottom:28px;border-radius:10px;overflow:hidden;border:1px solid #1e293b;">
      <div style="background:${accentColor}18;border-bottom:1px solid ${accentColor}30;padding:12px 18px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:18px;">${icon}</span>
        <span style="font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:${accentColor};letter-spacing:1px;">${title}</span>
      </div>
      <div style="padding:16px 18px;background:#0f172a;color:#94a3b8;font-size:14px;line-height:1.8;">
        ${formatted}
      </div>
    </div>`;
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#070b14;font-family:'Georgia',serif;">
<div style="max-width:680px;margin:0 auto;padding:24px 16px;">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid #1e3a4a;border-radius:12px;padding:24px 28px;margin-bottom:24px;text-align:center;">
    <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:4px;color:#38bdf8;margin-bottom:8px;">⚡ AXIOM MARKET INTELLIGENCE</div>
    <h1 style="margin:0;font-size:22px;color:#e2e8f0;font-weight:700;letter-spacing:-0.5px;">Pre-Market Briefing</h1>
    <div style="font-family:'Courier New',monospace;font-size:11px;color:#475569;margin-top:8px;">${TODAY} · Generated ${timeStr} ET</div>
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
      ${WATCHLIST.map(t => `<span style="background:#38bdf818;border:1px solid #38bdf830;border-radius:4px;padding:3px 10px;font-family:'Courier New',monospace;font-size:11px;color:#38bdf8;font-weight:700;">${t}</span>`).join("")}
    </div>
  </div>

  <!-- SECTIONS -->
  ${renderSection("🌐", "MARKET PULSE", sections.MARKET_PULSE, "#38bdf8")}
  ${renderSection("🎯", "OPPORTUNITIES TODAY", sections.OPPORTUNITIES, "#34d399")}
  ${renderSection("📅", "MACRO EVENTS", sections.MACRO_EVENTS, "#a78bfa")}
  ${renderSection("🔄", "SECTOR ROTATION", sections.SECTOR_ROTATION, "#fb923c")}
  ${renderSection("🔍", "WATCHLIST DEEP DIVE", sections.WATCHLIST_DEEP, "#f472b6")}
  ${renderSection("📢", "EARNINGS RADAR", sections.EARNINGS_RADAR, "#fbbf24")}
  ${renderSection("⚡", "DON'T MISS", sections.DONT_MISS, "#c084fc")}
  ${renderSection("⚠️", "RISK WARNINGS", sections.RISK_WARNINGS, "#fb7185")}

  <!-- AXIOM CALL - HIGHLIGHTED -->
  <div style="border-radius:12px;overflow:hidden;border:2px solid #fde68a40;margin-bottom:28px;">
    <div style="background:linear-gradient(135deg,#fde68a18,#f59e0b18);border-bottom:1px solid #fde68a30;padding:14px 20px;">
      <span style="font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#fde68a;letter-spacing:1px;">🏆 AXIOM'S BEST CALL TODAY</span>
    </div>
    <div style="padding:20px;background:#0f172a;color:#e2e8f0;font-size:14px;line-height:1.9;border-left:4px solid #fde68a;">
      ${sections.AXIOM_CALL.replace(/\n/g, "<br/>")}
    </div>
  </div>

  <!-- FOOTER -->
  <div style="text-align:center;padding:16px;border-top:1px solid #1e293b;">
    <p style="font-family:'Courier New',monospace;font-size:10px;color:#334155;margin:0;letter-spacing:1px;">
      FOR INFORMATIONAL USE ONLY · NOT FINANCIAL ADVICE<br/>
      AXIOM · MON–FRI 8:30 AM ET
    </p>
  </div>

</div>
</body>
</html>`;
}

// ─── SEND EMAIL ───────────────────────────────────────────────────────────────
async function sendEmail(htmlContent) {
  console.log("📧 Sending email...");
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
  console.log("📬 Gmail user:", process.env.GMAIL_USER ? "✅ loaded" : "❌ MISSING");
console.log("🔑 App password:", process.env.GMAIL_APP_PASSWORD ? "✅ loaded" : "❌ MISSING");

  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  
  await transporter.sendMail({
    from: `"AXIOM Markets" <${process.env.GMAIL_USER}>`,
    to: process.env.TO_EMAIL,
    subject: `⚡ ${dayName} Pre-Market Brief — AXIOM`,
    html: htmlContent
  });

  console.log("✅ Email sent successfully!");
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  try {
    console.log(`🚀 AXIOM starting for ${TODAY}`);
    const briefing = await getBriefing();
    console.log("✅ Briefing generated, building email...");
    const html = buildEmail(briefing);
    await sendEmail(html);
    console.log("🎯 Done!");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
