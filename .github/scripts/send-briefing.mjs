import fetch from "node-fetch";
import nodemailer from "nodemailer";

const WATCHLIST = ["SPY", "QQQ", "NVDA", "PLTR", "MVIS"];

const TODAY = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric"
});

const SYSTEM_PROMPT = [
  "You are AXIOM, an elite market analyst with 30 years of experience.",
  "Give a concise pre-market briefing using EXACTLY these section headers on their own lines:",
  "## MARKET_PULSE",
  "## OPPORTUNITIES",
  "## WATCHLIST_DEEP",
  "## EARNINGS_RADAR",
  "## RISK_WARNINGS",
  "## AXIOM_CALL",
  "Rules:",
  "1. MARKET_PULSE: Overall market sentiment, SPY/QQQ/VIX levels, risk-on or risk-off.",
  "2. OPPORTUNITIES: 3 specific stocks with a setup today. Format: TICKER | Setup | Risk (LOW/MED/HIGH).",
  "3. WATCHLIST_DEEP: For each ticker in the watchlist: price, key news, verdict BUY_SETUP or WATCH or AVOID.",
  "4. EARNINGS_RADAR: Who reports this week, expected EPS, market impact.",
  "5. RISK_WARNINGS: Top 3 risks that could crash markets this week.",
  "6. AXIOM_CALL: Your single best trade today. Ticker, entry price, stop loss, reason. Be bold.",
  "Keep each section under 5 lines. Be specific with numbers. No fluff."
].join("\n");

async function getBriefing() {
  console.log("Calling Claude API...");
  const body = {
    model: "claude-sonnet-4-5",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [
      {
        role: "user",
        content: "Today is " + TODAY + ". Watchlist: " + WATCHLIST.join(", ") + ". Run the full pre-market briefing. Search for live prices and news for each ticker."
      }
    ]
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (data.error) {
    throw new Error("API Error: " + data.error.message);
  }

  let text = "";
  for (const block of data.content || []) {
    if (block.type === "text") {
      text += block.text;
    }
  }
  return text;
}

function parseSection(text, key) {
  const re = new RegExp("## " + key + "([\\s\\S]*?)(?=## [A-Z_]+|$)");
  const m = text.match(re);
  return m ? m[1].trim() : "No data available.";
}

function sectionBlock(icon, title, content, color) {
  const formatted = content
    .replace(/BUY_SETUP/g, "<span style='color:#22c55e;font-weight:700'>BUY SETUP</span>")
    .replace(/\bWATCH\b/g, "<span style='color:#f59e0b;font-weight:700'>WATCH</span>")
    .replace(/\bAVOID\b/g, "<span style='color:#ef4444;font-weight:700'>AVOID</span>")
    .replace(/\n/g, "<br/>");

  return [
    "<div style='margin-bottom:24px;border-radius:8px;overflow:hidden;border:1px solid #1e293b;'>",
    "<div style='background:" + color + "18;border-bottom:1px solid " + color + "30;padding:10px 16px;'>",
    "<span style='font-family:monospace;font-size:13px;font-weight:700;color:" + color + ";'>" + icon + " " + title + "</span>",
    "</div>",
    "<div style='padding:14px 16px;background:#0f172a;color:#94a3b8;font-size:13px;line-height:1.8;'>",
    formatted,
    "</div>",
    "</div>"
  ].join("");
}

function buildEmail(briefing) {
  const mp  = parseSection(briefing, "MARKET_PULSE");
  const opp = parseSection(briefing, "OPPORTUNITIES");
  const wd  = parseSection(briefing, "WATCHLIST_DEEP");
  const er  = parseSection(briefing, "EARNINGS_RADAR");
  const rw  = parseSection(briefing, "RISK_WARNINGS");
  const ac  = parseSection(briefing, "AXIOM_CALL");

  const tickers = WATCHLIST.map(function(t) {
    return "<span style='background:#38bdf818;border:1px solid #38bdf830;border-radius:4px;padding:2px 8px;font-family:monospace;font-size:11px;color:#38bdf8;margin:2px;display:inline-block;'>" + t + "</span>";
  }).join(" ");

  return [
    "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>",
    "<body style='margin:0;padding:0;background:#070b14;font-family:Georgia,serif;'>",
    "<div style='max-width:660px;margin:0 auto;padding:24px 16px;'>",

    "<div style='background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid #1e3a4a;border-radius:12px;padding:22px;margin-bottom:24px;text-align:center;'>",
    "<div style='font-family:monospace;font-size:10px;letter-spacing:4px;color:#38bdf8;margin-bottom:6px;'>AXIOM MARKET INTELLIGENCE</div>",
    "<h1 style='margin:0;font-size:20px;color:#e2e8f0;'>Pre-Market Briefing</h1>",
    "<div style='font-family:monospace;font-size:11px;color:#475569;margin-top:6px;'>" + TODAY + "</div>",
    "<div style='margin-top:10px;'>" + tickers + "</div>",
    "</div>",

    sectionBlock("🌐", "MARKET PULSE",      mp,  "#38bdf8"),
    sectionBlock("🎯", "OPPORTUNITIES",     opp, "#34d399"),
    sectionBlock("🔍", "WATCHLIST DEEP",    wd,  "#f472b6"),
    sectionBlock("📢", "EARNINGS RADAR",    er,  "#fbbf24"),
    sectionBlock("⚠️", "RISK WARNINGS",     rw,  "#fb7185"),

    "<div style='border-radius:10px;overflow:hidden;border:2px solid #fde68a40;margin-bottom:24px;'>",
    "<div style='background:linear-gradient(135deg,#fde68a18,#f59e0b18);border-bottom:1px solid #fde68a30;padding:12px 16px;'>",
    "<span style='font-family:monospace;font-size:13px;font-weight:700;color:#fde68a;'>🏆 AXIOM BEST CALL TODAY</span>",
    "</div>",
    "<div style='padding:16px;background:#0f172a;color:#e2e8f0;font-size:14px;line-height:1.9;border-left:4px solid #fde68a;'>",
    ac.replace(/\n/g, "<br/>"),
    "</div></div>",

    "<div style='text-align:center;font-family:monospace;font-size:10px;color:#334155;padding:12px;'>",
    "FOR INFORMATIONAL USE ONLY - NOT FINANCIAL ADVICE - AXIOM MON-FRI 8:30 AM ET",
    "</div>",

    "</div></body></html>"
  ].join("");
}

async function sendEmail(html) {
  console.log("Gmail user:", process.env.GMAIL_USER ? "loaded" : "MISSING");
  console.log("App password:", process.env.GMAIL_APP_PASSWORD ? "loaded" : "MISSING");

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });

  await transporter.sendMail({
    from: "AXIOM Markets <" + process.env.GMAIL_USER + ">",
    to: process.env.TO_EMAIL,
    subject: "AXIOM " + day + " Pre-Market Brief",
    html: html
  });

  console.log("Email sent successfully!");
}

async function main() {
  try {
    console.log("AXIOM starting for " + TODAY);
    const briefing = await getBriefing();
    console.log("Briefing generated, building email...");
    const html = buildEmail(briefing);
    await sendEmail(html);
    console.log("Done!");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
