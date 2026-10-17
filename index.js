/**
 * SNUGGLE X ULTRA — index.js
 * Deploy with SESSION_ID env var on Railway/Render/Heroku
 * 
 * Features: menu, antilink, anticommands, .vv, .getpp, promote/demote/antidemote,
 * tagall, hidetag, kick, add, song, video, sticker, url, ai, chatbot, and more.
 */

require('dotenv/config');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const axios = require('axios');
const P = require('pino');
const Database = require('better-sqlite3');
const {
  useMultiFileAuthState, makeWASocket, DisconnectReason,
  fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers, downloadMediaMessage,
} = require('@whiskeysockets/baileys');

const SESSION_DIR = path.join(__dirname, 'session');
const PAIRING_URL = process.env.PAIRING_URL || 'https://snugglex-pair.onrender.com';

// === Decode session ID ===
async function decodeSession(sessionId) {
  if (!sessionId) { console.error('❌ SESSION_ID not set!'); process.exit(1); }
  if (!sessionId.startsWith('snugglex:~')) { console.error('❌ Must start with snugglex:~'); process.exit(1); }
  const b64 = sessionId.replace(/^snugglex:~/, '');
  let sessionB64 = null;
  if (/^[a-f0-9]{12}$/.test(b64)) {
    console.log('[Session] Fetching from pairing site...');
    try { const r = await axios.get(`${PAIRING_URL}/api/session/${b64}`, { timeout: 30000 }); sessionB64 = r.data?.session; }
    catch (e) { console.error('❌ Session fetch failed:', e.message); process.exit(1); }
  } else { sessionB64 = b64; }
  try {
    let s = sessionB64.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4);
    const gz = Buffer.from(s, 'base64');
    let json; try { json = zlib.gunzipSync(gz).toString('utf-8'); } catch { json = Buffer.from(s, 'base64').toString('utf-8'); }
    const files = JSON.parse(json);
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
    for (const [n, c] of Object.entries(files)) { const fp = path.join(SESSION_DIR, n); fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, Buffer.from(c, 'base64')); }
    console.log(`[Session] ✅ ${Object.keys(files).length} files written`);
  } catch (e) { console.error('❌ Decode failed:', e.message); process.exit(1); }
}

