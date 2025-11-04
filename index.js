const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeInMemoryStore,
  jidDecode,
  PHONENUMBER_MCC,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const readline = require("readline");
const fs = require("fs-extra");

// Session
const sessionName = "session";
const pairingCode = true; // Selalu pakai pairing code

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const store = makeInMemoryStore({
  logger: {
    level: "silent"
  }
});

async function startServer() {
  const { state, saveCreds } = await useMultiFileAuthState("./" + sessionName);
  
  const conn = makeWASocket({
    printQRInTerminal: false, // Tidak pakai QR, pakai pairing code
    logger: {
      level: "silent"
    },
    browser: ["Chrome (Linux)", "", ""],
    auth: state,
    markOnlineOnConnect: false, // ✅ BEKUKAN LAST SEEN
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    emitOwnEvents: false,
    fireInitQueries: false,
    generateHighQualityLinkPreview: false,
  });

  conn.ev.on("creds.update", saveCreds);

  // Pairing Code System
  if (pairingCode && !conn.authState.creds.registered) {
    console.log("╭──────────────────────────────────────");
    console.log("📨 Masukkan nomor WhatsApp:");
    console.log("├──────────────────────────────────────");
    let phoneNumber = await question(`   - Nomor: `);
    console.log("╰──────────────────────────────────────");
    
    phoneNumber = phoneNumber.replace(/[^0-9]/g, "");
    
    // Format nomor
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '62' + phoneNumber.substring(1);
    }
    if (!phoneNumber.startsWith('62')) {
      phoneNumber = '62' + phoneNumber;
    }

    if (!Object.keys(PHONENUMBER_MCC).some((v) => phoneNumber.startsWith(v))) {
      console.log("╭──────────────────────────────────────");
      console.log("❌ Format salah! Contoh: 628123456789");
      console.log("╰──────────────────────────────────────");
      phoneNumber = await question(`   - Nomor: `);
      phoneNumber = phoneNumber.replace(/[^0-9]/g, "");
    }

    const code = await conn.requestPairingCode(phoneNumber);
    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
    
    console.log("╭──────────────────────────────────────");
    console.log("📱 PAIRING CODE:");
    console.log("├──────────────────────────────────────");
    console.log(`   - Code: ${formattedCode}`);
    console.log("╰──────────────────────────────────────");
    console.log("💡 Cara: WhatsApp → Linked Devices → Link a Device");
    rl.close();
  }

  store.bind(conn.ev);

  // Handle messages - TANPA BACA PESAN (CENTANG 1)
  conn.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const m = chatUpdate.messages[0];
      if (!m.message) return;
      
      // JANGAN baca pesan - biarkan CENTANG 1
      // Tidak pakai readMessages() atau markRead()
      
      m.message = Object.keys(m.message)[0] === "ephemeralMessage"
        ? m.message.ephemeralMessage.message
        : m.message;

      if (m.key && m.key.remoteJid === "status@broadcast") return;
      if (m.key.id.startsWith("BAE5") && m.key.id.length === 16) return;

      const from = m.key.remoteJid;
      const msgText = m.message.conversation || m.message.extendedTextMessage?.text || '';
      
      console.log(`📨 Pesan dari ${from}: ${msgText}`);

      // Auto reply TANPA baca pesan (tetap centang 1)
      if (msgText.toLowerCase() === 'ping') {
        await conn.sendMessage(from, { text: '🏓 Pong!' });
      }
      
      if (msgText.toLowerCase() === 'status') {
        await conn.sendMessage(from, { 
          text: '📊 Status Bot:\n• ✅ Online\n• 👀 Last Seen: Beku\n• ✓ Centang 1: Aktif\n• 📨 Pesan tidak dibaca' 
        });
      }

    } catch (err) {
      console.log("Error:", err);
    }
  });

  // Connection update
  conn.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    const code = lastDisconnect?.error?.output?.statusCode ||
                lastDisconnect?.error?.output?.payload?.statusCode;

    if (connection === "close") {
      if (code !== DisconnectReason.loggedOut) {
        console.log("🔌 Koneksi terputus, reconnect...");
        setTimeout(startServer, 5000);
      } else {
        console.log("❌ Logged out");
      }
    }

    if (connection === "open") {
      console.log("╭──────────────────────────────────────");
      console.log("✅ BERHASIL TERHUBUNG!");
      console.log("├──────────────────────────────────────");
      console.log("📱 Status: ONLINE");
      console.log("👀 Last Seen: BEKU/DIBEKUKAN");
      console.log("✓ Centang 1: AKTIF");
      console.log("╰──────────────────────────────────────");
    }
  });

  // Helper functions
  conn.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return ((decode.user && decode.server && decode.user + "@" + decode.server) || jid);
    } else return jid;
  };

  conn.sendText = (jid, text, quoted = "", options) => {
    return conn.sendMessage(
      jid,
      { text: text, ...options },
      { quoted, ...options }
    );
  };
}

// Start bot
console.log("🚀 Starting WhatsApp Bot...");
startServer().catch(console.error);
