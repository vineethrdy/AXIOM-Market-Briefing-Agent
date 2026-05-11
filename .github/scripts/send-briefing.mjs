import fetch from "node-fetch";
import nodemailer from "nodemailer";

const WATCHLIST = ["SPY", "NVDA", "PLTR", "MVIS"];

const TODAY = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric"
});

const SYSTEM_PROMPT = "You are a stock market analyst. Give a brief pre-market report with these headers: ## MARKET_PULSE ## OPPORTUNITIES ## WATCHLIST ## AXIOM_CALL. For WATCHLIST cover each ticker with price, news, and verdict: BUY_SETUP or WATCH or AVOID. Keep total response under 400 words.";

const USER_MSG = "Today is " + TODAY + ". Watchlist: " + WATCHLIST.join(", ") + ". Give me the pre-market briefing with live data.";

async function getBriefing() {
  console.log("Calling Claude API...");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
      messages: [{ role: "user", content: USER_MSG }]
    })
  });

  const data = await res.json();
  if (data.error) throw new Error("API Error: " + data.error.message);

  let text = "";
  for (const block of data.content || []) {
    if (block.type === "text") text += block.text;
  }
  return text;
}

function parseSection(text, key) {
  const re = new RegExp("## " + key + "([\\s\\S]*?)(?=## |$)");
  const m = text.match(re);
  return m ? m[1].trim() : "No data.";
}

function sectionBlock(icon, title, content, color) {
  const formatted = content
    .replace(/BUY_SETUP/g, "<b style='color:#22c55e'>BUY SETUP</b>")
    .replace(/\bWATCH\b/g, "<b style='color:#f59e0b'>WATCH</b>")
    .replace(/\bAVOID\b/g, "<b style='color:#ef4444'>AVOID</b>")
    .replace(/\n/g, "<br/>");
  return "<div style='margin-bottom:20px;border-radius:8px;border:1px solid #1e293b;overflow:hidden;'>"
    + "<div style='background:" + color + "22;padding:10px 16px;border-bottom:1px solid " + color + "33;'>"
    + "<span style='font-family:monospace;font-weight:700;color:" + color + ";font-size:13px;'>" + icon + " " + title + "</span>"
    + "</div>"
    + "<div style='padding:14px 16px;background:#0f172a;color:#94a3b8;font-size:13px;line-height:1.8;'>"
    + formatted
    + "</div></div>";
}

function buildEmail(briefing) {
  const tickers = WATCHLIST.map(function(t) {
    return "<span style='background:#38bdf812;border:1px solid #38bdf830;border-radius:4px;padding:2px 8px;font-family:monospace;font-size:11px;color:#38bdf8;margin:2px;display:inline-block;'>" + t + "</span>";
  }).join(" ");

  return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>"
    + "<body style='margin:0;padding:0;background:#070b14;font-family:Georgia,serif;'>"
    + "<div style='max-width:640px;margin:0 auto;padding:24px 16px;'>"

    + "<div style='background:#0f172a;border:1px solid #1e3a4a;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;'>"
    + "<div style='font-family:monospace;font-size:10px;letter-spacing:4px;color:#38bdf8;margin-bottom:6px;'>AXIOM MARKET INTELLIGENCE</div>"
    + "<h1 style='margin:0 0 6px;font-size:20px;color:#e2e8f0;'>Pre-Market Briefing</h1>"
    + "<div style='font-family:monospace;font-size:11px;color:#475569;'>" + TODAY + "</div>"
    + "<div style='margin-top:10px;'>" + tickers + "</div>"
    + "</div>"

    + sectionBlock("🌐", "MARKET PULSE",   parseSection(briefing, "MARKET_PULSE"),  "#38bdf8")
    + sectionBlock("🎯", "OPPORTUNITIES",  parseSection(briefing, "OPPORTUNITIES"), "#34d399")
    + sectionBlock("🔍", "WATCHLIST",      parseSection(briefing, "WATCHLIST"),     "#f472b6")

    + "<div style='border-radius:10px;border:2px solid #fde68a33;margin-bottom:24px;overflow:hidden;'>"
    + "<div style='background:#fde68a12;padding:12px 16px;border-bottom:1px solid #fde68a22;'>"
    + "<span style='font-family:monospace;font-weight:700;color:#fde68a;font-size:13px;'>🏆 AXIOM BEST CALL TODAY</span>"
    + "</div>"
    + "<div style='padding:16px;background:#0f172a;color:#e2e8f0;font-size:13px;line-height:1.9;border-left:4px solid #fde68a;'>"
    + parseSection(briefing, "AXIOM_CALL").replace(/\n/g, "<br/>")
    + "</div></div>"

    + "<div style='text-align:center;font-family:monospace;font-size:10px;color:#334155;padding:12px;'>"
    + "FOR INFORMATIONAL USE ONLY - NOT FINANCIAL ADVICE"
    + "</div>"
    + "</div></body></html>";
}

async function sendEmail(html) {
  console.log("Gmail user:", process.env.GMAIL_USER ? "loaded" : "MISSING");
  console.log("App password:", process.env.GMAIL_APP_PASSWORD ? "loaded" : "MISSING");
  console.log("To email:", process.env.TO_EMAIL ? "loaded" : "MISSING");

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
  console.log("Email sent!");
}

async function main() {
  try {
    console.log("AXIOM starting for " + TODAY);
    const briefing = await getBriefing();
    console.log("Briefing done, building email...");
    const html = buildEmail(briefing);
    await sendEmail(html);
    console.log("Done!");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
