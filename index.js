require("dotenv").config(); // Load environment variables from .env file
const { Telegraf } = require("telegraf");
const express = require("express");
const { v4: uuidv4 } = require("uuid"); // For generating unique IDs
const admin = require("firebase-admin"); // Firebase Admin SDK

// Initialize Express app
const app = express();

// Initialize Firebase using environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail:
      process.env.FIREBASE_CLIENT_EMAIL ||
      `firebase-adminsdk-htxr6@${process.env.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
    privateKey: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
      : undefined,
  }),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
});
const db = admin.firestore();

// Initialize Telegram Bot with token from environment variables
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Function to generate a long, secure login code
const generateLoginCode = () => {
  // Combine UUID with random string for length and uniqueness
  const uuid = uuidv4().replace(/-/g, ""); // Remove dashes from UUID
  const randomString = Math.random().toString(36).substring(2, 15); // Random alphanumeric
  return `${uuid}${randomString}`.toUpperCase(); // Combine and uppercase (e.g., 32 + 13 = 45 chars)
};

// Command handler for /start
bot.command("start", async (ctx) => {
  const telegramId = ctx.from.id.toString(); // Get user's Telegram ID

  // Generate a long login code
  const loginCode = generateLoginCode();

  // Set expiration time (e.g., 10 minutes from now)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    // Store the login code in Firestore
    await db.collection("login_codes").doc(loginCode).set({
      telegramId: telegramId,
      code: loginCode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
      used: false,
    });

    // Send the code to the user with a "Copy Code" button
    await ctx.reply(
      `🔑 *Here's your login code:*\n\n` +
        `\`\`\`\n${loginCode}\n\`\`\`\n\n` +
        `Enter this code on the website to log in. It expires in 10 minutes.`,
      {
        parse_mode: "Markdown",
      }
    );
  } catch (error) {
    console.error("Error generating login code:", error);
    await ctx.reply("Something went wrong. Please try again later.");
  }
});

// Set up the webhook for Vercel deployment
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || "https://naija-login-bot.vercel.app/";

// Use webhook in production (Vercel), polling in development
if (process.env.NODE_ENV === "production") {
  bot
    .launch({
      webhook: {
        domain: DOMAIN,
        port: PORT,
      },
    })
    .then(() => {
      console.log(`Bot is running in webhook mode on ${DOMAIN}`);
    })
    .catch((err) => {
      console.error("Failed to launch bot in webhook mode:", err);
    });
} else {
  // Use polling for local development
  bot
    .launch()
    .then(() => {
      console.log("Bot is running in polling mode...");
    })
    .catch((err) => {
      console.error("Failed to launch bot in polling mode:", err);
    });
}

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// Export the Express app for Vercel
module.exports = app;
