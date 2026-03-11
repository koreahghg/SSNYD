const { EmbedBuilder } = require('discord.js');
const { getUser, updateBalance } = require('./db');

function parseBet(arg, balance) {
    if (!arg) return { error: '❌ 베팅 금액을 입력하세요.' };
    const lower = arg.toLowerCase();
    let amount;

    if (lower === '올인' || lower === 'all') {
        amount = Math.min(balance, 50000);
    } else if (lower === '반' || lower === 'half') {
        amount = Math.min(Math.floor(balance / 2), 50000);
    } else {
        amount = parseInt(arg);
        if (isNaN(amount)) return { error: '❌ 올바른 베팅 금액을 입력하세요.' };
    }

    if (amount < 1000)    return { error: '❌ 최소 베팅 금액은 1,000원입니다.' };
    if (amount > 50000)   return { error: '❌ 최대 베팅 금액은 50,000원입니다.' };
    if (amount > balance) return { error: '❌ 잔액이 부족합니다.' };
    return { amount };
}

function fmt(n) {
    return (n >= 0 ? '+' : '') + n.toLocaleString() + '원';
}

// ─── COINFLIP ────────────────────────────────────────────────────────────────

async function handleCoinflip(message, args) {
    const user = getUser(message.author.id, message.author.username);
    const { error, amount } = parseBet(args[0], user.balance);
    if (error) return message.reply(error);

    const win   = Math.random() < 0.5;
    const delta = win ? amount : -amount;
    updateBalance(message.author.id, delta);
    const updated = getUser(message.author.id, message.author.username);

    const embed = new EmbedBuilder()
        .setColor(win ? 0x22C55E : 0xEF4444)
        .setTitle('🪙 코인플립')
        .addFields(
            { name: '결과',     value: win ? '앞면 🪙 승리!' : '뒷면 💀 패배', inline: false },
            { name: '베팅',     value: `${amount.toLocaleString()}원`,          inline: true  },
            { name: '손익',     value: fmt(delta),                              inline: true  },
            { name: '현재 잔액', value: `${updated.balance.toLocaleString()}원`, inline: true  }
        );
    message.reply({ embeds: [embed] });
}

// ─── BLACKJACK ───────────────────────────────────────────────────────────────

const SUITS  = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
    const deck = [];
    for (const s of SUITS) for (const v of VALUES) deck.push({ s, v });
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function bjVal(card) {
    if (card.v === 'A') return 11;
    if (['J', 'Q', 'K'].includes(card.v)) return 10;
    return parseInt(card.v);
}

function bjHandVal(hand) {
    let total = hand.reduce((s, c) => s + bjVal(c), 0);
    let aces  = hand.filter(c => c.v === 'A').length;
    while (total > 21 && aces-- > 0) total -= 10;
    return total;
}

function bjHandStr(hand, hideSecond = false) {
    return hand.map((c, i) => hideSecond && i === 1 ? '🂠' : `${c.s}${c.v}`).join('  ');
}

const bjGames = new Map();

async function handleBlackjack(message, args) {
    if (bjGames.has(message.author.id))
        return message.reply('❌ 이미 진행 중인 게임이 있습니다. `!히트` 또는 `!스탠드`로 진행하세요.');

    const user = getUser(message.author.id, message.author.username);
    const { error, amount } = parseBet(args[0], user.balance);
    if (error) return message.reply(error);

    updateBalance(message.author.id, -amount);

    const deck   = createDeck();
    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];
    const pVal   = bjHandVal(player);
    const dVal   = bjHandVal(dealer);

    if (pVal === 21) {
        let delta, resultText;
        if (dVal === 21) {
            updateBalance(message.author.id, amount);
            delta = 0; resultText = '🤝 무승부 (블랙잭 vs 블랙잭)';
        } else {
            updateBalance(message.author.id, amount * 2);
            delta = amount; resultText = '🎉 블랙잭! 승리!';
        }
        const updated = getUser(message.author.id, message.author.username);
        const embed = new EmbedBuilder()
            .setColor(delta >= 0 ? 0xF59E0B : 0x6B7280)
            .setTitle('🃏 블랙잭')
            .addFields(
                { name: '내 패',  value: `${bjHandStr(player)} (${pVal})`, inline: false },
                { name: '딜러 패', value: `${bjHandStr(dealer)} (${dVal})`, inline: false },
                { name: '결과',    value: resultText,                       inline: true  },
                { name: '손익',    value: fmt(delta),                       inline: true  },
                { name: '현재 잔액', value: `${updated.balance.toLocaleString()}원`, inline: true }
            );
        return message.reply({ embeds: [embed] });
    }

    bjGames.set(message.author.id, { deck, player, dealer, bet: amount, channelId: message.channel.id });

    const embed = new EmbedBuilder()
        .setColor(0x3B82F6)
        .setTitle('🃏 블랙잭')
        .addFields(
            { name: '내 패',  value: `${bjHandStr(player)} (${pVal})`, inline: false },
            { name: '딜러 패', value: bjHandStr(dealer, true),          inline: false }
        )
        .setFooter({ text: '!히트 — 카드 추가  |  !스탠드 — 멈추기' });
    message.reply({ embeds: [embed] });
}

