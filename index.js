const {
  default: makeWASocket,
  useMultiFileAuthState,
  PHONENUMBER_MCC,
} = require('@whiskeysockets/baileys')
const readline = require('readline')

// Session
const session = 'auth'
const pairingCode = true

// Untuk input nomor
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

async function connectWA() {
  const { state, saveCreds } = await useMultiFileAuthState(session)
  
  const socket = makeWASocket({
    printQRInTerminal: false, // Pakai pairing code
    logger: { level: 'silent' },
    auth: state,
    markOnlineOnConnect: false, // BEKUKAN LAST SEEN
    syncFullHistory: false,
    shouldIgnoreJid: jid => jid?.endsWith('@g.us'), // Optional: ignore group sync
  })

  // Pairing Code System
  if (pairingCode && !socket.authState.creds.registered) {
    let phoneNumber = await question('Masukkan nomor WA (62/08): ')
    phoneNumber = phoneNumber.replace(/[^0-9]/g, "")
    
    // Format nomor
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '62' + phoneNumber.substring(1)
    }
    if (!phoneNumber.startsWith('62')) {
      phoneNumber = '62' + phoneNumber
    }

    console.log(`🔢 Menggunakan nomor: ${phoneNumber}`)

    setTimeout(async () => {
      try {
        const code = await socket.requestPairingCode(phoneNumber)
        console.log('\n═══════════════════════════════')
        console.log('📱 PAIRING CODE: ' + code)
        console.log('═══════════════════════════════')
        console.log('WhatsApp → Linked Devices → Link a Device')
        console.log('═══════════════════════════════\n')
      } catch (error) {
        console.log('❌ Gagal meminta pairing code')
      }
    }, 3000)
  }

  // Handle connection
  socket.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log('✅ BERHASIL TERHUBUNG!')
      console.log('📱 Status: ONLINE')
      console.log('👀 Last Seen: BEKU/DIBEKUKAN')
      console.log('✓ Centang 1: AKTIF')
      rl.close()
      
      // Test kirim pesan ke sendiri
      setTimeout(async () => {
        try {
          await socket.sendMessage(socket.user.id, { 
            text: '🤖 Bot sudah aktif!\n• Last Seen: Beku\n• Centang 1: Aktif\n• Status: Online' 
          })
        } catch (e) {}
      }, 2000)
    }
    
    if (connection === "close") {
      if (lastDisconnect?.error?.output?.statusCode !== 401) {
        setTimeout(connectWA, 5000)
      }
    }
  })

  // Save credentials
  socket.ev.on("creds.update", saveCreds)

  // Handle incoming messages - CENTANG 1 SAJA
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    
    // JANGAN baca pesan (biarkan centang 1)
    // Tidak pakai readMessages() agar tetap centang 1
    
    if (m.message) {
      const from = m.key.remoteJid
      const msgType = Object.keys(m.message)[0]
      const msgText = m.message.conversation || m.message.extendedTextMessage?.text || ''
      
      console.log(`📨 Pesan dari ${from}: ${msgText}`)
      
      // Auto reply tapi TANPA baca pesan (biarkan centang 1)
      if (msgText.toLowerCase() === 'ping') {
        await socket.sendMessage(from, { text: 'Pong! 🏓' })
        // Tetap centang 1 karena tidak pakai readMessages()
      }
      
      if (msgText.toLowerCase() === 'status') {
        await socket.sendMessage(from, { 
          text: '📊 Status Bot:\n• ✅ Online\n• 👀 Last Seen: Beku\n• ✓ Centang 1: Aktif\n• 📨 Pesan terbaca: Tidak' 
        })
      }
    }
  })
}

// Jalankan
console.log('🚀 Starting WhatsApp Bot...')
connectWA().catch(console.error)
