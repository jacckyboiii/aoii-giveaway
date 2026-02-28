const { Client, GatewayIntentBits, Partials } = require('discord.js');
const axios = require("axios");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const TOKEN = process.env.TOKEN
const GOOGLE_API_URL = process.env.GOOGLE_SECRET;
const PREFIX = "/";

client.on("ready", () => {
    console.log(`${client.user.tag} is online!`);
});

// Roblox username → UserId
async function getUserIdFromUsername(username) {
    const response = await axios.post(
        "https://users.roblox.com/v1/usernames/users",
        { usernames: [username], excludeBannedUsers: false }
    );
    if (!response.data.data || response.data.data.length === 0) return null;
    return response.data.data[0].id;
}

// Send to Google Sheet
async function sendToGoogle(userId) {
    try {
        await axios.post(GOOGLE_API_URL, {
    userId: userId,
    secret: process.env.GOOGLE_SECRET
});
    } catch (err) {
        console.error("Failed to send to Google:", err);
    }
}

client.on("messageCreate", async message => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).split(" ");
    const command = args.shift().toLowerCase();

    if (command === "giveaway") {
        const duration = parseInt(args[0]) * 1000;
        if (!duration) return message.reply("Provide time in seconds.");

        const giveawayMsg = await message.channel.send(
            "# 🤑 **VIP GIVEAWAY!** \nReact with 🎉 to enter!"
        );

        await giveawayMsg.react("🎉");

        setTimeout(async () => {
            const fetched = await message.channel.messages.fetch(giveawayMsg.id);
            const reaction = fetched.reactions.cache.get("🎉");

            if (!reaction) return message.channel.send("🥲 No entries...");

            const users = await reaction.users.fetch();
            const valid = users.filter(u => !u.bot);

            if (valid.size === 0) return message.channel.send("📊 No valid users.");

            const winner = valid.random();

            // Announce winner in chat
            message.channel.send(`🎉 Congratulations ${winner}! Check your DMs to claim.`);

            try {
                // DM the winner
                const dm = await winner.send(
                    `🎉 You won the VIP giveaway! Please reply with your **Roblox username** within \n# 24 Hours.`
                );

                const filter = m => m.author.id === winner.id;
                const collected = await dm.channel.awaitMessages({ filter, max: 1, time: 86400000 });

                if (!collected.size) return winner.send("⏰ Time's up! VIP cannot be claimed anymore.");

                const username = collected.first().content;
                const userId = await getUserIdFromUsername(username);

                if (!userId) return winner.send("❌ Invalid username. Try again.");

                await sendToGoogle(userId);
                winner.send("✅ Claimed VIP! Happy AOIIng!");

            } catch (err) {
                message.channel.send(`${winner} has DMs closed or an error occurred.`);
            }

        }, duration);
    }
});


client.login(TOKEN);

