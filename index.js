const { Client, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const token = process.env.DISCORD_TOKEN;

const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
]});

client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

const NEIS_API_KEY = process.env.NEIS_API_KEY || 'c11ea26f8c614f50bd7b19d2f3228e6d';
const ATPT_CODE    = 'F10';
const SCHOOL_CODE  = '7380292';

const https = require('https');

const MEAL_LABELS = { 1: '조식', 2: '중식', 3: '석식' };

function toDateStr(kstDate) {
    const y = kstDate.getUTCFullYear();
    const m = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kstDate.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

function getMealByTime() {
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const h   = kst.getUTCHours();
    const min = kst.getUTCMinutes();
    const t   = h * 60 + min;

    if (t < 7 * 60 + 30)  return { type: 1, dateStr: toDateStr(kst), dayLabel: '오늘' };
    if (t < 12 * 60 + 30) return { type: 2, dateStr: toDateStr(kst), dayLabel: '오늘' };
    if (t < 18 * 60 + 30) return { type: 3, dateStr: toDateStr(kst), dayLabel: '오늘' };
    const tomorrow = new Date(kst.getTime() + 24 * 60 * 60 * 1000);
    return { type: 1, dateStr: toDateStr(tomorrow), dayLabel: '내일' };
}

function fetchMeal(dateStr, mealType) {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo`
              + `?KEY=${NEIS_API_KEY}&Type=json&pIndex=1&pSize=10`
              + `&ATPT_OFCDC_SC_CODE=${ATPT_CODE}`
              + `&SD_SCHUL_CODE=${SCHOOL_CODE}`
              + `&MLSV_YMD=${dateStr}`
              + `&MMEAL_SC_CODE=${mealType}`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(raw);
                    if (!json.mealServiceDietInfo) { resolve(null); return; }
                    const row  = json.mealServiceDietInfo[1].row[0];
                    const menu = row.DDISH_NM
                        .replace(/\*/g, '')
                        .split(/<br\/>/i)
                        .map(item => item.trim())
                        .filter(item => item)
                        .map(item => `- ${item}`)
                        .join('\n');
                    const cal = row.CAL_INFO || '';
                    resolve({ menu, cal });
                } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

const schedules    = [];
const pendingSetup = new Map();

setInterval(() => {
    if (schedules.length === 0) return;
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const h   = kst.getUTCHours();
    const min = kst.getUTCMinutes();
    for (const s of schedules) {
        if (h === s.hour && min === s.minute) {
            s.channel.send(`# ${s.message}`);
        }
    }
}, 60 * 1000);

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();
    const userId  = message.author.id;

    if (pendingSetup.has(userId)) {
        const state = pendingSetup.get(userId);

        if (state.step === 'channel') {
            const mentioned = message.mentions.channels.first();
            if (!mentioned) {
                message.reply('❌ 채널을 멘션해주세요. 예: `#일반`');
                return;
            }
            state.channelObj = mentioned;
            state.step = 'message';
            message.reply('📝 보낼 메세지를 입력해주세요.');
            return;
        }

        if (state.step === 'message') {
            state.message = content;
            state.step = 'time';
            message.reply('⏰ 매일 몇 시에 보낼까요? (형식: `HH:MM`)');
            return;
        }

        if (state.step === 'time') {
            const match = content.match(/^(\d{2}):(\d{2})$/);
            if (!match) {
                message.reply('❌ 형식이 올바르지 않습니다. 예: `23:50`');
                return;
            }
            const hour   = parseInt(match[1]);
            const minute = parseInt(match[2]);
            if (hour > 23 || minute > 59) {
                message.reply('❌ 올바른 시간을 입력하세요. (00:00 ~ 23:59)');
                return;
            }

            schedules.push({ channel: state.channelObj, message: state.message, hour, minute });
            pendingSetup.delete(userId);

            const hh = String(hour).padStart(2, '0');
            const mm = String(minute).padStart(2, '0');
            message.reply(`✅ 매일 **${hh}:${mm}**에 **#${state.channelObj.name}** 채널로 메세지를 보낼게요.`);
            return;
        }
    }

    if (content === '!보내기') {
        pendingSetup.set(userId, { step: 'channel' });
        message.reply('📌 어떤 채널에 보낼까요? 채널을 멘션해주세요. 예: `#일반`');
        return;
    }

    if (content === '!보내기취소') {
        if (pendingSetup.has(userId)) {
            pendingSetup.delete(userId);
            message.reply('✅ 설정을 취소했습니다.');
        } else {
            message.reply('❌ 진행 중인 설정이 없습니다.');
        }
        return;
    }

    if (content === '!알림목록') {
        if (schedules.length === 0) {
            message.reply('📭 등록된 알림이 없습니다.');
        } else {
            const list = schedules.map((s, i) => {
                const hh = String(s.hour).padStart(2, '0');
                const mm = String(s.minute).padStart(2, '0');
                return `${i + 1}. **${hh}:${mm}** → **#${s.channel.name}** — ${s.message}`;
            }).join('\n');
            message.reply(`📋 **등록된 알림 목록**\n${list}`);
        }
        return;
    }

    if (content.startsWith('!알림삭제')) {
        const num = parseInt(content.slice('!알림삭제'.length).trim());
        if (isNaN(num) || num < 1 || num > schedules.length) {
            message.reply(`❌ 올바른 번호를 입력하세요. \`!알림목록\`으로 번호를 확인하세요.`);
        } else {
            schedules.splice(num - 1, 1);
            message.reply(`✅ ${num}번 알림을 삭제했습니다.`);
        }
        return;
    }

    const kst         = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr    = toDateStr(kst);
    const tomorrowStr = toDateStr(new Date(kst.getTime() + 24 * 60 * 60 * 1000));

    let mealType, dayLabel, dateStr;

    if (['!밥', '!ㅂ', '!급식', '!ㄱㅅ'].includes(content)) {
        const info = getMealByTime();
        mealType = info.type; dayLabel = info.dayLabel; dateStr = info.dateStr;
    } else if (content === '!오늘아침') {
        mealType = 1; dayLabel = '오늘'; dateStr = todayStr;
    } else if (content === '!오늘점심') {
        mealType = 2; dayLabel = '오늘'; dateStr = todayStr;
    } else if (content === '!오늘저녁') {
        mealType = 3; dayLabel = '오늘'; dateStr = todayStr;
    } else if (content === '!내일아침') {
        mealType = 1; dayLabel = '내일'; dateStr = tomorrowStr;
    } else if (content === '!내일점심') {
        mealType = 2; dayLabel = '내일'; dateStr = tomorrowStr;
    } else if (content === '!내일저녁') {
        mealType = 3; dayLabel = '내일'; dateStr = tomorrowStr;
    } else {
        return;
    }

    try {
        const result = await fetchMeal(dateStr, mealType);
        if (result) {
            const month = parseInt(dateStr.slice(4, 6));
            const day   = parseInt(dateStr.slice(6, 8));
            const embed = new EmbedBuilder()
                .setColor(0x3B82F6)
                .setTitle(`🍽️ ${month}월 ${day}일 ${MEAL_LABELS[mealType]}`)
                .setDescription(result.menu)
                .setFooter({ text: result.cal });
            message.reply({ embeds: [embed] });
        } else {
            message.reply(`😢 ${dayLabel} ${MEAL_LABELS[mealType]} 급식 정보가 없습니다.`);
        }
    } catch (err) {
        console.error(err);
        message.reply('❌ 급식 정보를 불러오는 중 오류가 발생했습니다.');
    }
});

client.login(token);
