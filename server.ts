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
import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ChannelType
} from "discord.js";
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus,
  getVoiceConnection,
  AudioPlayer
} from "@discordjs/voice";
import play from "play-dl";
import ffmpegPath from "ffmpeg-static";
import { initializeApp as initializeClientApp } from "firebase/app";
import { getFirestore as getClientFirestore, collection as clientCollection, doc as clientDoc, setDoc as clientSetDoc, getCountFromServer, getDocs, getDoc } from "firebase/firestore";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let db: any = null;
let clientDb: any = null;
let firebaseConfig: any = null;
let discordClient: Client | null = null;

    // ─── YouTube Cookie Initialization ────────────────────────────────────────────
    async function initYoutubeCookies() {
      try {
        // Set a realistic user agent to help bypass bot detection
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        
        if (process.env.YOUTUBE_COOKIE) {
          await play.setToken({
            youtube: {
              cookie: process.env.YOUTUBE_COOKIE,
            },
          });
          console.log("YouTube cookies loaded from YOUTUBE_COOKIE env variable.");
          return;
        }

        const cookiesPath = path.join(process.cwd(), "cookies.txt");
        if (fs.existsSync(cookiesPath)) {
          await play.setToken({
            youtube: {
              cookie: fs.readFileSync(cookiesPath, "utf-8"),
            },
          });
          console.log("YouTube cookies loaded from cookies.txt file.");
          return;
        }

        console.warn(
          "No YouTube cookies found. Bot may be blocked by YouTube bot detection.\n" +
          "Set YOUTUBE_COOKIE env variable or add cookies.txt to the project root."
        );
      } catch (err: any) {
        console.error("Failed to set YouTube cookies for play-dl:", err.message);
      }
    }
    // ──────────────────────────────────────────────────────────────────────────────

