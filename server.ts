import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import fs from "fs";
import { Client, GatewayIntentBits } from "discord.js";

import { initializeApp as initializeClientApp } from "firebase/app";
import { getFirestore as getClientFirestore, collection as clientCollection, doc as clientDoc, setDoc as clientSetDoc, getCountFromServer, getDocs } from "firebase/firestore";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin for backend use
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let db: any = null;
let clientDb: any = null;
let firebaseConfig: any = null;
let discordClient: Client | null = null;

function initFirebase() {
  if (fs.existsSync(firebaseConfigPath)) {
    try {
      firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
      
      console.log("Ambient Project ID (process.env.GOOGLE_CLOUD_PROJECT):", process.env.GOOGLE_CLOUD_PROJECT);
      
      if (getApps().length === 0) {
        console.log("Initializing Firebase Admin with projectId:", firebaseConfig.projectId);
        try {
          // Try with applicationDefault first
          initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: firebaseConfig.projectId,
          });
        } catch (credError) {
          console.log("applicationDefault() failed, trying simple initialization:", credError);
          // Fallback to simple initialization (works in some GCP environments)
          initializeApp({
            projectId: firebaseConfig.projectId,
          });
        }
      }
      
      const adminApp = getApp();
      console.log("Firebase Admin App initialized for project:", firebaseConfig.projectId);
      
      // Use the specific database ID if provided
      try {
        const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
          ? firebaseConfig.firestoreDatabaseId 
          : undefined;
        
        console.log("Initializing Firestore with Database ID:", dbId || "(default)");
        db = getFirestore(adminApp, dbId);
        
        // Test connection with a simple get
        db.collection("health_check").limit(1).get()
          .then(() => console.log("Firestore Admin connection test successful"))
          .catch((err: any) => {
            if (!err.message.includes("PERMISSION_DENIED")) {
              console.error("Firestore Admin connection test failed:", err.message);
            } else {
              console.log("Firestore Admin connection test: Permission denied (expected in some environments, using Client SDK fallback)");
            }
          });
          
        // Initialize Client SDK as well (for fallback/testing)
        const clientApp = initializeClientApp(firebaseConfig);
        clientDb = getClientFirestore(clientApp, dbId);
        console.log("Firebase Client SDK initialized with Database ID:", dbId || "(default)");

      } catch (dbError) {
        console.error("Firestore DB Init Error:", dbError);
      }
    } catch (error) {
      console.error("Firebase Admin Init Error:", error);
    }
  } else {
    console.error("Firebase config file not found at:", firebaseConfigPath);
  }
}

// Call initialization immediately
initFirebase();

