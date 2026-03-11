// 1. 주요 클래스 가져오기
const { Client, Events, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

// 2. 클라이언트 객체 생성 (Guilds관련, 메시지관련 인텐트 추가)
const client = new Client({ intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
]});

// 3. 봇이 준비됐을때 한번만(once) 표시할 메시지
client.once(Events.ClientReady, readyClient => {
console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// 4. 누군가 '1'을 작성하면 'pong'으로 답장한다.
client.on('messageCreate', (message) => {
    if(message.content == '1'){
        message.reply('123');
    }
})

// 5. 시크릿키(토큰)을 통해 봇 로그인 실행
client.login(token);