//const axios = require('axios');
//const eris = require('eris');

import eris from 'eris';
import { 
    commandGet,
    commandExec,
    loggaa } from './funcs.js';


//HOT SHIT
const discordToken = process.env.DISCORD_TOKEN

///SPOTIFY API
//axios.get('https://accounts.spotify.com/authorize?client:id='+{auth.spotifyToken}&response_type=code&redirect:uri=https://www.henkimaailma.net/callback');

const bot = eris(discordToken);
const PREFIX = 'jives!';

bot.on('ready', () => {
    console.log('Jives herätetty kauneusunilta, muutokset näkyy?')
})


bot.on('messageCreate', async (msg) => {
    const content = msg.content;

    // Ignore any messages sent as direct messages.
    // The bot will only accept commands issued in
    // a guild.
    if (!msg.channel.guild) {
        return;
    }

    // Ignore any message that doesn't start with the correct prefix.
    if (!content.startsWith(PREFIX)) {
        return;
    }

    // Extract the parts of the command and the command name
    const parts = content.split(' ');
    const commandName = content.split(' ')[1];
    
    // Get the appropriate handler for the command, if there is one.
    let commandIndex = await commandGet(commandName);
    if (commandIndex===-1) {
      return;
    }

    // Separate the command arguments from the command prefix and command name.
    const args = parts.slice(2);
    //loggaa(bot, "Kutsuttu funktiota: "+commandName+" Parts: "+parts+" Args: "+args)
    try {
        // Execute the command.
        await commandExec(msg, args, commandIndex, bot);
    } catch (err) {
        console.warn('Error handling command');
        console.warn(err);
    }

    /*
    const botWasMentioned = msg.mentions.find(
        mentionedUser => mentionedUser.id === bot.user.id,
    );
 
    if (botWasMentioned) {
        try {
            await msg.channel.createMessage('Present');
        } catch (err) {
            // There are various reasons why sending a message may fail.
            // The API might time out or choke and return a 5xx status,
            // or the bot may not have permission to send the
            // message (403 status).
            console.warn('Failed to respond to mention.');
            console.warn(err);
        }
    */
});

bot.on('error', err => {
    console.warn(err);
 });
 
bot.on('messageReactionAdd', async (msg,emoji,reactor) => {
    //Sääntösivun reaktio
    if (msg.id === "1031996372959907913") {
        reactor.removeRole("1031693719755296919","Added to channel")
    }

});

bot.on('messageReactionRemove', async (msg,emoji,userID) => {
        //Sääntösivun reaktio,
        if (msg.id === "1031996372959907913") {
            bot.addGuildMemberRole("1031479962005409802",userID,"1031693719755296919","Does not want to join channel :(")
        }
})

bot.connect();
