//const axios = require('axios');
//const eris = require('eris');
//require ('./auth.js');

import eris from 'eris';


import {auth} from './auth.js'
import { 
    commandGet,
    commandExec,
    loggaa } from './funcs.js';


//HOT SHIT


///SPOTIFY API
//axios.get('https://accounts.spotify.com/authorize?client:id='+{auth.spotifyToken}&response_type=code&redirect:uri=https://www.henkimaailma.net/callback');

const bot = eris(auth.discordToken);
const PREFIX = 'levyraati!';

bot.on('ready', () => {
    console.log('LETS MENNÄÄN!!!')
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
    const parts = content.split(' ').map(s => s.trim()).filter(s => s);
    const commandName = content.split(' ')[1]/*.slice(PREFIX.length)*/;
    
    // Get the appropriate handler for the command, if there is one.
    let commandIndex = await commandGet(commandName);
    if (commandIndex===-1) {
      return;
    }

    // Separate the command arguments from the command prefix and command name.
    const args = parts.slice(2);
    loggaa(bot, "Kutsuttu funktiota: "+commandName+" Koko viesti: "+content+" Parts: "+parts+" Args: "+args)
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
 
 bot.connect();

/*const Discord = require('discord.io');
/*var logger = require('winston');
require('dotenv').config();
const client = new Discord.Client();
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.login(process.env.DISCORD_TOKEN);
*/

/*
// Configure logger settings

logger.remove(logger.transports.Console);

logger.add(new logger.transports.Console, {

colorize: true
});

logger.level = 'debug';

// Initialize Discord Bot

var bot = new Discord.Client({

token: auth.token,

autorun: true

});

bot.on('ready', function (evt) {

logger.info('Connected');

logger.info('Logged in as: ');

logger.info(bot.username + ' - (' + bot.id + ')');
});

bot.on('message', function (user, userID, channelID, message, evt) {

// Our bot needs to know if it will execute a command

// It will listen for messages that will start with `!`

if (message.substring(0, 1) == '!') {

    var args = message.substring(1).split(' ');

    var cmd = args[0];


    args = args.splice(1);

    switch(cmd) {

        // !ping

        case 'ping':

            bot.sendMessage({

                to: channelID,

                message: 'Pong!'

            });

        break;

        // Just add any case commands if you want to..

     }

 }
});
*/