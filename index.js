
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, Events, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const questions = require('./questions.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

let loveChannelId = "";

client.commands = new Collection();

const commands = [
  new SlashCommandBuilder().setName('starttest').setDescription('بدء اختبار التفعيل'),
  new SlashCommandBuilder()
    .setName('setlove')
    .setDescription('تحديد قناة استقبال التقييمات')
    .addChannelOption(option =>
      option.setName('channel').setDescription('حدد القناة').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
client.on('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('❌ Error registering commands:', err);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'starttest') {
    let score = 0;
    let fails = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await interaction.reply({ content: `❓ ${q.question} (صح / خطأ)`, ephemeral: true });
      const filter = m => m.author.id === interaction.user.id;
      try {
        const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] });
        const answer = collected.first().content.toLowerCase();
        if ((answer === 'صح' && q.answer) || (answer === 'خطأ' && !q.answer)) {
          score++;
        } else {
          fails++;
          if (fails >= 5) {
            await interaction.followUp({ content: '❌ تم رفضك بسبب كثرة الإجابات الخاطئة.', ephemeral: true });
            return;
          }
        }
      } catch {
        await interaction.followUp({ content: '⏱️ لم يتم الرد في الوقت المحدد.', ephemeral: true });
        return;
      }
    }

    await interaction.followUp({ content: '✅ اجتزت الاختبار! سيتم إعطاؤك الرتبة قريبًا.', ephemeral: true });

    const dmEmbed = {
      title: '💠 تقييم تجربتك',
      description: 'من فضلك قيّم تعامل الإدارة بعد التفعيل 🌟',
      color: 0x00AE86,
      footer: { text: 'Royal City RP' }
    };

    const row = {
      type: 1,
      components: [1, 2, 3, 4, 5].map(n => ({
        type: 2,
        label: `${n} ⭐`,
        style: 1,
        custom_id: `rate_${n}`
      }))
    };

    try {
      await interaction.user.send({ embeds: [dmEmbed], components: [row] });
    } catch (err) {
      console.error('❌ لم يتمكن من إرسال رسالة التقييم إلى الخاص.');
    }
  }

  if (interaction.commandName === 'setlove') {
    const channel = interaction.options.getChannel('channel');
    loveChannelId = channel.id;
    await interaction.reply({ content: `✅ تم تحديد قناة استقبال التقييمات: ${channel}`, ephemeral: true });
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId.startsWith('rate_')) {
    const rating = interaction.customId.split('_')[1];
    if (loveChannelId) {
      const loveEmbed = {
        title: '⭐ تقييم جديد',
        description: `العضو <@${interaction.user.id}> قام بتقييم الإدارة: **${rating} نجوم**`,
        color: 0xFFD700
      };
      const channel = await client.channels.fetch(loveChannelId);
      if (channel) channel.send({ embeds: [loveEmbed] });
    }
    await interaction.reply({ content: '✅ تم تسجيل تقييمك، شكرًا لك!', ephemeral: true });
  }
});

client.login(process.env.TOKEN);