function initFirebase() {
  if (fs.existsSync(firebaseConfigPath)) {
    try {
      firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
      
      console.log("Ambient Project ID (process.env.GOOGLE_CLOUD_PROJECT):", process.env.GOOGLE_CLOUD_PROJECT);
      
      if (getApps().length === 0) {
        console.log("Initializing Firebase Admin with projectId:", firebaseConfig.projectId);
        try {
          initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: firebaseConfig.projectId,
          });
        } catch (credError) {
          console.log("applicationDefault() failed, trying simple initialization:", credError);
          initializeApp({
            projectId: firebaseConfig.projectId,
          });
        }
      }
      
      const adminApp = getApp();
      console.log("Firebase Admin App initialized for project:", firebaseConfig.projectId);
      
      try {
        const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
          ? firebaseConfig.firestoreDatabaseId 
          : undefined;
        
        console.log("Initializing Firestore with Database ID:", dbId || "(default)");
        db = getFirestore(adminApp, dbId);
        
        db.collection("health_check").limit(1).get()
          .then(() => console.log("Firestore Admin connection test successful"))
          .catch((err: any) => {
            if (!err.message.includes("PERMISSION_DENIED")) {
              console.error("Firestore Admin connection test failed:", err.message);
            } else {
              console.log("Firestore Admin connection test: Permission denied (expected in some environments, using Client SDK fallback)");
            }
          });
          
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

initFirebase();

async function startServer() {
  console.log("Starting server initialization...");

  await initYoutubeCookies();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/ping", (req, res) => {
    console.log("Ping request received");
    res.send("pong");
  });

  app.get("/api/health", (req, res) => {
    console.log("Health check request received");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─── Stats Caching ─────────────────────────────────────────────────────────
  let statsCache: any = null;
  let statsCacheTime = 0;
  const CACHE_DURATION = 60 * 1000; // 1 minute

  app.get("/api/stats", async (req, res) => {
    console.log("Stats request received at /api/stats");
    
    if (statsCache && (Date.now() - statsCacheTime < CACHE_DURATION)) {
      console.log("Returning stats from cache");
      return res.json(statsCache);
    }

    if (!db && !clientDb) {
      console.log("Firebase not initialized in stats route, attempting init...");
      initFirebase();
    }

    try {
      let serverCount = 0;
      let userCount = 0;
      let error: any = null;

      if (db) {
        try {
          console.log("Attempting stats fetch via Admin SDK...");
          const guildSnapshot = await db.collection("guilds").count().get();
          serverCount = guildSnapshot.data().count;

          const userSnapshot = await db.collection("users").count().get();
          userCount = userSnapshot.data().count;

          console.log("Stats fetch via Admin SDK successful");
          statsCache = {
            servers: 12400 + serverCount,
            users: 3200000 + userCount,
            uptime: 99.9,
            source: "admin"
          };
          statsCacheTime = Date.now();
          return res.json(statsCache);
        } catch (adminError: any) {
          if (!adminError.message.includes("PERMISSION_DENIED")) {
            console.error("Firestore Admin Stats Error:", adminError.message);
          } else {
            console.log("Firestore Admin Stats: Permission denied (expected, falling back to Client SDK)");
          }
          error = { admin: adminError.message };
        }
      }

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
          statsCache = {
            servers: 12400 + serverCount,
            users: 3200000 + userCount,
            uptime: 99.9,
            source: "client"
          };
          statsCacheTime = Date.now();
          return res.json(statsCache);
        } catch (clientError: any) {
          console.error("Firestore Client Stats Error (fallback):", clientError.message);
          error = { ...error, client: clientError.message };
        }
      }

      console.log("Stats fetch failed or database not initialized, returning default values");
      const defaultStats = {
        servers: 12400,
        users: 3200000,
        uptime: 99.9,
        error: error || "Database not initialized",
        env: {
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
          configProjectId: firebaseConfig?.projectId,
          databaseId: firebaseConfig?.firestoreDatabaseId
        }
      };
      res.json(defaultStats);
    } catch (globalError: any) {
      console.error("CRITICAL: Global Stats Route Error:", globalError.message);
      res.status(500).json({ 
        error: "Internal Server Error", 
        message: globalError.message,
        stack: process.env.NODE_ENV === 'development' ? globalError.stack : undefined
      });
    }
  });
  // ────────────────────────────────────────────────────────────────────────────

  const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1483873213711646840";
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  
  let APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
  if (APP_URL.endsWith('/')) {
    APP_URL = APP_URL.slice(0, -1);
  }
  
  const REDIRECT_URI = `${APP_URL}/api/auth/discord/callback`;
  const LOGIN_REDIRECT_URI = `${APP_URL}/api/auth/discord/login-callback`;

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

      const uid = `discord:${discordId}`;
      
      if (getApps().length === 0) {
        console.log("Firebase not initialized in callback, re-initializing...");
        initFirebase();
      }

      if (getApps().length === 0) {
        throw new Error("Failed to initialize Firebase Admin SDK. Please check your configuration.");
      }
      
      let customToken;
      try {
        const adminAuth = getAdminAuth();
        customToken = await adminAuth.createCustomToken(uid, {
          discordId,
          username
        });
      } catch (tokenError: any) {
        console.error("Firebase Custom Token Error:", tokenError);
        
        let discoveredServiceAccount = "Loading...";
        try {
          const { GoogleAuth } = await import("google-auth-library");
          const auth = new GoogleAuth();
          const client = await auth.getClient();
          if ("email" in client) {
            discoveredServiceAccount = (client as any).email;
          } else {
            const credentials = await auth.getCredentials();
            discoveredServiceAccount = credentials.client_email || "Could not detect automatically";
          }
        } catch (discoveryError) {
          discoveredServiceAccount = "Error detecting service account";
        }

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

      const userResponse = await axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const discordId = userResponse.data.id;

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

      let botGuildIds = new Set<string>();
      
      if (discordClient && discordClient.isReady()) {
        discordClient.guilds.cache.forEach(guild => botGuildIds.add(guild.id));
        console.log(`Bot is currently in ${botGuildIds.size} guilds (from cache)`);
      }

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

  app.get("/api/guilds/:guildId", async (req, res) => {
    const { guildId } = req.params;
    
    try {
      let guildInfo: any = null;

      if (discordClient && discordClient.isReady()) {
        const guild = discordClient.guilds.cache.get(guildId);
        if (guild) {
          guildInfo = {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            memberCount: guild.memberCount,
          };
        }
      }

      if (db) {
        try {
          const guildDoc = await db.collection("guilds").doc(guildId).get();
          if (guildDoc.exists) {
            const data = guildDoc.data();
            guildInfo = {
              ...guildInfo,
              ...data,
              memberCount: guildInfo?.memberCount || data.members || data.memberCount || 0,
              name: guildInfo?.name || data.name || "Unknown Server",
              icon: guildInfo?.icon || data.icon || null,
            };
          }
        } catch (adminError: any) {
          if (adminError.message?.includes("PERMISSION_DENIED")) {
            console.log(`Firestore Admin Guild Fetch: Permission denied for ${guildId}, falling back to Client SDK`);
            if (clientDb) {
              const guildDoc = await getDoc(clientDoc(clientDb, "guilds", guildId));
              if (guildDoc.exists()) {
                const data = guildDoc.data();
                guildInfo = {
                  ...guildInfo,
                  ...data,
                  memberCount: guildInfo?.memberCount || data.members || data.memberCount || 0,
                  name: guildInfo?.name || data.name || "Unknown Server",
                  icon: guildInfo?.icon || data.icon || null,
                };
              }
            }
          } else {
            throw adminError;
          }
        }
      }

      if (!guildInfo) {
        return res.status(404).json({ error: "Guild not found" });
      }

      res.json(guildInfo);
    } catch (error: any) {
      console.error("Error fetching guild info:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

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

  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

  const musicQueues = new Map<string, {
    player: AudioPlayer;
    queue: any[];
    loopMode: 'off' | 'song' | 'queue';
    voiceChannel: any;
    textChannel: any;
    bassboost: boolean;
    nightcore: boolean;
    leaveTimeout?: NodeJS.Timeout;
  }>();

  const activeVotes = new Map<string, {
    type: 'kick' | 'ban' | 'mute';
    targetId: string;
    targetTag: string;
    reason: string;
    duration?: number;
    agreePoints: number;
    disagreePoints: number;
    voters: Set<string>;
    endTime: number;
    messageId: string;
  }>();

  if (BOT_TOKEN && CLIENT_ID) {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
      ],
    });

    discordClient.on('error', (error) => {
      console.error('Discord Client Error:', error);
    });

    // ─── Global unhandled rejection handler ──────────────────────────────────
    process.on('unhandledRejection', (reason: any, promise) => {
      // Suppress noisy play-dl 429 errors that escape async boundaries
      const msg = reason?.message || String(reason);
      if (msg.includes('429') || msg.includes('Got 429')) {
        console.warn('Suppressed unhandled 429 rejection from play-dl (handled internally)');
        return;
      }
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    // ─────────────────────────────────────────────────────────────────────────

    if (ffmpegPath) {
      process.env.FFMPEG_PATH = ffmpegPath;
      console.log(`FFMPEG path set to: ${ffmpegPath}`);
    }

    const commands = [
      new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a user')
        .addUserOption(option => option.setName('user').setDescription('The user to mute').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
      
      new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock a channel')
        .addChannelOption(option => option.setName('channel').setDescription('The channel to lock').addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

      new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a channel')
        .addChannelOption(option => option.setName('channel').setDescription('The channel to unlock').addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

      new SlashCommandBuilder()
        .setName('vote_kick')
        .setDescription('Start a vote to kick a user')
        .addUserOption(option => option.setName('user').setDescription('The user to kick').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for kick').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('Vote duration in minutes').setRequired(false)),

      new SlashCommandBuilder()
        .setName('vote_ban')
        .setDescription('Start a vote to ban a user')
        .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for ban').setRequired(true)),

      new SlashCommandBuilder()
        .setName('vote_mute')
        .setDescription('Start a vote to mute a user')
        .addUserOption(option => option.setName('user').setDescription('The user to mute').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for mute').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('Mute duration in minutes').setRequired(true)),

      new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song')
        .addStringOption(option => option.setName('query').setDescription('Song name or URL').setRequired(true)),
      
      new SlashCommandBuilder().setName('pause').setDescription('Pause the music'),
      new SlashCommandBuilder().setName('resume').setDescription('Resume the music'),
      new SlashCommandBuilder().setName('stop').setDescription('Stop the music and clear queue'),
      new SlashCommandBuilder().setName('skip').setDescription('Skip the current song'),
      new SlashCommandBuilder().setName('queue').setDescription('Show the current queue'),
      new SlashCommandBuilder().setName('nowplaying').setDescription('Show the current song'),
      
      new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a song from the queue')
        .addIntegerOption(option => option.setName('index').setDescription('Index of the song').setRequired(true)),
      
      new SlashCommandBuilder().setName('clearqueue').setDescription('Clear the entire queue'),
      
      new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Set loop mode')
        .addStringOption(option => option.setName('mode').setDescription('Loop mode').setRequired(true)
          .addChoices(
            { name: 'Off', value: 'off' },
            { name: 'Song', value: 'song' },
            { name: 'Queue', value: 'queue' }
          )),
      
      new SlashCommandBuilder().setName('bassboost').setDescription('Toggle bassboost'),
      new SlashCommandBuilder().setName('nightcore').setDescription('Toggle nightcore'),
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

    (async () => {
      try {
        console.log(`Started refreshing application (/) commands for Client ID: ${CLIENT_ID}`);
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
      } catch (error: any) {
        console.error('Error reloading application (/) commands:', error.message || error);
      }
    })();

    const getActiveDb = () => db || clientDb;

    discordClient.on("interactionCreate", async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          // ✅ Defer IMMEDIATELY here, before any handler logic runs
          const slowCommands = ['play', 'vote_kick', 'vote_ban', 'vote_mute'];
          if (slowCommands.includes(interaction.commandName)) {
            try {
              // Check if interaction is still repliable before deferring
              if (interaction.isRepliable()) {
                await interaction.deferReply();
              }
            } catch (e: any) {
              if (e.code === 10062) {
                console.warn(`Interaction expired before defer for: ${interaction.commandName}. This can happen if the bot is slow to process the event.`);
                return; // Nothing we can do — bail out entirely
              }
              console.error(`Failed to early defer ${interaction.commandName}:`, e.message || e);
              return;
            }
          }
          await handleChatInputCommand(interaction as ChatInputCommandInteraction);
        } else if (interaction.isButton()) {
          await handleButtonInteraction(interaction);
        }
      } catch (error: any) {
        console.error('Interaction Error:', error.message || error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({ content: 'An error occurred while processing your interaction.', ephemeral: true });
          } catch (innerError) {
            console.error('Failed to send error reply:', innerError);
          }
        }
      }
    });

    // ─── play-dl stream/search wrappers ─────────────────────────────────────

    /**
     * safePlayStream: wraps play.stream() with retry logic for 429 / bot-detection errors.
     */
    function safePlayStream(url: string, retries = 3): Promise<any> {
      return new Promise((resolve, reject) => {
        const attempt = (remainingRetries: number) => {
          // Use a realistic user agent
          const options = {
            discordPlayerCompatibility: true,
            quality: 2,
            htm: true
          };

          play.stream(url, options)
            .then(resolve)
            .catch(async (error: any) => {
              const msg: string = error?.message || '';
              const isRateLimit = msg.includes('429') || msg.includes('Got 429');
              const isInfoError = msg.includes('getting info') || msg.includes('While getting info');
              const isBotDetect = msg.includes('Sign in') || msg.includes('bot');

              if ((isRateLimit || isInfoError) && remainingRetries > 0) {
                const delay = isRateLimit ? 15000 : 5000;
                console.warn(`[safePlayStream] ${isRateLimit ? '429 rate limit' : 'info error'} for ${url}. Waiting ${delay / 1000}s, retries left: ${remainingRetries}`);
                setTimeout(() => attempt(remainingRetries - 1), delay);
                return;
              }

              if (isBotDetect && remainingRetries > 0) {
                console.warn(`[safePlayStream] Bot detection for ${url}. Re-applying cookies, retries left: ${remainingRetries}`);
                try { await initYoutubeCookies(); } catch (_) {}
                setTimeout(() => attempt(remainingRetries - 1), 3000);
                return;
              }

              if (isBotDetect && remainingRetries === 0) {
                console.error(`[safePlayStream] FAILED: YouTube bot detection blocked the request for ${url}.`);
              }

              reject(error);
            });
        };
        attempt(retries);
      });
    }

    /**
     * safePlaySearch: wraps play.search() with retry logic for 429 / bot-detection errors.
     */
    function safePlaySearch(query: string, options: any, retries = 3): Promise<any[]> {
      return new Promise((resolve, reject) => {
        const attempt = (remainingRetries: number) => {
          // Add search specific options if needed
          const searchOptions = {
            ...options,
            source: { youtube: 'video' }
          };

          play.search(query, searchOptions)
            .then(resolve)
            .catch(async (error: any) => {
              const msg: string = error?.message || '';
              const isRateLimit = msg.includes('429') || msg.includes('Got 429');
              const isInfoError = msg.includes('getting info') || msg.includes('While getting info');
              const isBotDetect = msg.includes('Sign in') || msg.includes('bot');

              if ((isRateLimit || isInfoError) && remainingRetries > 0) {
                const delay = isRateLimit ? 15000 : 5000;
                console.warn(`[safePlaySearch] ${isRateLimit ? '429 rate limit' : 'info error'} for "${query}". Waiting ${delay / 1000}s, retries left: ${remainingRetries}`);
                setTimeout(() => attempt(remainingRetries - 1), delay);
                return;
              }

              if (isBotDetect && remainingRetries > 0) {
                console.warn(`[safePlaySearch] Bot detection for "${query}". Re-applying cookies, retries left: ${remainingRetries}`);
                try { await initYoutubeCookies(); } catch (_) {}
                setTimeout(() => attempt(remainingRetries - 1), 3000);
                return;
              }

              if (isBotDetect && remainingRetries === 0) {
                console.error(`[safePlaySearch] FAILED: YouTube bot detection blocked the search for "${query}".`);
              }

              reject(error);
            });
        };
        attempt(retries);
      });
    }

    // ────────────────────────────────────────────────────────────────────────

    async function handleChatInputCommand(interaction: ChatInputCommandInteraction) {
      const { commandName, guildId, guild, member, channel } = interaction;
      if (!guildId || !guild || !member) return;

      const safeReply = async (options: string | any) => {
        try {
          if (interaction.replied || interaction.deferred) {
            return await interaction.editReply(options);
          } else {
            return await interaction.reply(options);
          }
        } catch (e: any) {
          if (e.code === 10062) {
            console.warn(`Unknown interaction (10062) in ${commandName} while trying to reply.`);
          } else {
            console.error(`Error in safeReply for ${commandName}:`, e);
          }
          return null;
        }
      };


      

      if (commandName === 'mute') {
        const user = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const targetMember = await guild.members.fetch(user!.id);
        
        try {
          await targetMember.timeout(duration! * 60 * 1000, 'Muted by admin');
          await safeReply(`🔇 **${user!.tag}** has been muted for ${duration} minutes.`);
        } catch (e) {
          await safeReply({ content: 'Failed to mute user. Check permissions.', ephemeral: true });
        }
      }

      if (commandName === 'lock') {
        const targetChannel = interaction.options.getChannel('channel') || channel;
        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) return;
        
        try {
          const textChannel = targetChannel as any;
          await textChannel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
          await safeReply(`🔒 Channel **${targetChannel.name}** has been locked.`);
        } catch (e) {
          await safeReply({ content: 'Failed to lock channel.', ephemeral: true });
        }
      }

      if (commandName === 'unlock') {
        const targetChannel = interaction.options.getChannel('channel') || channel;
        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) return;
        
        try {
          const textChannel = targetChannel as any;
          await textChannel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
          await safeReply(`🔓 Channel **${targetChannel.name}** has been unlocked.`);
        } catch (e) {
          await safeReply({ content: 'Failed to unlock channel.', ephemeral: true });
        }
      }

      if (['vote_kick', 'vote_ban', 'vote_mute'].includes(commandName)) {
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const duration = interaction.options.getInteger('duration') || 5;
        const type = commandName.split('_')[1] as 'kick' | 'ban' | 'mute';

        const voteId = `${guildId}_${targetUser!.id}_${Date.now()}`;
        const endTime = Date.now() + (duration * 60 * 1000);

        const embed = new EmbedBuilder()
          .setTitle(`🗳️ Vote to ${type.toUpperCase()}`)
          .setDescription(`**Target:** ${targetUser!.tag}\n**Reason:** ${reason}\n**Ends in:** ${duration} minutes`)
          .setColor(type === 'ban' ? 0xff0000 : 0xffff00)
          .setFooter({ text: 'Vote using the buttons below!' });

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder().setCustomId(`vote_agree_${voteId}`).setLabel('Agree').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`vote_disagree_${voteId}`).setLabel('Disagree').setStyle(ButtonStyle.Danger)
          );

        const message = await safeReply({ embeds: [embed], components: [row], fetchReply: true }) as any;

        if (message) {
          activeVotes.set(voteId, {
            type,
            targetId: targetUser!.id,
            targetTag: targetUser!.tag,
            reason: reason!,
            duration: commandName === 'vote_mute' ? interaction.options.getInteger('duration') : undefined,
            agreePoints: 0,
            disagreePoints: 0,
            voters: new Set(),
            endTime,
            messageId: message.id
          });

          setTimeout(() => processVote(guildId, voteId), duration * 60 * 1000);
        }
      }

      if (commandName === 'play') {
        const query = interaction.options.getString('query');
        const voiceChannel = (member as any).voice.channel;

        if (!voiceChannel) {
          return safeReply({ content: 'You must be in a voice channel!', ephemeral: true });
        }

        try {
          const searchResult = await safePlaySearch(query!, { limit: 1 });
          if (searchResult.length === 0) return safeReply('No results found.');

          const song = searchResult[0];
          let queueData = musicQueues.get(guildId);

          if (!queueData) {
            const player = createAudioPlayer();
            queueData = {
              player,
              queue: [],
              loopMode: 'off',
              voiceChannel,
              textChannel: channel,
              bassboost: false,
              nightcore: false
            };
            musicQueues.set(guildId, queueData);

            const connection = joinVoiceChannel({
              channelId: voiceChannel.id,
              guildId: guild.id,
              adapterCreator: guild.voiceAdapterCreator,
              selfDeaf: true,
            });

            connection.subscribe(player);
            console.log(`Subscribed player to voice connection in guild: ${guildId}`);

            connection.on('stateChange', (oldState, newState) => {
              console.log(`Voice connection in guild ${guildId} changed from ${oldState.status} to ${newState.status}`);
              if (newState.status === VoiceConnectionStatus.Disconnected) {
                try {
                  // Attempt to reconnect if disconnected
                  Promise.race([
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Connect timeout')), 5000)),
                    connection.rejoin()
                  ]).catch(e => {
                    console.error(`Failed to rejoin voice channel in guild ${guildId}:`, e.message);
                    connection.destroy();
                  });
                } catch (e: any) {
                  console.error(`Error rejoining voice in guild ${guildId}:`, e.message);
                }
              }
            });

            connection.on('error', error => {
              console.error(`Voice connection error in guild ${guildId}:`, error.message);
              if (error.message.includes('socket closed') || error.message.includes('IP discovery')) {
                console.warn(`Handling known voice connection error in guild ${guildId}. Connection might be unstable.`);
              }
            });

            player.on('stateChange', (oldState, newState) => {
              console.log(`Audio player in guild ${guildId} changed from ${oldState.status} to ${newState.status}`);
            });

            player.on('error', error => {
              console.error(`Audio player error in guild ${guildId}:`, error.message);
              queueData?.textChannel.send(`Audio player error: ${error.message}`);
            });

            player.on(AudioPlayerStatus.Idle, () => {
              playNext(guildId).catch(err => console.error(`Unhandled error in playNext (Idle) for guild ${guildId}:`, err));
            });
          }

          queueData.queue.push(song);
          if (queueData.player.state.status === AudioPlayerStatus.Idle) {
            playNext(guildId).catch(err => console.error(`Unhandled error in playNext (Initial) for guild ${guildId}:`, err));
          }

          await safeReply(`🎶 Added **${song.title}** to queue.`);
        } catch (e: any) {
          console.error(e);
          if (e.message?.includes('429') || e.message?.includes('Got 429')) {
            await safeReply('❌ YouTube is currently rate-limiting the bot (Error 429). Please try again in a moment.');
          } else if (e.message?.includes('Sign in') || e.message?.includes('bot')) {
            await safeReply('❌ YouTube is blocking the bot. Please update the `YOUTUBE_COOKIE` environment variable with fresh cookies.');
          } else {
            await safeReply(`Failed to play song: ${e.message || 'Unknown error'}`);
          }
        }
      }

      if (commandName === 'pause') {
        const queue = musicQueues.get(guildId);
        if (queue) { queue.player.pause(); await safeReply('⏸️ Paused.'); }
        else await safeReply('No music playing.');
      }

      if (commandName === 'resume') {
        const queue = musicQueues.get(guildId);
        if (queue) { queue.player.unpause(); await safeReply('▶️ Resumed.'); }
        else await safeReply('No music playing.');
      }

      if (commandName === 'stop') {
        const queue = musicQueues.get(guildId);
        if (queue) {
          queue.queue = [];
          queue.player.stop();
          const connection = getVoiceConnection(guildId);
          connection?.destroy();
          musicQueues.delete(guildId);
          await safeReply('⏹️ Stopped and cleared queue.');
        } else await safeReply('No music playing.');
      }

      if (commandName === 'skip') {
        const queue = musicQueues.get(guildId);
        if (queue) { queue.player.stop(); await safeReply('⏭️ Skipped.'); }
        else await safeReply('No music playing.');
      }

      if (commandName === 'nowplaying') {
        const queue = musicQueues.get(guildId);
        if (!queue || queue.queue.length === 0) return safeReply('Nothing playing.');
        await safeReply(`🎶 **Now playing:** ${queue.queue[0].title}`);
      }

      if (commandName === 'queue') {
        const queue = musicQueues.get(guildId);
        if (!queue || queue.queue.length === 0) return safeReply('📭 Queue is empty.');
        const list = queue.queue
          .slice(0, 10)
          .map((s, i) => `${i + 1}. **${s.title}**`)
          .join('\n');
        const more = queue.queue.length > 10 ? `\n...and ${queue.queue.length - 10} more songs` : '';
        await safeReply(`🎶 **Queue (${queue.queue.length} songs):**\n${list}${more}`);
      }

      if (commandName === 'remove') {
        const index = interaction.options.getInteger('index');
        const queue = musicQueues.get(guildId);
        if (!queue || queue.queue.length < index!) return safeReply('Invalid index.');
        const removed = queue.queue.splice(index! - 1, 1);
        await safeReply(`🗑️ Removed **${removed[0].title}** from queue.`);
      }

      if (commandName === 'clearqueue') {
        const queue = musicQueues.get(guildId);
        if (queue) { queue.queue = []; await safeReply('🧹 Queue cleared.'); }
        else await safeReply('No music playing.');
      }

      if (commandName === 'loop') {
        const mode = interaction.options.getString('mode') as 'off' | 'song' | 'queue';
        const queue = musicQueues.get(guildId);
        if (queue) { queue.loopMode = mode; await safeReply(`🔁 Loop mode set to **${mode}**.`); }
        else await safeReply('No music playing.');
      }

      if (commandName === 'bassboost') {
        const queue = musicQueues.get(guildId);
        if (queue) { queue.bassboost = !queue.bassboost; await safeReply(`🔊 Bassboost **${queue.bassboost ? 'enabled' : 'disabled'}**.`); }
        else await safeReply('No music playing.');
      }

      if (commandName === 'nightcore') {
        const queue = musicQueues.get(guildId);
        if (queue) { queue.nightcore = !queue.nightcore; await safeReply(`✨ Nightcore **${queue.nightcore ? 'enabled' : 'disabled'}**.`); }
        else await safeReply('No music playing.');
      }
    }

    async function handleButtonInteraction(interaction: any) {
      const { customId, guildId, member, guild } = interaction;
      if (!customId.startsWith('vote_')) return;

      const safeButtonReply = async (options: string | any) => {
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply(options);
          } else {
            await interaction.reply(options);
          }
        } catch (e: any) {
          if (e.code === 10062) {
            console.warn('Unknown interaction (expired) while trying to reply to button.');
          } else {
            console.error('Error in safeButtonReply:', e);
          }
        }
      };

      const parts = customId.split('_');
      const action = parts[1];
      const voteId = parts.slice(2).join('_');

      const vote = activeVotes.get(voteId);
      if (!vote) return safeButtonReply({ content: 'This vote has ended.', ephemeral: true });

      if (vote.voters.has(member.id)) {
        return safeButtonReply({ content: 'You have already voted!', ephemeral: true });
      }

      let points = 1;
      if (member.id === guild.ownerId) points = 4;
      else if (member.permissions.has(PermissionFlagsBits.Administrator)) points = 3;

      if (action === 'agree') vote.agreePoints += points;
      else vote.disagreePoints += points;

      vote.voters.add(member.id);

      await safeButtonReply({ content: `You voted **${action}** with **${points}** points.`, ephemeral: true });
    }

    async function processVote(guildId: string, voteId: string) {
      const vote = activeVotes.get(voteId);
      if (!vote) return;

      const guild = discordClient?.guilds.cache.get(guildId);
      if (!guild) return;

      const channel = guild.channels.cache.find(c => c.isTextBased()) as any;
      
      let resultMessage = '';
      const success = vote.agreePoints > vote.disagreePoints;

      if (success) {
        try {
          const targetMember = await guild.members.fetch(vote.targetId);
          if (vote.type === 'kick') {
            await targetMember.kick(vote.reason);
            resultMessage = `✅ Vote passed! **${vote.targetTag}** has been kicked.`;
          } else if (vote.type === 'ban') {
            await targetMember.ban({ reason: vote.reason });
            resultMessage = `✅ Vote passed! **${vote.targetTag}** has been banned.`;
          } else if (vote.type === 'mute') {
            await targetMember.timeout(vote.duration! * 60 * 1000, vote.reason);
            resultMessage = `✅ Vote passed! **${vote.targetTag}** has been muted for ${vote.duration} minutes.`;
          }
        } catch (e) {
          resultMessage = `❌ Vote passed but failed to execute action on **${vote.targetTag}**. Check bot permissions.`;
        }
      } else {
        resultMessage = `❌ Vote failed for **${vote.targetTag}**. (Agree: ${vote.agreePoints}, Disagree: ${vote.disagreePoints})`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🗳️ Vote Result: ${vote.type.toUpperCase()}`)
        .setDescription(resultMessage)
        .addFields(
          { name: 'Agree Points', value: vote.agreePoints.toString(), inline: true },
          { name: 'Disagree Points', value: vote.disagreePoints.toString(), inline: true }
        )
        .setColor(success ? 0x00ff00 : 0xff0000);

      await channel?.send({ embeds: [embed] });
      activeVotes.delete(voteId);
    }

    async function playNext(guildId: string, retryCount = 0) {
      if (retryCount > 5) {
        console.error(`Max retries reached for guild ${guildId}. Stopping playback.`);
        const queueData = musicQueues.get(guildId);
        queueData?.textChannel.send('⚠️ Too many errors in a row. Stopping playback.');
        return;
      }

      const queueData = musicQueues.get(guildId);
      if (!queueData) return;

      if (queueData.leaveTimeout) {
        clearTimeout(queueData.leaveTimeout);
        queueData.leaveTimeout = undefined;
      }

      if (queueData.queue.length === 0 && queueData.loopMode === 'off') {
        const connection = getVoiceConnection(guildId);
        queueData.leaveTimeout = setTimeout(() => {
          if (queueData && queueData.queue.length === 0) {
            console.log(`Leaving voice channel in guild ${guildId} due to inactivity.`);
            connection?.destroy();
            musicQueues.delete(guildId);
          }
        }, 60000);
        return;
      }

      let song;
      if (queueData.loopMode === 'song') {
        song = queueData.queue[0];
      } else if (queueData.loopMode === 'queue') {
        song = queueData.queue.shift();
        queueData.queue.push(song);
      } else {
        song = queueData.queue.shift();
      }

      if (!song) return;

      try {
        console.log(`Attempting to play: ${song.title} (${song.url})`);
        const stream = await safePlayStream(song.url);
        console.log(`Stream created successfully for: ${song.title}, type: ${stream.type}`);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        queueData.player.play(resource);
        queueData.textChannel.send(`🎶 Now playing: **${song.title}**`);
      } catch (e: any) {
        const msg: string = e?.message || '';
        console.error(`Error playing song ${song.title}:`, msg || e);

        if (msg.includes('429') || msg.includes('Got 429')) {
          // Put song back at front, wait 15s then retry
          queueData.queue.unshift(song);
          queueData.textChannel.send(`❌ YouTube rate limit (429). Waiting 15s then retrying **${song.title}**...`);
          setTimeout(() => {
            playNext(guildId, retryCount + 1).catch(err =>
              console.error(`Unhandled error in retry playNext for guild ${guildId}:`, err)
            );
          }, 15000);
        } else if (msg.includes('Sign in') || msg.includes('bot')) {
          // Bot detection — skip song
          queueData.textChannel.send(`❌ YouTube blocked the bot on **${song.title}**. Please update \`YOUTUBE_COOKIE\`. Skipping...`);
          playNext(guildId, retryCount + 1).catch(err =>
            console.error(`Unhandled error in recursive playNext for guild ${guildId}:`, err)
          );
        } else {
          // Other error — skip song
          queueData.textChannel.send(`❌ Error playing **${song.title}**: ${msg || 'Unknown error'}. Skipping...`);
          playNext(guildId, retryCount + 1).catch(err =>
            console.error(`Unhandled error in recursive playNext for guild ${guildId}:`, err)
          );
        }
      }
    }

    discordClient.on("ready", async () => {
      console.log(`Discord Bot logged in as ${discordClient?.user?.tag}!`);
      console.log(`Bot ID: ${discordClient?.user?.id}`);
      console.log(`Invite link: https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`);
      
      // Sync bot guilds to Firestore in background
      if (db && discordClient) {
        (async () => {
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
        })();
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