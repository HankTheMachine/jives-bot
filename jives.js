//const axios = require('axios');
//const eris = require('eris');
import eris from 'eris';
import axios from 'axios';
import { 
    commandGet,
    commandExec,
    loggaa } from './funcs.js';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { Album } from './funcs.js';
const app = express()
app.use(cors())

//HOT SHIT
const discordToken = process.env.DISCORD_TOKEN;
const twitchToken = process.env.TWITCH_TOKEN;
const twitchAppId = process.env.TWITCH_APPID;
const mongoUrl = process.env.MONGOURL_JIVES;
const port = process.env.PORT || 8080;

//
//Kun serveri on käynnissä, levyraadin dataa voi säilöä täällä ettei 
//tarvi hakea mongosta perushommia kuin kerran ajon aikana? Teoriassa?
//

let levyRaatiData = [];

//Lokaalin levyraatidatan käsittelyfunktiot

function simplifyAlbumData(e) {
    return [e.albumArtists,e.albumTitle,e.albumImg,e.albumReleaseDate,e.albumCopyrights,e.reviewAverage,e.reviewCount]
}

function findLocalLevyRaatiIndex(album) {
    const albumSimple = simplifyAlbumData(album)
    return levyRaatiData.indexOf(levyRaatiData.find(e => 
        (e[0]===albumSimple[0]
        && e[1] === albumSimple[1])
        ))
}

async function FetchLevyraatiToLocal() {
    let allAlbums;
    await Album
        .find({})
        .then(res => {
            allAlbums=res
        })
    const albumsLessData = allAlbums.map(e=> simplifyAlbumData(e))
    levyRaatiData = albumsLessData
}

export function addAlbumToLocal(album) {
    levyRaatiData.push(simplifyAlbumData(album))
}

export function removeAlbumFromLocal(album) {
    const indexofAlbum = findLocalLevyRaatiIndex(album) 
    levyRaatiData.splice(indexofAlbum,1);
}

export function upDateRatingLocal(album,ratingAvg,ratingMod) {
    const indexofAlbum = findLocalLevyRaatiIndex(album)
    levyRaatiData[indexofAlbum][5] = ratingAvg
    levyRaatiData[indexofAlbum][6] = levyRaatiData[indexofAlbum][6]+ratingMod
}

//
//Backendin endpointit
//

app.get('/levyraatidata', (req, res) => {
    if (levyRaatiData[0]===undefined) {
        return null
    }
    res.json(levyRaatiData)
})

app.get('/isSkriimOnline', async (req, res) => {
    const url = "https://api.twitch.tv/helix/streams?user_id=55464815"
    const API_HEADERS = {
        headers: {
        'Authorization' : twitchToken,
        'Client-ID': twitchAppId,
        }
    }
    let status;
    await axios
        .get(url,API_HEADERS)
        .then(res => {
                //console.log(res.data)
                if (res.data.data.length > 0) {
                    //console.log("Live")
                    status = true
                } else {
                    //console.log("not live")
                    status = false}
        }).catch(function (error) {
            console.log(error.response)
                console.log("Twitch api palautti errorin, whatup");
            })

    //Odotetaan 0,3s että ehditään saada tieto striimin kunnosta Twitchistä 
    setTimeout(()=>{
        if (status===true) {
            res.status(200).send(true)
        } else {
            res.status(200).send(false)
        }
    },300)
})

//
// Express appin funktiot  ja sammuttaessa
//

process.on('exit', function() {
    console.log("Serverin yhteys katkeamassa...");
    mongoose.connection.close();
    console.log("Yhteys tietokantaan katkaistu.")
})

//
// Käynnistetään serveri ja haetaan levyraadin Mongodata serverille
//

app.listen(port)
console.log("Express serveri käynnistyy, kuunnellaan porttia ",port);
mongoose.connect(mongoUrl);
mongoose.set('strictQuery',false)
console.log("Yhteys tietokantaan otettu.")
FetchLevyraatiToLocal();
console.log("Levyraadin data haettu serverille")

//
// Käynnistetään Jives
//

const bot = eris(discordToken);
const PREFIX = 'jives!';

bot.on('ready', () => {
    console.log('Jives herätetty kauneusunilta!')
})

// Konvertoidaan usein ensimmäinen alkukirjain pieneksi koska älypuhelimet ja helppokäyttöisyys
export function firstLow(string) {
    return string.charAt(0).toLowerCase() + string.slice(1)
}

// Kun kuka tahansa lähettää viestin siellä missä Jives on kuulemassa
// --> Etsitään Jivesin funktio ja suoritetaan
bot.on('messageCreate', async (msg) => {
    const content = msg.content;
    // Jives ei hyväksy yksityisviestejä
    if (!msg.channel.guild) {
        return;
    }
    // Jos viesti ei ala 'Jives!' tai 'jives!' Jivesia ei kiinnosta
    if (!(firstLow(content).startsWith(PREFIX))) {
        return;
    }
    // Pilkotaan viesti osiin välilyönnin perusteella, komennon nimi on
    // toinen välilyönnin erottama sana 
    const parts = content.split(' ');
    const commandName = firstLow(content.split(' ')[1]);
    // Haetaan komentoa vastaava komento
    console.log("Komennon nimi "+commandName)
    let commandIndex = await commandGet(commandName);
    console.log("Komennon index "+commandIndex);
    if (commandIndex===-1) {
      return;
    }
    // Kaikki prefixin ja komentonimen jälkeen on komennon argumentteja
    const args = parts.slice(2);
    try {
        // Kokeillaan suorittaa toiminto
        await commandExec(msg, args, commandIndex, commandName, bot);
    } catch (err) {
        console.warn('Error handling command');
        console.warn(err);
    }
});

// Kun kuka tahansa lisää reaktion johonkin viestiin kun Jives on kuulemassa
bot.on('messageReactionAdd', async (msg,emoji,reactor) => {
    //Sääntösivun reaktio --> Poistetaan jäseneltä rajoittava "uusi"-rooli
    if (msg.id === "1031996372959907913") {
        reactor.removeRole("1031693719755296919","Added to channel")
    }

});
// Kun kuka tahansa poistaa reaktion kun Jives on kuulemassa
bot.on('messageReactionRemove', async (msg,emoji,userID) => {
        //Sääntösivun reaktio, laitetaan rooli takaisin, bwahaha
        if (msg.id === "1031996372959907913") {
            bot.addGuildMemberRole("1031479962005409802",userID,"1031693719755296919","Does not want to join channel :(")
        }
})

bot.on('error', err => {
    console.warn(err);
 });

//Jives to the moon
bot.connect();
