const { default: makeWASocket, useMultiFileAuthState } = require('@whapi/baileys');

function validatePhoneNumber(phone) {
    // Hapus karakter non-digit
    phone = phone.replace(/\D/g, '');
    
    // Validasi format nomor Indonesia
    if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
    }
    
    if (!phone.startsWith('62')) {
        throw new Error('Format nomor harus 62... atau 08...');
    }
    
    if (phone.length < 10 || phone.length > 15) {
        throw new Error('Panjang nomor tidak valid');
    }
    
    return phone;
}

async function startBot() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        // Input nomor WA
        const phoneInput = await new Promise((resolve) => {
            rl.question('📱 Masukkan nomor WA (62/08): ', resolve);
        });

        const phoneNumber = validatePhoneNumber(phoneInput);
        console.log(`✅ Nomor valid: ${phoneNumber}`);

        const { state, saveCreds } = await useMultiFileAuthState(`session_${phoneNumber}`);
        
        const sock = makeWASocket({
            auth: state,
            phoneNumber: phoneNumber,
            mobile: true,
            printQRInTerminal: false,
            markOnlineOnConnect: false,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, pairingCode, qr } = update;
            
            if (pairingCode) {
                console.log('\n✨ =========================');
                console.log(`   PAIRING CODE: ${pairingCode}`);
                console.log('   =========================');
                console.log(`   Untuk nomor: ${phoneNumber}`);
                console.log('   Cara: WhatsApp → Linked Devices');
                console.log('✨ =========================\n');
            }
            
            if (connection === 'open') {
                console.log(`🎉 Berhasil! Bot jalan dengan nomor ${phoneNumber}`);
                rl.close();
            }
            
            if (connection === 'close') {
                console.log('⚠️  Koneksi terputus');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Handle messages
        sock.ev.on('messages.upsert', ({ messages }) => {
            const msg = messages[0];
            console.log('💬 Pesan masuk:', {
                from: msg.key.remoteJid,
                message: msg.message
            });
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        rl.close();
    }
}

startBot();
