// api/webhook.js - This will be your serverless function endpoint
require("dotenv").config();
const { Telegraf } = require("telegraf");
const { v4: uuidv4 } = require("uuid");
const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
} = require("firebase/firestore");

// Firebase Client SDK Configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// Initialize Telegram Bot with webhook response
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Function to generate login code
const generateLoginCode = () => {
  const uuid = uuidv4().replace(/-/g, "");
  const randomString = Math.random().toString(36).substring(2, 15);
  return `${uuid}${randomString}`.toUpperCase();
};

// Command handler for /start
bot.command("start", async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const loginCode = generateLoginCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    // Store the login code in Firestore using client SDK
    await setDoc(doc(db, "login_codes", loginCode), {
      telegramId: telegramId,
      code: loginCode,
      createdAt: serverTimestamp(),
      expiresAt: expiresAt,
      used: false,
    });

    await ctx.reply(
      `🔑 *Here's your login code:*\n\n` +
        `\`\`\`\n${loginCode}\n\`\`\`\n\n` +
        `Enter this code on the website to log in. It expires in 10 minutes.`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Error generating login code:", error);
    await ctx.reply("Something went wrong. Please try again later.");
  }
});

// Export the handler function for Vercel
module.exports = async (req, res) => {
  try {
    // Process the update from Telegram
    if (req.method === "POST") {
      await bot.handleUpdate(req.body);
    }

    // Return a success response
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).send("Internal Server Error");
  }
};