async function handleBjHit(message) {
    const game = bjGames.get(message.author.id);
    if (!game || game.channelId !== message.channel.id) return;

    game.player.push(game.deck.pop());
    const val = bjHandVal(game.player);

    if (val > 21) {
        bjGames.delete(message.author.id);
        const updated = getUser(message.author.id, message.author.username);
        const embed = new EmbedBuilder()
            .setColor(0xEF4444)
            .setTitle('🃏 블랙잭')
            .addFields(
                { name: '내 패',   value: `${bjHandStr(game.player)} (${val})`,             inline: false },
                { name: '딜러 패', value: `${bjHandStr(game.dealer)} (${bjHandVal(game.dealer)})`, inline: false },
                { name: '결과',    value: '💥 버스트! 패배',                                  inline: true  },
                { name: '손익',    value: fmt(-game.bet),                                     inline: true  },
                { name: '현재 잔액', value: `${updated.balance.toLocaleString()}원`,          inline: true  }
            );
        return message.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
        .setColor(0x3B82F6)
        .setTitle('🃏 블랙잭')
        .addFields(
            { name: '내 패',  value: `${bjHandStr(game.player)} (${val})`, inline: false },
            { name: '딜러 패', value: bjHandStr(game.dealer, true),         inline: false }
        )
        .setFooter({ text: '!히트 — 카드 추가  |  !스탠드 — 멈추기' });
    message.reply({ embeds: [embed] });
}

async function handleBjStand(message) {
    const game = bjGames.get(message.author.id);
    if (!game || game.channelId !== message.channel.id) return;

    bjGames.delete(message.author.id);

    while (bjHandVal(game.dealer) < 17) game.dealer.push(game.deck.pop());

    const pVal = bjHandVal(game.player);
    const dVal = bjHandVal(game.dealer);

    let delta, resultText;
    if (dVal > 21 || pVal > dVal) {
        delta = game.bet; resultText = '🎉 승리!';
        updateBalance(message.author.id, game.bet * 2);
    } else if (pVal === dVal) {
        delta = 0; resultText = '🤝 무승부';
        updateBalance(message.author.id, game.bet);
    } else {
        delta = -game.bet; resultText = '😔 패배';
    }

    const updated = getUser(message.author.id, message.author.username);
    const embed = new EmbedBuilder()
        .setColor(delta > 0 ? 0x22C55E : delta === 0 ? 0x6B7280 : 0xEF4444)
        .setTitle('🃏 블랙잭')
        .addFields(
            { name: '내 패',   value: `${bjHandStr(game.player)} (${pVal})`, inline: false },
            { name: '딜러 패', value: `${bjHandStr(game.dealer)} (${dVal})`, inline: false },
            { name: '결과',    value: resultText,                             inline: true  },
            { name: '손익',    value: fmt(delta),                            inline: true  },
            { name: '현재 잔액', value: `${updated.balance.toLocaleString()}원`, inline: true }
        );
    message.reply({ embeds: [embed] });
}

// ─── BACCARAT ────────────────────────────────────────────────────────────────

function bacVal(card) {
    if (['10', 'J', 'Q', 'K'].includes(card.v)) return 0;
    if (card.v === 'A') return 1;
    return parseInt(card.v);
}

function bacHandVal(hand) {
    return hand.reduce((s, c) => s + bacVal(c), 0) % 10;
}

async function handleBaccarat(message, args) {
    const user = getUser(message.author.id, message.author.username);
    const { error, amount } = parseBet(args[0], user.balance);
    if (error) return message.reply(error);

    const side = args[1]?.toLowerCase();
    const bankerSides  = ['뱅커', 'b', 'banker'];
    const playerSides  = ['플레이어', 'p', 'player'];
    if (![...bankerSides, ...playerSides].includes(side))
        return message.reply('❌ 베팅할 곳을 지정하세요.\n예: `!바카라 1000 플레이어` 또는 `!바카라 1000 뱅커`');

    const betBanker = bankerSides.includes(side);
    const sideLabel = betBanker ? '뱅커' : '플레이어';

    const deck   = createDeck();
    const player = [deck.pop(), deck.pop()];
    const banker = [deck.pop(), deck.pop()];

    let pVal = bacHandVal(player);
    let bVal = bacHandVal(banker);

    if (pVal <= 5 && pVal < 8 && bVal < 8) {
        const pThird = deck.pop();
        player.push(pThird);
        pVal = bacHandVal(player);
        const pt = bacVal(pThird);

        if      (bVal <= 2)                          banker.push(deck.pop());
        else if (bVal === 3 && pt !== 8)             banker.push(deck.pop());
        else if (bVal === 4 && pt >= 2 && pt <= 7)  banker.push(deck.pop());
        else if (bVal === 5 && pt >= 4 && pt <= 7)  banker.push(deck.pop());
        else if (bVal === 6 && pt >= 6 && pt <= 7)  banker.push(deck.pop());
    } else if (bVal <= 5 && bVal < 8 && pVal >= 6) {
        banker.push(deck.pop());
    }

    bVal = bacHandVal(banker);
    pVal = bacHandVal(player);

    const winner = pVal > bVal ? 'player' : bVal > pVal ? 'banker' : 'tie';
    const tie    = winner === 'tie';
    const userWin = (!betBanker && winner === 'player') || (betBanker && winner === 'banker');

    let delta;
    if (tie)          delta = 0;
    else if (userWin) delta = Math.floor(amount * 0.95);
    else              delta = -amount;

    updateBalance(message.author.id, delta);
    const updated = getUser(message.author.id, message.author.username);

    const resultText = tie ? '🤝 무승부 (베팅 반환)' : userWin ? '🎉 승리!' : '😔 패배';
    const embed = new EmbedBuilder()
        .setColor(tie ? 0x6B7280 : userWin ? 0x22C55E : 0xEF4444)
        .setTitle('🎴 바카라')
        .addFields(
            { name: '내 베팅',   value: sideLabel,                                    inline: true  },
            { name: '결과',      value: `플레이어 **${pVal}** vs 뱅커 **${bVal}**`,   inline: true  },
            { name: '판정',      value: resultText,                                   inline: false },
            { name: '손익',      value: fmt(delta),                                   inline: true  },
            { name: '현재 잔액', value: `${updated.balance.toLocaleString()}원`,       inline: true  }
        );
    message.reply({ embeds: [embed] });
}

// ─── ROULETTE ────────────────────────────────────────────────────────────────

const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

async function handleRoulette(message, args) {
    const user = getUser(message.author.id, message.author.username);
    const { error, amount } = parseBet(args[0], user.balance);
    if (error) return message.reply(error);

    const pick = parseInt(args[1]);
    if (isNaN(pick) || pick < 0 || pick > 36)
        return message.reply('❌ 0~36 사이의 숫자를 입력하세요.\n예: `!룰렛 1000 7`');

    const result = Math.floor(Math.random() * 37);
    const win    = result === pick;
    const color  = result === 0 ? '🟢' : RED_NUMS.has(result) ? '🔴' : '⚫';
    const delta  = win ? amount * 35 : -amount;

    updateBalance(message.author.id, delta);
    const updated = getUser(message.author.id, message.author.username);

    const embed = new EmbedBuilder()
        .setColor(win ? 0xF59E0B : 0xEF4444)
        .setTitle('🎡 룰렛')
        .addFields(
            { name: '내 번호',   value: `${pick}`,                              inline: true  },
            { name: '결과',      value: `${color} **${result}**`,               inline: true  },
            { name: '판정',      value: win ? '🎉 적중!' : '😔 미적중',         inline: true  },
            { name: '손익',      value: fmt(delta),                             inline: true  },
            { name: '현재 잔액', value: `${updated.balance.toLocaleString()}원`, inline: true  }
        );
    message.reply({ embeds: [embed] });
}

module.exports = {
    handleCoinflip,
    handleBlackjack, handleBjHit, handleBjStand,
    handleBaccarat,
    handleRoulette,
};
