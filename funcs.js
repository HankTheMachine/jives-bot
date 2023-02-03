import { auth } from "./auth.js";
import axios from 'axios';
import mongoose from 'mongoose';

// DB STUFF
const albumSchema = new mongoose.Schema({
    albumLink: String,
    albumTitle: String,
    albumArtists: [String],
})

//LISTA BOTIN FUNKTIOISTA   
export async function commandGet(commandName,msg,args,bot) {
    const commandArray = [
        ['spotify', addSpotifyAlbumToReviews(bot,msg,args)]
    ]
    const commandIndex = commandArray.indexOf(commandArray.find(c => c[0]===commandName))
    return commandIndex
}

export async function commandExec(msg,args,commandIndex,bot) {
    const commandArray = [
        ['spotify', addSpotifyAlbumToReviews(bot,msg,args)]
    ]
    return await commandArray[commandIndex][1]
    }


//TEST
//ITSE FUNKTIOT

async function addSpotifyAlbumToReviews(bot,msg,args) {
    if(!msg || msg.channel.id!==auth.levyRaatiSubmissionsChannel) {
        return
    }
    const submission = args[0]
    if (!(submission.includes(auth.spotifyShareLink))) {
        const reply = msg.author.username+", yritit lisätä arvioihin spotifylevyn antamatta kelvollista linkkiä. Shame on you!"
        bot.createMessage(msg.channel.id,reply);
        bot.deleteMessage(msg.channel.id,msg.id,"Bad function call")
        return
    }

    // Kutsussa on spotifylinkki, koetetaan hakea spotifyn apista levyn tiedot
    const albumId = submission.slice(auth.spotifyShareLink.length)
    const albumGetUrl = auth.spotifyApiAlbumLink+albumId
    const api_headers ={
        headers: {
        'Accept' : 'application/json',
        'Content-type' : 'application/json',
        'Authorization' : auth.spotifyToken
        }
    }
    const albumJson = await axios
        .get(albumGetUrl,api_headers)
        .then(res => {
            return res.data.images[1].url
        }).catch(function (error) {
            console.log(error.response)
            if (error.response.data.error.status===401) {
                vastaa(bot, msg, "Spotify api palautti statuskoodin 401. Spotify Apin token vanhentunut tai ei lähetetty.")
            }
        })
    console.log("albumJson on "+albumJson)
    if (albumJson === undefined) {
        return
    }

    // AlbumJson on löytynyt, tarkistetaan onko tämän artistin levy jo tietokannassa


    // ON OK LISÄTÄ ALBUMI KANAVALLE
    const reviewMSG = await bot.createMessage(auth.levyRaatiChannel, `Add function called by ${msg.author.username}`);
    console.log(reviewMSG)
    const reviewThread = await bot.createThreadWithMessage(reviewMSG.channel.id,reviewMSG.id,{name:`Testi`})
    bot.createMessage(reviewThread.id,'Keskustelu albumista ja arviot tämän ketjun alle!')
    return
}



export function loggaa(bot,logmessage) {
    const logChannel = "1070986689503305789";
    return bot.createMessage(logChannel,logmessage);
}
function vastaa(bot,msg,vastaus) {
    const kanava = msg.channel.id
    return bot.createMessage(kanava,vastaus)

}
    
  /*
        const albumLink = args[0];
        return msg.channel.createMessage(`Koitetaan lisätä ${albumId}.`);
        }*/
    
    
    /*async function getAlbumArt(albumId) {
        const url = "https://api.spotify.com/v1/albums/"+albumId;
        const API_HEADERS = {
            headers: {
                'Accept' : 'application/json',
                'Content-type' : 'application/json',
                'Authorization' : spotifyToken
            }
        }
        axios
            .get(url,API_HEADERS)
            .then(res => {
                return res.data.images[1].url
            })
    }*/