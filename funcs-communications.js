import { auth } from "./auth.js";

export function loggaa(bot,logmessage) {
    const logChannel = auth.logChannel;
    return bot.createMessage(logChannel,logmessage);
}

export function vastaaJaPoista(bot,msg,vastaus) {
    const kanava = msg.channel.id
    bot.createMessage(kanava,vastaus)
    return bot.deleteMessage(msg.channel.id,msg.id,"Deleting function call") 
}
export function vastaa(bot,msg,vastaus) {
    const kanava = msg.channel.id
    return bot.createMessage(kanava,vastaus)
}

export async function vastaaDm(bot,msg,vastaus) {
    
    try {
        // Kokeillaan lähettää DM
        const Dmkanava = await bot.getDMChannel(msg.author.id)
        return bot.createMessage(Dmkanava.id,vastaus)
    } catch (err) {
        console.warn('Error getting DM Channel');
        console.warn(err);
    }
}

export async function vastaaDmJaPoista(bot,msg,vastaus) {
    await vastaaDm(bot,msg,vastaus)
    return bot.deleteMessage(msg.channel.id,msg.id,"Deleting function call")
}