const { EmbedBuilder } = require("discord.js");
const { searchTracks } = require("./spotify");


function buildTrackEmbed(track, title, color) {
  const artists = track.artists.map((a) => a.name).join(", ");
  const albumArt = track.album?.images?.[0]?.url;
  const spotifyUrl = track.external_urls?.spotify;
  const preview = track.preview_url;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      { name: "🎵 제목", value: track.name, inline: true },
      { name: "🎤 아티스트", value: artists, inline: true },
      {
        name: "💿 앨범",
        value: track.album?.name ?? "알 수 없음",
        inline: false,
      },
    );

  if (albumArt) embed.setThumbnail(albumArt);
  if (spotifyUrl) embed.setURL(spotifyUrl);
  if (preview)
    embed.setFooter({
      text: "🔗 제목을 클릭하면 Spotify에서 열립니다 | 미리듣기: " + preview,
    });
  else embed.setFooter({ text: "🔗 제목을 클릭하면 Spotify에서 열립니다" });

  return embed;
}

const RECOMMEND_CMDS = ["!노추", "!노래", "!오노추"];

async function handleMusic(message) {
  const content = message.content.trim();

  const recCmd = RECOMMEND_CMDS.find(
    (cmd) => content === cmd || content.startsWith(cmd + " "),
  );
  if (recCmd) {
    const RANDOM_QUERIES = [
      "year:2024", "year:2023", "year:2022", "year:2025",
      "pop hits", "k-pop", "hip-hop", "indie", "r&b", "rock",
    ];

    try {
      const query = RANDOM_QUERIES[Math.floor(Math.random() * RANDOM_QUERIES.length)];
      const offset = Math.floor(Math.random() * 10) * 10;
      const data = await searchTracks(query, 10, offset);
      const tracks = data.tracks?.items;
      if (!tracks || tracks.length === 0) {
        message.reply("😢 추천 곡을 찾지 못했습니다. 다시 시도해보세요.");
        return true;
      }

      const picked = tracks[Math.floor(Math.random() * tracks.length)];
      const embed = buildTrackEmbed(picked, "🎧 랜덤 추천 노래", 0x1db954);
      message.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.reply("❌ Spotify API 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
    return true;
  }

  if (content.startsWith("!가수 ")) {
    const query = content.slice("!가수 ".length).trim();
    if (!query) {
      message.reply("❌ 검색어를 입력해주세요. 예: `!가수 아이유`");
      return true;
    }

    try {
      const data = await searchTracks(query, 10);
      const tracks = data.tracks?.items;
      if (!tracks || tracks.length === 0) {
        message.reply(`😢 **${query}** 검색 결과가 없습니다.`);
        return true;
      }

      const unique = [...new Map(tracks.map((t) => [t.id, t])).values()];
      const picked = unique[Math.floor(Math.random() * unique.length)];
      const embed = buildTrackEmbed(picked, `🔍 "${query}" 검색 결과`, 0x5865f2);
      message.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.reply(
        "❌ Spotify API 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      );
    }
    return true;
  }

  return false;
}

module.exports = { handleMusic };