async function startServer() {
  console.log("Starting server initialization...");
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Add a simple ping endpoint to verify basic connectivity
  app.get("/api/ping", (req, res) => {
    console.log("Ping request received");
    res.send("pong");
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    console.log("Health check request received");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Routes
  app.get("/api/stats", async (req, res) => {
    console.log("Stats request received at /api/stats");
    
    // Ensure Firebase is initialized
    if (!db && !clientDb) {
      console.log("Firebase not initialized in stats route, attempting init...");
      initFirebase();
    }

    try {
      let serverCount = 0;
      let userCount = 0;
      let error: any = null;

      // Try Admin SDK first (usually faster on backend)
      if (db) {
        try {
          console.log("Attempting stats fetch via Admin SDK...");
          const guildSnapshot = await db.collection("guilds").count().get();
          serverCount = guildSnapshot.data().count;

          const userSnapshot = await db.collection("users").count().get();
          userCount = userSnapshot.data().count;

          console.log("Stats fetch via Admin SDK successful");
          return res.json({
            servers: 12400 + serverCount,
            users: 3200000 + userCount,
            uptime: 99.9,
            source: "admin"
          });
        } catch (adminError: any) {
          // Suppress log for permission denied as we have a client-side fallback
          if (!adminError.message.includes("PERMISSION_DENIED")) {
            console.error("Firestore Admin Stats Error:", adminError.message);
          } else {
            console.log("Firestore Admin Stats: Permission denied (expected, falling back to Client SDK)");
          }
          error = { admin: adminError.message };
        }
      }

      // Try Client SDK as fallback
      if (clientDb) {
        try {
          console.log("Attempting stats fetch via Client SDK fallback...");
          const guildColl = clientCollection(clientDb, "guilds");
          const guildCountRes = await getCountFromServer(guildColl);
          serverCount = guildCountRes.data().count;

          const userColl = clientCollection(clientDb, "users");
          const userCountRes = await getCountFromServer(userColl);
          userCount = userCountRes.data().count;

          console.log("Stats fetch via Client SDK successful (fallback)");
          return res.json({
            servers: 12400 + serverCount,
            users: 3200000 + userCount,
            uptime: 99.9,
            source: "client"
          });
        } catch (clientError: any) {
          console.error("Firestore Client Stats Error (fallback):", clientError.message);
          error = { ...error, client: clientError.message };
        }
      }

      console.log("Stats fetch failed or database not initialized, returning default values");
      // Default response if both fail or not initialized
      res.json({
        servers: 12400,
        users: 3200000,
        uptime: 99.9,
        error: error || "Database not initialized",
        env: {
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
          configProjectId: firebaseConfig?.projectId,
          databaseId: firebaseConfig?.firestoreDatabaseId
        }
      });
    } catch (globalError: any) {
      console.error("CRITICAL: Global Stats Route Error:", globalError.message);
      res.status(500).json({ 
        error: "Internal Server Error", 
        message: globalError.message,
        stack: process.env.NODE_ENV === 'development' ? globalError.stack : undefined
      });
    }
  });

  // Discord OAuth Config
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1483873213711646840";
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  
  // Robust APP_URL handling
  let APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
  if (APP_URL.endsWith('/')) {
    APP_URL = APP_URL.slice(0, -1);
  }
  
  const REDIRECT_URI = `${APP_URL}/api/auth/discord/callback`;
  const LOGIN_REDIRECT_URI = `${APP_URL}/api/auth/discord/login-callback`;

  // API Routes
  app.get("/api/auth/discord/url", (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds&prompt=consent`;
    res.json({ url });
  });

  app.get("/api/auth/discord/login-url", (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(LOGIN_REDIRECT_URI)}&response_type=code&scope=identify%20email&prompt=consent`;
    res.json({ url });
  });

  app.post("/api/auth/discord/refresh", async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: "Missing refresh token" });
    }

    if (!CLIENT_SECRET) {
      return res.status(500).json({ error: "DISCORD_CLIENT_SECRET is not configured" });
    }

    try {
      const tokenResponse = await axios.post(
        "https://discord.com/api/oauth2/token",
        new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: refresh_token,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      res.json(tokenResponse.data);
    } catch (error: any) {
      console.error("Discord Refresh Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to refresh token" });
    }
  });

  app.get("/api/auth/discord/login-callback", async (req, res) => {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Missing code");
    }

    if (!CLIENT_SECRET) {
      return res.status(500).send("DISCORD_CLIENT_SECRET is not configured in environment variables.");
    }

    try {
      const tokenResponse = await axios.post(
        "https://discord.com/api/oauth2/token",
        new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "authorization_code",
          code: code.toString(),
          redirect_uri: LOGIN_REDIRECT_URI,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const { access_token } = tokenResponse.data;

      // Fetch user info to get Discord ID and details
      const userResponse = await axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const discordUser = userResponse.data;
      const discordId = discordUser.id;
      const email = discordUser.email;
      const username = discordUser.username;
      const avatar = discordUser.avatar 
        ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId) % 5}.png`;

      // Firebase Custom Token Flow
      const uid = `discord:${discordId}`;
      
      // Ensure Firebase is initialized before creating token
      if (getApps().length === 0) {
        console.log("Firebase not initialized in callback, re-initializing...");
        initFirebase();
      }

      if (getApps().length === 0) {
        throw new Error("Failed to initialize Firebase Admin SDK. Please check your configuration.");
      }
      
      // Create custom token
      let customToken;
      try {
        const adminAuth = getAdminAuth();
        customToken = await adminAuth.createCustomToken(uid, {
          discordId,
          username
        });
      } catch (tokenError: any) {
        console.error("Firebase Custom Token Error:", tokenError);
        
        // Try to discover the service account email to help the user
        let discoveredServiceAccount = "Loading...";
        try {
          const { GoogleAuth } = await import("google-auth-library");
          const auth = new GoogleAuth();
          const client = await auth.getClient();
          if ("email" in client) {
            discoveredServiceAccount = (client as any).email;
          } else {
            // Fallback for some environments
            const credentials = await auth.getCredentials();
            discoveredServiceAccount = credentials.client_email || "Could not detect automatically";
          }
        } catch (discoveryError) {
          discoveredServiceAccount = "Error detecting service account";
        }

        // Handle specific IAM Credentials API error
        if (tokenError.message && (tokenError.message.includes("IAM Service Account Credentials API") || tokenError.message.includes("permission denied"))) {
          const projectId = firebaseConfig?.projectId || "595398196627";
          return res.status(500).send(`
            <html>
              <body style="font-family: sans-serif; padding: 2rem; line-height: 1.5; background: #0f172a; color: #f8fafc;">
                <h1 style="color: #ef4444;">Discord Login Error: Permission Denied</h1>
                <p>To use Discord login, your app's service account needs permission to create secure tokens.</p>
                
                <div style="background: #1e293b; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; border: 1px solid #334155;">
                  <p><strong>Step 1:</strong> Identify your Service Account Email:</p>
                  <p style="background: #0f172a; padding: 0.5rem; border-radius: 0.25rem; font-family: monospace; color: #38bdf8;">
                    ${discoveredServiceAccount}
                  </p>
                  <p><small>(Copy this email address for the next step)</small></p>
                </div>

                <div style="background: #1e293b; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; border: 1px solid #334155;">
                  <p><strong>Step 2:</strong> Grant the <strong>Service Account Token Creator</strong> role:</p>
                  <ol>
                    <li>Go to <a href="https://console.cloud.google.com/iam-admin/iam?project=${projectId}" target="_blank" style="color: #38bdf8;">IAM Settings</a></li>
                    <li>Click <strong>GRANT ACCESS</strong> (at the top)</li>
                    <li>In <strong>New principals</strong>, paste the email address from Step 1</li>
                    <li>In <strong>Select a role</strong>, search for and select: <strong>Service Account Token Creator</strong></li>
                    <li>Click <strong>Save</strong></li>
                  </ol>
                </div>

                <div style="background: #1e293b; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; border: 1px solid #334155;">
                  <p><strong>Step 3:</strong> Verify API is Enabled:</p>
                  <a href="https://console.developers.google.com/apis/api/iamcredentials.googleapis.com/overview?project=${projectId}" 
                     target="_blank" 
                     style="color: #38bdf8; word-break: break-all;">
                    Check IAM Credentials API Status
                  </a>
                </div>

                <p>After granting the role, please wait 2-3 minutes, then try logging in again.</p>
                <button onclick="window.close()" style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer;">Close Window</button>
              </body>
            </html>
          `);
        }
        
        return res.status(500).send(`Discord Login Error: ${tokenError.message}`);
      }

      // Send success message to parent window and close popup
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'DISCORD_LOGIN_SUCCESS', 
                  customToken: '${customToken}',
                  userData: {
                    uid: '${uid}',
                    discordId: '${discordId}',
                    email: '${email || `${username}@discord.com`}',
                    displayName: '${username}',
                    photoURL: '${avatar}'
                  }
                }, '*');
                window.close();
              } else {
                window.location.href = '/dashboard';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error("Discord Login Error:", errorData);
      
      let errorMessage = JSON.stringify(errorData);
      let showIamInstructions = false;
      
      if (errorMessage.includes("iamcredentials.googleapis.com")) {
        showIamInstructions = true;
      }
      
      res.status(500).send(`
        <html>
          <head>
            <style>
              body { font-family: sans-serif; padding: 2rem; line-height: 1.5; background: #0a0a0a; color: white; }
              .card { background: #1a1a1a; border: 1px solid #333; padding: 2rem; border-radius: 1rem; max-width: 650px; margin: 0 auto; }
              h1 { color: #ff4444; margin-top: 0; }
              code { background: #000; padding: 0.2rem 0.4rem; border-radius: 0.3rem; font-family: monospace; color: #ff8888; word-break: break-all; }
              .btn { display: inline-block; background: #5865F2; color: white; padding: 0.8rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: bold; margin-top: 1rem; }
              .btn:hover { background: #4752C4; }
              .instruction { background: #222; border-left: 4px solid #5865F2; padding: 1.5rem; margin: 1.5rem 0; border-radius: 0 0.5rem 0.5rem 0; }
              ol { padding-left: 1.2rem; }
              li { margin-bottom: 0.8rem; }
              .step-title { font-weight: bold; color: #5865F2; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Discord Login Error</h1>
              <p>Error details: <code>${errorMessage}</code></p>
              
              ${showIamInstructions ? `
                <div class="instruction">
                  <h3>🛠 Action Required: Fix IAM Permissions</h3>
                  <p>This error happens because your Google Cloud project needs permission to create secure login tokens.</p>
                  
                  <ol>
                    <li>
                      <span class="step-title">Step 1: Enable the API</span><br/>
                      If you haven't already, click "Enable" here: 
                      <a href="https://console.developers.google.com/apis/api/iamcredentials.googleapis.com/overview?project=595398196627" target="_blank" style="color: #5865F2;">Enable API</a>
                    </li>
                    <li>
                      <span class="step-title">Step 2: Grant the "Token Creator" Role</span><br/>
                      Go to <a href="https://console.cloud.google.com/iam-admin/iam?project=595398196627" target="_blank" style="color: #5865F2;">IAM Settings</a>. 
                      Find the service account <code>595398196627-compute@developer.gserviceaccount.com</code>, click the edit icon, and add the role: <b>Service Account Token Creator</b>.
                    </li>
                    <li>
                      <span class="step-title">Step 3: Wait & Retry</span><br/>
                      Wait 5 minutes for Google to update, then try logging in again.
                    </li>
                  </ol>
                  
                  <a href="https://console.cloud.google.com/iam-admin/iam?project=595398196627" target="_blank" class="btn">Go to IAM Settings</a>
                </div>
              ` : `
                <p>Please check your Discord Developer Portal settings and environment variables.</p>
              `}
              
              <button onclick="window.close()" style="background: transparent; border: 1px solid #444; color: #888; padding: 0.5rem 1rem; border-radius: 0.4rem; cursor: pointer; margin-top: 1rem;">Close Window</button>
            </div>
          </body>
        </html>
      `);
    }
  });

  app.get("/api/auth/discord/callback", async (req, res) => {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Missing code");
    }

    if (!CLIENT_SECRET) {
      return res.status(500).send("DISCORD_CLIENT_SECRET is not configured in environment variables.");
    }

    try {
      const tokenResponse = await axios.post(
        "https://discord.com/api/oauth2/token",
        new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "authorization_code",
          code: code.toString(),
          redirect_uri: REDIRECT_URI,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      // Fetch user info to get Discord ID
      const userResponse = await axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const discordId = userResponse.data.id;

      // Send success message to parent window and close popup
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'DISCORD_AUTH_SUCCESS', 
                  accessToken: '${access_token}',
                  refreshToken: '${refresh_token}',
                  expiresIn: ${expires_in},
                  discordId: '${discordId}'
                }, '*');
                window.close();
              } else {
                window.location.href = '/dashboard';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("Discord OAuth Error:", error.response?.data || error.message);
      res.status(500).send("Failed to exchange code for token");
    }
  });

  // Helper for Discord API calls with retry logic for rate limits
  const discordApiCall = async (url: string, headers: any, retries = 3): Promise<any> => {
    try {
      return await axios.get(url, { headers });
    } catch (error: any) {
      if (error.response?.status === 429 && retries > 0) {
        const retryAfter = (error.response.data.retry_after || 1) * 1000;
        console.log(`Discord Rate Limited. Retrying after ${retryAfter}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        return discordApiCall(url, headers, retries - 1);
      }
      throw error;
    }
  };

  app.get("/api/discord/guilds", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    try {
      const guildsResponse = await discordApiCall("https://discord.com/api/users/@me/guilds", {
        Authorization: authHeader,
      });

      // Get guilds the bot is already in
      let botGuildIds = new Set<string>();
      
      // 1. Check Discord Client Cache (Most reliable for current status)
      if (discordClient && discordClient.isReady()) {
        discordClient.guilds.cache.forEach(guild => botGuildIds.add(guild.id));
        console.log(`Bot is currently in ${botGuildIds.size} guilds (from cache)`);
      }

      // 2. Fallback/Supplement with Firestore
      let fsSuccess = false;
      if (db) {
        try {
          const botGuildsSnapshot = await db.collection("guilds").get();
          botGuildsSnapshot.docs.forEach((doc: any) => {
            if (doc.data().active !== false) {
              botGuildIds.add(doc.id);
            }
          });
          fsSuccess = true;
        } catch (fsError: any) {
          if (!fsError.message?.includes("PERMISSION_DENIED")) {
            console.error("Firestore Admin Guilds Fetch Error:", fsError);
          }
        }
      }

      if (!fsSuccess && clientDb) {
        try {
          const guildsColl = clientCollection(clientDb, "guilds");
          const botGuildsSnapshot = await getDocs(guildsColl);
          botGuildsSnapshot.docs.forEach((doc) => {
            if (doc.data().active !== false) {
              botGuildIds.add(doc.id);
            }
          });
          fsSuccess = true;
        } catch (clientFsError) {
          console.error("Firestore Client Guilds Fetch Error:", clientFsError);
        }
      }

      // Filter guilds where user has MANAGE_GUILD permission (0x20)
      // and add hasBot flag
      const manageableGuilds = guildsResponse.data
        .filter((guild: any) => {
          const permissions = BigInt(guild.permissions);
          return (permissions & BigInt(0x20)) === BigInt(0x20);
        })
        .map((guild: any) => ({
          ...guild,
          hasBot: botGuildIds.has(guild.id)
        }));

      res.json(manageableGuilds);
    } catch (error: any) {
      console.error("Discord API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ 
        error: "Failed to fetch guilds from Discord",
        details: error.response?.data
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

    // Discord Bot Initialization
    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

    if (BOT_TOKEN) {
      discordClient = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
        ],
      });

      const getActiveDb = () => db || clientDb;

      discordClient.on("ready", async () => {
        console.log(`Discord Bot logged in as ${discordClient?.user?.tag}!`);
        
        // Sync current guilds to Firestore on startup
        if (db && discordClient) {
          console.log("Syncing bot guilds to Firestore...");
          const guilds = discordClient.guilds.cache;
          for (const [id, guild] of guilds) {
            try {
              await db.collection("guilds").doc(id).set({
                id: id,
                name: guild.name,
                icon: guild.icon,
                ownerId: guild.ownerId,
                members: guild.memberCount,
                active: true,
                lastSeen: new Date().toISOString()
              }, { merge: true });
            } catch (err) {
              console.error(`Failed to sync guild ${id}:`, err);
            }
          }
          console.log("Guild sync completed.");
        }
      });

      discordClient.on("guildCreate", async (guild) => {
        console.log(`Bot joined new guild: ${guild.name} (${guild.id})`);
        if (db) {
          try {
            await db.collection("guilds").doc(guild.id).set({
              id: guild.id,
              name: guild.name,
              icon: guild.icon,
              ownerId: guild.ownerId,
              members: guild.memberCount,
              active: true,
              joinedAt: new Date().toISOString()
            }, { merge: true });
          } catch (error) {
            console.error("Error saving guild to Firestore:", error);
          }
        }
      });

      discordClient.on("guildDelete", async (guild) => {
        console.log(`Bot left guild: ${guild.name} (${guild.id})`);
        if (db) {
          try {
            await db.collection("guilds").doc(guild.id).set({
              active: false,
              leftAt: new Date().toISOString()
            }, { merge: true });
          } catch (error) {
            console.error("Error updating guild in Firestore:", error);
          }
        }
      });

      discordClient.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        
        // Simple command handler
        if (message.content.toLowerCase() === "!ping") {
          message.reply("Pong! 🏓");
        }
        
        if (message.content.toLowerCase() === "!stats") {
          const activeDb = getActiveDb();
          if (activeDb) {
            try {
              let gCount = 0;
              let uCount = 0;
              if (activeDb === clientDb) {
                const gColl = clientCollection(clientDb, "guilds");
                const uColl = clientCollection(clientDb, "users");
                const gRes = await getCountFromServer(gColl);
                const uRes = await getCountFromServer(uColl);
                gCount = gRes.data().count;
                uCount = uRes.data().count;
              } else {
                const gSnap = await db.collection("guilds").count().get();
                const uSnap = await db.collection("users").count().get();
                gCount = gSnap.data().count;
                uCount = uSnap.data().count;
              }
              message.reply(`Arvid Stats:\nServers: ${gCount}\nUsers: ${uCount}`);
            } catch (err) {
              console.error("Bot Stats Error:", err);
              message.reply("Failed to fetch stats from database.");
            }
          }
        }
      });

      discordClient.login(BOT_TOKEN).catch(err => {
        console.error("Discord Bot Login Error:", err);
      });
    } else {
      console.warn("DISCORD_BOT_TOKEN is not configured. Bot will not start.");
    }
}

startServer().catch(err => {
  console.error("CRITICAL: Failed to start server:", err);
});