// === SQLite ===
let db;
function initDb() {
  db = new Database(path.join(SESSION_DIR, 'bot.db'));
  db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE IF NOT EXISTS sudos (number TEXT PRIMARY KEY);');
}
const dbGet = (k, d) => { try { const r = db.prepare('SELECT value FROM kv WHERE key=?').get(k); return r ? r.value : d; } catch { return d; } };
const dbSet = (k, v) => { try { db.prepare('INSERT OR REPLACE INTO kv (key,value) VALUES (?,?)').run(k, String(v)); } catch {} };
const dbGetJSON = (k, d) => { try { const v = dbGet(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const dbSetJSON = (k, v) => dbSet(k, JSON.stringify(v));

// === Menu ===
function buildMenu(prefix, ownerName, mode) {
  const p = prefix, rm = '\u200e'.repeat(700);
  const mem = process.memoryUsage(), ramPct = Math.min(100, Math.round((mem.rss / os.totalmem()) * 100));
  const ramBar = '█'.repeat(Math.round(ramPct/10)) + '░'.repeat(10 - Math.round(ramPct/10));
  let h = `┏▣ ◈ *SNUGGLE-X ULTRA* ◈
┃ *ᴏᴡɴᴇʀ* : ${ownerName}
┃ *ᴘʀᴇғɪx* : [ ${p} ]
┃ *ʜᴏsᴛ* : Railway
┃ *ᴘʟᴜɢɪɴs* : 100+
┃ *ᴍᴏᴅᴇ* : ${mode}
┃ *ᴠᴇʀsɪᴏɴ* : 1.0.0
┃ *sᴘᴇᴇᴅ* : ${(process.hrtime()[1]/1e6).toFixed(4)} ms
┃ *ᴜsᴀɢᴇ* : ${(mem.rss/1024/1024).toFixed(0)} MB of ${Math.round(os.totalmem()/1024/1024/1024)} GB
┃ *ʀᴀᴍ:* [${ramBar}] ${ramPct}%
┗▣ ${rm}\n\n`;
  const cats = {
    'MAIN MENU': ['menu','ping','alive','owner','help','whoami','uptime','time','repo'],
    'GROUP MENU': ['tagall','hidetag','promote','demote','kick','add','ginfo','link','resetlink','setgroupname','setdesc','leave','join','getpp','totalmembers','close','open','lock','unlock','mute','unmute','warn','resetwarn'],
    'ANTI MENU': ['antilink','antispam','antibadword','antidelete','antimention','antitag','antisticker','anticall','antidemote','antipromote','antiviewonce','antiaudio','antiimage','antivideo','antivoice'],
    'DOWNLOAD MENU': ['song','video'],
    'MEDIA MENU': ['sticker','url','tts','translate','vv','vv2','vv3'],
    'FUN MENU': ['8ball','truth','dare','joke','quote','fact','pickupline','rps','ship','flip','dice','choose','shrug'],
    'SEARCH MENU': ['weather','wiki','define','shorten'],
    'TOOLS MENU': ['calc','qr','uuid','pass','reverse','count','base64','hash','fliptext'],
    'AI MENU': ['ai','ask','chatbot','setgeminikey'],
    'OWNER MENU': ['mode','addsudo','delsudo','sudolist','setpp','setbio','setname','setownername','setprefix','block','unblock','pair'],
    'SETTINGS MENU': ['mode','setprefix','setownername','chatbot','setgeminikey','autofaketyping','autofakerecording','setpp','setbio','setname','block','unblock','addsudo','delsudo','sudolist'],
  };
  for (const [name, cmds] of Object.entries(cats)) { h += `┏▣ ◈ *${name}* ◈\n${cmds.map(c=>`│➽ ${p}${c}`).join('\n')}\n┗▣ \n\n`; }
  h += `> *Powered by Yobby King*\n> *Instagram: @yobby_mking*`;
  return h;
}

function formatUptime(s) { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60); return h>0?`${h}h ${m}m`:m>0?`${m}m ${sec}s`:`${sec}s`; }

// === Main ===
async function start() {
  const sessionId = process.env.SESSION_ID;
  if (sessionId) await decodeSession(sessionId);
  else if (!fs.existsSync(path.join(SESSION_DIR, 'creds.json'))) { console.error('❌ No SESSION_ID'); process.exit(1); }

  // Owner info
  let ownerJid = null, ownerName = 'Not Set!';
  try { const c = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, 'creds.json'), 'utf-8')); if (c.me?.id) { ownerJid = c.me.id; ownerName = c.me.name || 'Not Set!'; } } catch {}
  const ownerNumber = ownerJid ? ownerJid.split(':')[0].split('@')[0] : null;
  console.log(`[Bot] Owner: ${ownerNumber} (${ownerJid})`);

  initDb();
  const getPrefix = () => { const p = dbGet('prefix', '.'); return p === 'none' ? '' : p; };
  const getMode = () => dbGet('mode', 'public');
  const getOwnerName = () => dbGet('ownerName', '') || ownerName;
  const getGeminiKey = () => dbGet('geminiKey', '') || process.env.GEMINI_KEY || '';

  // Connect
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();
  const logger = P({ level: 'warn' }, P.destination({ sync: false }));
  const sock = makeWASocket({ version, auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) }, printQRInTerminal: false, browser: Browsers.ubuntu('Chrome'), logger, markOnlineOnConnect: false, linkPreview: false, syncFullHistory: false });
  sock.ev.on('creds.update', saveCreds);

  let isStarting = true;
  sock.ev.on('connection.update', async (u) => {
    if (u.connection === 'open') {
      console.log('[Bot] ✅ Connected as', sock.user.id);
      if (isStarting) { isStarting = false; setTimeout(() => { try { sock.sendMessage(ownerNumber+'@s.whatsapp.net', { text: '*`SNUGGLE X ULTRA CONNECTED ✅`*\n> snuggle x ultra bot\n\nType *.menu* to see commands.' }); } catch {} }, 2000); }
    }
    if (u.connection === 'close') { const c = u.lastDisconnect?.error?.output?.statusCode; console.log('[Bot] closed:', c); if (c === DisconnectReason.loggedOut) process.exit(1); else setTimeout(() => start(), 3000); }
  });

  // === Messages ===
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const m = messages[0]; if (!m?.message) return;
      const chatId = m.key.remoteJid;
      if (chatId?.includes('newsletter') || chatId?.includes('broadcast')) return;
      const isGroup = chatId?.endsWith('@g.us');
      const participant = m.key.participant || chatId;
      const participantPn = m.key.participantPn || null;
      const isLid = chatId?.endsWith('@lid');
      const senderPhone = (isGroup ? participant : chatId)?.split('@')[0].split(':')[0];
      const isOwner = senderPhone === ownerNumber || (participantPn && participantPn.split('@')[0] === ownerNumber) || (isLid && !isGroup);
      if (m.key.fromMe && !isGroup && !isOwner) return;

      const msg = m.message;
      let text = msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '';
      if (!text) return;
      const raw = text.trim(); if (!raw) return;
      const prefix = getPrefix();
      const cmd = raw.replace(/^[*_`~]+/, '').trim().toLowerCase().split(/\s+/)[0];
      const args = raw.replace(/^[*_`~]+/, '').trim().split(/\s+/).slice(1);
      const argText = args.join(' ');
      const ownerCheck = isOwner || (isGroup && m.key.fromMe);
      const sudoCheck = (() => { try { return !!db.prepare('SELECT 1 FROM sudos WHERE number=?').get(senderPhone); } catch { return false; } })();
      const mode = getMode();
      if ((mode==='silent'||mode==='private') && !ownerCheck && !sudoCheck) return;
      if (mode==='groups' && !isGroup && !ownerCheck && !sudoCheck) return;
      if (mode==='dms' && isGroup && !ownerCheck && !sudoCheck) return;
      const q = isGroup ? m : undefined;

      // === Loading animation for .menu ===
      async function showLoading() { try { const lm = await sock.sendMessage(chatId, { text: '*Loading* •' }); for (const s of ['*Loading* ••','*Loading* • •','*Loading* • • •','*Loading* • • • •']) { await new Promise(r=>setTimeout(r,400)); try { await sock.sendMessage(chatId, { text: s, edit: lm.key }); } catch {} } await new Promise(r=>setTimeout(r,400)); } catch {} }

      // === MENU ===
      if (cmd === `${prefix}menu`) { await showLoading(); await sock.sendMessage(chatId, { text: buildMenu(prefix, getOwnerName(), mode) }); console.log(`[MENU] ✅ ${chatId}`); return; }
      if (cmd === `${prefix}ping`) { const t=Date.now(); await sock.sendMessage(chatId, { text: `*PONG* 🏓\n${Date.now()-t}ms` }, { quoted: q }); return; }
      if (cmd === `${prefix}alive`) { await sock.sendMessage(chatId, { text: `*ALIVE ✅*\n> owner: ${getOwnerName()}\n> mode: ${mode}\n> uptime: ${formatUptime(process.uptime())}` }, { quoted: q }); return; }
      if (cmd === `${prefix}help`) { await sock.sendMessage(chatId, { text: `Type *${prefix}menu*` }, { quoted: q }); return; }
      if (cmd === `${prefix}owner`) { await sock.sendMessage(chatId, { text: `*OWNER* 👑\n> Yobby King\n> ${ownerNumber}\n> IG: @yobby_mking` }, { quoted: q }); return; }
      if (cmd === `${prefix}whoami`) { await sock.sendMessage(chatId, { text: `*${m.pushName||'User'}*\n*Num:* ${senderPhone}\n*Status:* ${ownerCheck?'Owner 👑':sudoCheck?'Sudo 🔑':'User'}` }, { quoted: q }); return; }
      if (cmd === `${prefix}uptime`) { await sock.sendMessage(chatId, { text: `⏱️ ${formatUptime(process.uptime())}` }, { quoted: q }); return; }
      if (cmd === `${prefix}time`) { await sock.sendMessage(chatId, { text: `🕐 ${new Date().toLocaleString()}` }, { quoted: q }); return; }
      if (cmd === `${prefix}repo`) { await sock.sendMessage(chatId, { text: '📦 https://github.com/yobbyking/snugglex_ultra' }, { quoted: q }); return; }

      // === STICKER (public) ===
      if (cmd === `${prefix}sticker`) {
        let hm = msg.imageMessage || msg.videoMessage || msg.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        if (!hm) { await sock.sendMessage(chatId, { text: 'Reply to image with .sticker' }, { quoted: q }); return; }
        try { let tm = m; if (!msg.imageMessage && !msg.videoMessage) { const qm = msg.extendedTextMessage.contextInfo.quotedMessage; tm = { key: { remoteJid: chatId, id: msg.extendedTextMessage.contextInfo.stanzaId, participant: msg.extendedTextMessage.contextInfo.participant }, message: qm }; } const buf = await downloadMediaMessage(tm, 'buffer', {}, { logger: P({ level:'silent' }), reuploadRequest: sock.updateMediaMessage }); await sock.sendMessage(chatId, { sticker: Buffer.from(buf) }, { quoted: q }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: q }); } return;
      }

      // === URL (public) ===
      if (cmd === `${prefix}url`) {
        let hm = msg.imageMessage||msg.videoMessage||msg.audioMessage||msg.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        if (!hm) { await sock.sendMessage(chatId, { text: 'Reply to media with .url' }, { quoted: q }); return; }
        try { let tm=m; if(!msg.imageMessage&&!msg.videoMessage&&!msg.audioMessage){const qm=msg.extendedTextMessage.contextInfo.quotedMessage;tm={key:{remoteJid:chatId,id:msg.extendedTextMessage.contextInfo.stanzaId,participant:msg.extendedTextMessage.contextInfo.participant},message:qm};} const buf=await downloadMediaMessage(tm,'buffer',{},{logger:P({level:'silent'}),reuploadRequest:sock.updateMediaMessage}); const FormData=require('form-data');const form=new FormData();form.append('file',Buffer.from(buf),'u.bin'); const r=await axios.post('https://tmpfiles.org/api/v1/upload',form,{headers:form.getHeaders(),timeout:60000}); await sock.sendMessage(chatId, { text: `✅ ${r.data?.data?.url?.replace('tmpfiles.org/','tmpfiles.org/dl/')}` }, { quoted: q }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: q }); } return;
      }

      // === ACCESS GATE ===
      if (!ownerCheck && !sudoCheck) { if (cmd.startsWith(prefix)) await sock.sendMessage(chatId, { text: '> *only sudo access 🚫*\n> 0728530173' }, { quoted: q }); return; }

      // === Helper: toggle anti ===
      async function toggleAnti(key, label) {
        if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: q }); return; }
        const s = dbGetJSON('settings', {}); const gs = s[chatId] || {}; const sub = args[0]?.toLowerCase();
        if ((sub==='delete'||sub==='warn'||sub==='kick') && args[1]==='on') { gs[key]=sub; s[chatId]=gs; dbSet('settings',JSON.stringify(s)); await sock.sendMessage(chatId, { text: `✅ Anti-${label}: ${sub.toUpperCase()}` }, { quoted: q }); }
        else if (sub==='on') { gs[key]='delete'; s[chatId]=gs; dbSet('settings',JSON.stringify(s)); await sock.sendMessage(chatId, { text: `✅ Anti-${label} ON` }, { quoted: q }); }
        else if (sub==='off') { gs[key]='off'; s[chatId]=gs; dbSet('settings',JSON.stringify(s)); await sock.sendMessage(chatId, { text: `❌ Anti-${label} OFF` }, { quoted: q }); }
        else { await sock.sendMessage(chatId, { text: `*Anti-${label}:* ${gs[key]||'off'}\n.${key} delete/warn/kick on\n.${key} off` }, { quoted: q }); }
      }

      // === ALL COMMANDS ===
      switch (cmd) {
        // OWNER
        case `${prefix}mode`: if (['private','public','silent','groups','dms'].includes(argText)) { if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} dbSet('mode',argText); await sock.sendMessage(chatId,{text:`✅ Mode: ${argText}`},{quoted:q}); } else { await sock.sendMessage(chatId,{text:`*Mode:* ${mode}\nUsage: .mode public/private/silent/groups/dms`},{quoted:q}); } break;
        case `${prefix}setprefix`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} if(!argText){await sock.sendMessage(chatId,{text:'Usage: .setprefix <prefix>'},{quoted:q});break;} dbSet('prefix',argText==='none'?'none':argText); await sock.sendMessage(chatId,{text:`✅ Prefix: ${argText}`},{quoted:q}); break;
        case `${prefix}setownername`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} if(!argText){await sock.sendMessage(chatId,{text:'Usage: .setownername <name>'},{quoted:q});break;} dbSet('ownerName',argText); ownerName=argText; await sock.sendMessage(chatId,{text:`✅ Owner: ${argText}`},{quoted:q}); break;
        case `${prefix}addsudo`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} {const sn=args[0]?.replace(/[^0-9]/g,'');if(!sn){await sock.sendMessage(chatId,{text:'Usage: .addsudo <number>'},{quoted:q});break;} db.prepare('INSERT OR IGNORE INTO sudos (number) VALUES (?)').run(sn); await sock.sendMessage(chatId,{text:`✅ Sudo: ${sn}`},{quoted:q});} break;
        case `${prefix}delsudo`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} {const dn=args[0]?.replace(/[^0-9]/g,'');if(!dn){await sock.sendMessage(chatId,{text:'Usage: .delsudo <number>'},{quoted:q});break;} db.prepare('DELETE FROM sudos WHERE number=?').run(dn); await sock.sendMessage(chatId,{text:`✅ Removed ${dn}`},{quoted:q});} break;
        case `${prefix}sudolist`: {const su=db.prepare('SELECT number FROM sudos').all().map(r=>r.number); await sock.sendMessage(chatId,{text:`*Sudo (${su.length}):*\n${su.length?su.map(x=>'• '+x).join('\n'):'None'}`},{quoted:q});} break;
        case `${prefix}setpp`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} try{if(msg.imageMessage){const buf=await downloadMediaMessage(m,'buffer',{}, {logger:P({level:'silent'})}); await sock.updateProfilePicture(sock.user.id,Buffer.from(buf)); await sock.sendMessage(chatId,{text:'✅ PP updated'},{quoted:q});}else{await sock.sendMessage(chatId,{text:'Send image with .setpp'},{quoted:q});}}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}setbio`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} if(!argText){await sock.sendMessage(chatId,{text:'Usage: .setbio <text>'},{quoted:q});break;} try{await sock.updateProfileStatus(argText);await sock.sendMessage(chatId,{text:'✅ Bio updated'},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}setname`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} if(!argText){await sock.sendMessage(chatId,{text:'Usage: .setname <name>'},{quoted:q});break;} try{await sock.updateProfileName(argText);await sock.sendMessage(chatId,{text:`✅ Name: ${argText}`},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}block`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} {const bt=args[0]?.replace(/[^0-9]/g,'')+'@s.whatsapp.net';try{await sock.updateBlockStatus(bt,'block');await sock.sendMessage(chatId,{text:`✅ Blocked ${bt.split('@')[0]}`},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});}} break;
        case `${prefix}unblock`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} {const bt=args[0]?.replace(/[^0-9]/g,'')+'@s.whatsapp.net';try{await sock.updateBlockStatus(bt,'unblock');await sock.sendMessage(chatId,{text:`✅ Unblocked ${bt.split('@')[0]}`},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});}} break;
        case `${prefix}pair`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} {const pn=args[0]?.replace(/[^0-9]/g,'');if(!pn||pn.length<10){await sock.sendMessage(chatId,{text:'Usage: .pair <number>'},{quoted:q});break;} await sock.sendMessage(chatId,{text:`⏳ Pairing +${pn}...`},{quoted:q}); try{const{useMultiFileAuthState:ua,makeWASocket:ms,fetchLatestBaileysVersion:fv,makeCacheableSignalKeyStore:mk,Browsers:b}=require('@whiskeysockets/baileys');const psd=path.join(SESSION_DIR,'pair-'+pn);fs.rmSync(psd,{recursive:true,force:true});fs.mkdirSync(psd,{recursive:true});const{state:ps,saveCreds:pc}=await ua(psd);const{version:pv}=await fv();const pl=P({level:'silent'});const psock=ms({version:pv,auth:{creds:ps.creds,keys:mk(ps.keys,pl)},printQRInTerminal:false,browser:b.ubuntu('Chrome'),logger:pl,markOnlineOnConnect:false});let code=null;psock.ev.on('creds.update',pc);psock.ev.on('connection.update',async(u)=>{if(u.qr&&!code){try{await new Promise(r=>setTimeout(r,1500));code=await psock.requestPairingCode(pn);await sock.sendMessage(chatId,{text:`🔑 *Code:*\n\n*${code}*`},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});}}if(u.connection==='open'){setTimeout(()=>{try{psock.end();}catch{}fs.rmSync(psd,{recursive:true,force:true});},5000);}});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});}} break;
        // GROUP
        case `${prefix}tagall`: if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} try{const meta=await sock.groupMetadata(chatId);const mentions=meta.participants.map(p=>p.id);await sock.sendMessage(chatId,{text:`┏▣ *TAG ALL* ▣\n┗▣ ${mentions.length} members\n\n`+mentions.map(p=>'➽ @'+p.split('@')[0]).join('\n'),mentions});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}hidetag`: if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} try{const meta=await sock.groupMetadata(chatId);const mentions=meta.participants.map(p=>p.id);await sock.sendMessage(chatId,{text:argText||'👥',mentions});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}promote`: if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} {const t=msg.extendedTextMessage?.contextInfo?.mentionedJid?.[0];if(!t){await sock.sendMessage(chatId,{text:'Mention user'},{quoted:q});break;} try{await sock.groupParticipantsUpdate(chatId,[t],'promote');await sock.sendMessage(chatId,{text:`✅ Promoted @${t.split('@')[0]}`,mentions:[t]},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});}} break;
        case `${prefix}demote`: if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} {const t=msg.extendedTextMessage?.contextInfo?.mentionedJid?.[0];if(!t){await sock.sendMessage(chatId,{text:'Mention user'},{quoted:q});break;} try{await sock.groupParticipantsUpdate(chatId,[t],'demote');await sock.sendMessage(chatId,{text:`✅ Demoted @${t.split('@')[0]}`,mentions:[t]},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});}} break;
        case `${prefix}kick`: if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} {const t=msg.extendedTextMessage?.contextInfo?.mentionedJid?.[0];if(!t){await sock.sendMessage(chatId,{text:'Mention user'},{quoted:q});break;} try{await sock.groupParticipantsUpdate(chatId,[t],'remove');await sock.sendMessage(chatId,{text:`✅ Kicked @${t.split('@')[0]}`,mentions:[t]},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});}} break;
        case `${prefix}add`: if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} {const n=args[0]?.replace(/[^0-9]/g,'');if(!n){await sock.sendMessage(chatId,{text:'Usage: .add <number>'},{quoted:q});break;} try{await sock.groupParticipantsUpdate(chatId,[`${n}@s.whatsapp.net`],'add');await sock.sendMessage(chatId,{text:`✅ Added ${n}`},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});}} break;
        case `${prefix}ginfo`: if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} try{const meta=await sock.groupMetadata(chatId);await sock.sendMessage(chatId,{text:`📋 *${meta.subject}*\n*Members:* ${meta.participants.length}\n*Admins:* ${meta.participants.filter(p=>p.admin).length}\n*Desc:* ${meta.desc||'None'}`},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}link`: case`${prefix}grouplink`: if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} try{const c=await sock.groupInviteCode(chatId);await sock.sendMessage(chatId,{text:`🔗 https://chat.whatsapp.com/${c}`},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}resetlink`: if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} try{await sock.groupRevokeInvite(chatId);await sock.sendMessage(chatId,{text:'✅ Link reset'},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}setgroupname`: if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} if(!argText){await sock.sendMessage(chatId,{text:'Usage: .setgroupname <name>'},{quoted:q});break;} try{await sock.groupUpdateSubject(chatId,argText);await sock.sendMessage(chatId,{text:`✅ Name: ${argText}`},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}setdesc`: if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} if(!argText){await sock.sendMessage(chatId,{text:'Usage: .setdesc <desc>'},{quoted:q});break;} try{await sock.groupUpdateDescription(chatId,argText);await sock.sendMessage(chatId,{text:'✅ Desc updated'},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}leave`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} await sock.sendMessage(chatId,{text:'👋 Bye!'},{quoted:q}); await sock.groupLeave(chatId); break;
        case `${prefix}join`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} {const l=args[0];if(!l?.includes('chat.whatsapp.com')){await sock.sendMessage(chatId,{text:'Usage: .join <link>'},{quoted:q});break;} try{await sock.groupAcceptInvite(l.split('/').pop());await sock.sendMessage(chatId,{text:'✅ Joined'},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});}} break;
        case `${prefix}getpp`: {const t=msg.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||(isGroup?participant:chatId);if(!t){await sock.sendMessage(chatId,{text:'Mention user'},{quoted:q});break;} try{const u=await sock.profilePictureUrl(t,'image');const r=await axios.get(u,{responseType:'arraybuffer',timeout:15000});await sock.sendMessage(chatId,{image:Buffer.from(r.data),caption:`📸 ${t.split('@')[0]}`},{quoted:q});}catch{await sock.sendMessage(chatId,{text:'❌ No PP'},{quoted:q});}} break;
        case `${prefix}totalmembers`: if(!isGroup){await sock.sendMessage(chatId,{text:'Group only'},{quoted:q});break;} try{const meta=await sock.groupMetadata(chatId);await sock.sendMessage(chatId,{text:`👥 *${meta.participants.length} members*`},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        // ANTI
        case `${prefix}antilink`: await toggleAnti('antilink','link'); break;
        case `${prefix}antispam`: await toggleAnti('antispam','spam'); break;
        case `${prefix}antibadword`: await toggleAnti('antibadword','badword'); break;
        case `${prefix}antidelete`: await toggleAnti('antidelete','delete'); break;
        case `${prefix}antimention`: await toggleAnti('antimention','mention'); break;
        case `${prefix}antitag`: await toggleAnti('antitag','tag'); break;
        case `${prefix}antisticker`: await toggleAnti('antisticker','sticker'); break;
        case `${prefix}anticall`: {const on=argText==='on';dbSet('anticall',on?'1':'0');await sock.sendMessage(chatId,{text:`${on?'✅':'❌'} Anti-call ${on?'ON':'OFF'}`},{quoted:q});} break;
        case `${prefix}antidemote`: await toggleAnti('antidemote','demote'); break;
        case `${prefix}antipromote`: await toggleAnti('antipromote','promote'); break;
        case `${prefix}antiviewonce`: await toggleAnti('antiviewonce','viewonce'); break;
        case `${prefix}antiaudio`: await toggleAnti('antiaudio','audio'); break;
        case `${prefix}antiimage`: await toggleAnti('antiimage','image'); break;
        case `${prefix}antivideo`: await toggleAnti('antivideo','video'); break;
        case `${prefix}antivoice`: await toggleAnti('antivoice','voice'); break;
        // DOWNLOAD
        case `${prefix}song`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .song <name>'},{quoted:q});break;} await sock.sendMessage(chatId,{text:`🎵 ${argText}...`},{quoted:q}); try{const{spawnSync}=require('child_process');const tf=`/tmp/s-${Date.now()}.mp3`;const r=spawnSync('yt-dlp',['--no-playlist','--no-warnings','--retries','3','--extract-audio','--audio-format','mp3','--audio-quality','0','-o',tf,`ytsearch1:${argText.replace(/["']/g,'')}`],{timeout:180000,encoding:'utf-8',maxBuffer:20*1024*1024});if(r.status!==0||!fs.existsSync(tf)){const err=(r.stderr||r.stdout||'').split('\n').filter(l=>l.includes('ERROR')).join(' ').slice(0,200);throw new Error(err||'Download failed');}const b=fs.readFileSync(tf);const tm=(r.stdout||'').match(/\[info\] \w+: (.+)/);const t=tm?tm[1].split(' [')[0].trim():argText;await sock.sendMessage(chatId,{audio:b,mimetype:'audio/mpeg',fileName:`${t}.mp3`,caption:`🎵 *${t}*`},{quoted:q});fs.unlinkSync(tf);}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}video`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .video <name>'},{quoted:q});break;} await sock.sendMessage(chatId,{text:`🎬 ${argText}...`},{quoted:q}); try{const{spawnSync}=require('child_process');const tf=`/tmp/v-${Date.now()}.mp4`;const r=spawnSync('yt-dlp',['--no-playlist','--no-warnings','--retries','3','-f','best[ext=mp4][filesize<60M]/best[ext=mp4]/best','--merge-output-format','mp4','-o',tf,`ytsearch1:${argText.replace(/["']/g,'')}`],{timeout:240000,encoding:'utf-8',maxBuffer:20*1024*1024});if(r.status!==0||!fs.existsSync(tf)){const err=(r.stderr||r.stdout||'').split('\n').filter(l=>l.includes('ERROR')).join(' ').slice(0,200);throw new Error(err||'Download failed');}const b=fs.readFileSync(tf);if(b.length>60*1024*1024){fs.unlinkSync(tf);throw new Error('Too large');}const tm=(r.stdout||'').match(/\[info\] \w+: (.+)/);const t=tm?tm[1].split(' [')[0].trim():argText;await sock.sendMessage(chatId,{video:b,mimetype:'video/mp4',fileName:`${t}.mp4`,caption:`🎬 *${t}*\n_${(b.length/1024/1024).toFixed(1)} MB_`},{quoted:q});fs.unlinkSync(tf);}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        // MEDIA
        case `${prefix}tts`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .tts <text>'},{quoted:q});break;} try{const r=await axios.get(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(argText)}&tl=en&client=tw-ob`,{responseType:'arraybuffer',timeout:15000});await sock.sendMessage(chatId,{audio:Buffer.from(r.data),mimetype:'audio/mpeg'},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}translate`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .translate <text>'},{quoted:q});break;} try{const r=await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(argText)}`,{timeout:10000});await sock.sendMessage(chatId,{text:`🌐 ${r.data[0].map(t=>t[0]).join('')}`},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}vv`: case`${prefix}vv2`: case`${prefix}vv3`: {if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;}const qm=msg.extendedTextMessage?.contextInfo?.quotedMessage;if(!qm){await sock.sendMessage(chatId,{text:'Reply to view-once'},{quoted:q});break;}try{const tm={key:{remoteJid:chatId,id:msg.extendedTextMessage.contextInfo.stanzaId,participant:msg.extendedTextMessage.contextInfo.participant,fromMe:msg.extendedTextMessage.contextInfo.fromMe||false},message:qm};const buf=await downloadMediaMessage(tm,'buffer',{}, {logger:P({level:'silent'}),reuploadRequest:sock.updateMediaMessage});const b=Buffer.from(buf);let mt='image',mm='image/jpeg';if(qm.videoMessage){mt='video';mm=qm.videoMessage.mimetype||'video/mp4';}else if(qm.audioMessage){mt='audio';mm=qm.audioMessage.mimetype||'audio/mpeg';}if(mt==='video')await sock.sendMessage(chatId,{video:b,mimetype:mm,caption:'🔓 Unlocked'},{quoted:q});else if(mt==='audio')await sock.sendMessage(chatId,{audio:b,mimetype:mm},{quoted:q});else await sock.sendMessage(chatId,{image:b,mimetype:mm,caption:'🔓 Unlocked'},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});}} break;
        // FUN
        case `${prefix}8ball`: {const a=['It is certain.','Yes.','Most likely.','Ask again later.','No.','Very doubtful.'];await sock.sendMessage(chatId,{text:`🎱 ${a[Math.floor(Math.random()*a.length)]}`},{quoted:q});} break;
        case `${prefix}truth`: {const t=['Biggest fear?','Most embarrassing moment?','Biggest secret?','Who is your crush?'];await sock.sendMessage(chatId,{text:`🤔 ${t[Math.floor(Math.random()*t.length)]}`},{quoted:q});} break;
        case `${prefix}dare`: {const d=['Send a voice note singing.','Send your last screenshot.','Text first contact "I love you".'];await sock.sendMessage(chatId,{text:`😈 ${d[Math.floor(Math.random()*d.length)]}`},{quoted:q});} break;
        case `${prefix}joke`: try{const r=await axios.get('https://v2.jokeapi.dev/joke/Any?safe-mode&type=single',{timeout:10000});await sock.sendMessage(chatId,{text:`😂 ${r.data.joke}`},{quoted:q});}catch{await sock.sendMessage(chatId,{text:'😂 Why dont programmers like nature? Too many bugs.'},{quoted:q});} break;
        case `${prefix}quote`: try{const r=await axios.get('https://api.quotable.io/random',{timeout:10000});await sock.sendMessage(chatId,{text:`💬 *${r.data.content}*\n\n— ${r.data.author}`},{quoted:q});}catch{await sock.sendMessage(chatId,{text:'💬 *The only way to do great work is to love what you do.*\n\n— Steve Jobs'},{quoted:q});} break;
        case `${prefix}fact`: {const f=['Honey never spoils.','Octopuses have three hearts.','The shortest war lasted 38 minutes.'];await sock.sendMessage(chatId,{text:`🧠 ${f[Math.floor(Math.random()*f.length)]}`},{quoted:q});} break;
        case `${prefix}pickupline`: {const l=['Are you Wi-Fi? Because Im feeling a connection.','Is your name Google? You have everything.'];await sock.sendMessage(chatId,{text:`😏 ${l[Math.floor(Math.random()*l.length)]}`},{quoted:q});} break;
        case `${prefix}rps`: {const c=['rock','paper','scissors'];const bc=c[Math.floor(Math.random()*3)];const uc=args[0]?.toLowerCase();if(!uc||!c.includes(uc)){await sock.sendMessage(chatId,{text:'Usage: .rps <rock|paper|scissors>'},{quoted:q});break;}const r=uc===bc?'Tie! 🤝':((uc==='rock'&&bc==='scissors')||(uc==='paper'&&bc==='rock')||(uc==='scissors'&&bc==='paper'))?'You win! 🎉':'I win! 🤖';await sock.sendMessage(chatId,{text:`🪨📄✂️\n\nYou: ${uc}\nBot: ${bc}\n\n${r}`},{quoted:q});} break;
        case `${prefix}ship`: {const u1=args[0]||'Romeo';const u2=args[1]||'Juliet';const p=Math.floor(Math.random()*100);await sock.sendMessage(chatId,{text:`💞 ${u1} ❤️ ${u2}\n\n${p}% ${p>80?'💕':p>50?'💖':p>30?'💔':'❌'}`},{quoted:q});} break;
        case `${prefix}flip`: await sock.sendMessage(chatId,{text:`🪙 ${Math.random()<0.5?'Heads':'Tails'}`},{quoted:q}); break;
        case `${prefix}dice`: {const s=parseInt(args[0])||6;await sock.sendMessage(chatId,{text:`🎲 ${Math.floor(Math.random()*s)+1} (d${s})`},{quoted:q});} break;
        case `${prefix}choose`: {const o=argText.split(',').map(x=>x.trim()).filter(x=>x);if(o.length<2){await sock.sendMessage(chatId,{text:'Usage: .choose a, b, c'},{quoted:q});break;}await sock.sendMessage(chatId,{text:`🤔 *${o[Math.floor(Math.random()*o.length)]}*`},{quoted:q});} break;
        case `${prefix}shrug`: await sock.sendMessage(chatId,{text:'¯\\_(ツ)_/¯'},{quoted:q}); break;
        // SEARCH
        case `${prefix}weather`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .weather <city>'},{quoted:q});break;} try{const r=await axios.get(`https://wttr.in/${encodeURIComponent(argText)}?format=3`,{timeout:10000});await sock.sendMessage(chatId,{text:`🌤️ ${r.data}`},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}wiki`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .wiki <query>'},{quoted:q});break;} try{const r=await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(argText)}`,{timeout:10000});await sock.sendMessage(chatId,{text:`📖 *${r.data.title}*\n\n${r.data.extract}`},{quoted:q});}catch{await sock.sendMessage(chatId,{text:'❌ Not found'},{quoted:q});} break;
        case `${prefix}define`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .define <word>'},{quoted:q});break;} try{const r=await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(argText)}`,{timeout:10000});const d=r.data[0];await sock.sendMessage(chatId,{text:`📖 *${argText}* (${d.meanings[0].partOfSpeech})\n\n${d.meanings[0].definitions[0].definition}`},{quoted:q});}catch{await sock.sendMessage(chatId,{text:'❌ Not found'},{quoted:q});} break;
        case `${prefix}shorten`: if(!args[0]){await sock.sendMessage(chatId,{text:'Usage: .shorten <url>'},{quoted:q});break;} try{const r=await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(args[0])}`,{timeout:10000});await sock.sendMessage(chatId,{text:`🔗 ${r.data}`},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        // TOOLS
        case `${prefix}calc`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .calc <expr>'},{quoted:q});break;} try{const s=argText.replace(/[^0-9+\-*/().%\s]/g,'');if(!s)throw 0;const r=Function('"use strict";return('+s+')')();await sock.sendMessage(chatId,{text:`🔢 ${argText} = *${r}*`},{quoted:q});}catch{await sock.sendMessage(chatId,{text:'❌ Invalid'},{quoted:q});} break;
        case `${prefix}qr`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .qr <text>'},{quoted:q});break;} try{const r=await axios.get(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(argText)}`,{responseType:'arraybuffer',timeout:15000});await sock.sendMessage(chatId,{image:Buffer.from(r.data),caption:'📱 QR'},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}uuid`: await sock.sendMessage(chatId,{text:`🆔 ${require('crypto').randomUUID()}`},{quoted:q}); break;
        case `${prefix}pass`: {const len=parseInt(args[0])||12;const ch='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';let p='';for(let i=0;i<Math.min(len,50);i++)p+=ch[Math.floor(Math.random()*ch.length)];await sock.sendMessage(chatId,{text:`🔐 ${p}`},{quoted:q});} break;
        case `${prefix}reverse`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .reverse <text>'},{quoted:q});break;} await sock.sendMessage(chatId,{text:`🔄 ${argText.split('').reverse().join('')}`},{quoted:q}); break;
        case `${prefix}count`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .count <text>'},{quoted:q});break;} await sock.sendMessage(chatId,{text:`📊 Chars: ${argText.length}\nWords: ${argText.split(/\s+/).filter(w=>w).length}`},{quoted:q}); break;
        case `${prefix}base64`: {const sub=args[0]?.toLowerCase();const t=args.slice(1).join(' ');if(!sub||!t){await sock.sendMessage(chatId,{text:'Usage: .base64 encode <text>\n       .base64 decode <text>'},{quoted:q});break;} try{const r=sub==='encode'?Buffer.from(t).toString('base64'):Buffer.from(t,'base64').toString('utf-8');await sock.sendMessage(chatId,{text:`🔐 ${r}`},{quoted:q});}catch{await sock.sendMessage(chatId,{text:'❌ Invalid'},{quoted:q});}} break;
        case `${prefix}hash`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .hash <text>'},{quoted:q});break;} {const c=require('crypto');await sock.sendMessage(chatId,{text:`#️⃣ MD5: ${c.createHash('md5').update(argText).digest('hex')}\nSHA256: ${c.createHash('sha256').update(argText).digest('hex')}`},{quoted:q});} break;
        case `${prefix}fliptext`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .fliptext <text>'},{quoted:q});break;} {const m={'a':'ɐ','b':'q','c':'ɔ','d':'p','e':'ǝ','f':'ɟ','g':'ƃ','h':'ɥ','i':'ᴉ','j':'ɾ','k':'ʞ','l':'l','m':'ɯ','n':'u','o':'o','p':'d','q':'b','r':'ɹ','s':'s','t':'ʇ','u':'n','v':'ʌ','w':'ʍ','x':'x','y':'ʎ','z':'z'};let r='';for(const ch of argText)r+=m[ch.toLowerCase()]||ch;await sock.sendMessage(chatId,{text:`🔄 ${r.split('').reverse().join('')}`},{quoted:q});} break;
        // AI
        case `${prefix}ai`: case`${prefix}ask`: if(!argText){await sock.sendMessage(chatId,{text:'Usage: .ai <question>'},{quoted:q});break;} try{const key=getGeminiKey();if(!key){await sock.sendMessage(chatId,{text:'❌ .setgeminikey <key>'},{quoted:q});break;} await sock.sendPresenceUpdate('composing',chatId);const res=await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,{contents:[{parts:[{text:`You are Snuggle X. Reply concisely. User: ${argText}`}]}]},{timeout:30000,headers:{'Content-Type':'application/json'}});const ai=res.data?.candidates?.[0]?.content?.parts?.[0]?.text;await sock.sendMessage(chatId,{text:ai?.trim()||'❌ No response'},{quoted:q});}catch(e){await sock.sendMessage(chatId,{text:`❌ ${e.message}`},{quoted:q});} break;
        case `${prefix}chatbot`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} if(argText==='on'){dbSet('chatbot','1');await sock.sendMessage(chatId,{text:'✅ Chatbot ON'},{quoted:q});}else if(argText==='off'){dbSet('chatbot','0');await sock.sendMessage(chatId,{text:'❌ Chatbot OFF'},{quoted:q});}else{await sock.sendMessage(chatId,{text:`*Chatbot:* ${dbGet('chatbot','0')==='1'?'ON ✅':'OFF ❌'}\nUsage: .chatbot on/off`},{quoted:q});} break;
        case `${prefix}setgeminikey`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} if(!argText){await sock.sendMessage(chatId,{text:'Usage: .setgeminikey <key>'},{quoted:q});break;} dbSet('geminiKey',argText.trim());await sock.sendMessage(chatId,{text:'✅ Key set'},{quoted:q}); break;
        // SETTINGS
        case `${prefix}autofaketyping`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} {const on=argText==='on';dbSet('faketyping',on?'1':'0');await sock.sendMessage(chatId,{text:`${on?'✅':'❌'} Fake typing ${on?'ON':'OFF'}`},{quoted:q});} break;
        case `${prefix}autofakerecording`: if(!ownerCheck){await sock.sendMessage(chatId,{text:'> *only owner* 🚫'},{quoted:q});break;} {const on=argText==='on';dbSet('fakerecording',on?'1':'0');await sock.sendMessage(chatId,{text:`${on?'✅':'❌'} Fake recording ${on?'ON':'OFF'}`},{quoted:q});} break;
        default: if(cmd.startsWith(prefix)) await sock.sendMessage(chatId,{text:`Unknown: ${cmd}\nType *${prefix}menu*`},{quoted:q});
      }
    } catch (e) { console.error('[MSG]', e.message); }
  });

  // Anti-call
  sock.ev.on('call', async (calls) => { try { for (const c of calls) await sock.rejectCall(c.id, c.from); } catch {} });
}

console.log('========================================');
console.log('  SNUGGLE X ULTRA v1.0.0');
console.log('========================================');
start().catch(console.error);
