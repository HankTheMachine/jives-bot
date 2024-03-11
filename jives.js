//const axios = require('axios');
//const eris = require('eris');
import eris from 'eris';
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import { 
    commandGet,
    commandExec,
    rateByEmote,

    Album
 } from './funcs.js';

const app = express()
app.use(cors())
const discordToken = process.env.DISCORD_TOKEN;
//const twitchToken = process.env.TWITCH_TOKEN; //TODO: generoi twitch koodit kutsun aikana
const twitchAppId = process.env.TWITCH_APPID; //TODO : generoi twitch koodit kutsun aikana
const twitchSecret = process.env.TWITCH_SECRET;
const mongoUrl = process.env.MONGOURL_JIVES;
const port = process.env.PORT //|| 8080;



//Lokaalin levyraatidatan käsittelyfunktiot
let levyRaatiData = [];

/**
 * Karsii albumin datan levyraadin toiminnan kannalta olennaisiin.
 * 
 * Toimii sekä Spotifyn API:sta haetulla datalla että mongosta haettavalla datalla.
 * 
 * @param {Array} e Spotfyn API:n palauttama massiivinen Array.
 * @return {Array} Lista = albumin artistit, albumin nimi, kansikuva, julkaisuajankohta, tekijänoikeustiedot, nykyinen levyraadin pistekeskiarvo ja linkki discordin topiciin.
 */
function simplifyAlbumData(e) {
    return [e.albumArtists,e.albumTitle,e.albumImg,e.albumReleaseDate,e.albumCopyrights,e.reviewAverage,e.reviewCount,e.albumReviewTopicDiscord]
}
/**
 * 
 * Vastaanottaa albumin tiedot Arrayna ja palauttaa backendin listasta albumia vastaavan indeksin.
 * 
 * Albumin data voi olla spotify API:n, mongon tai muussa muodossa - albumidata simplifioidaan funktion sisällä.
 * 
 * @param {*} album Albumin data joko mongon, spotifyn tai muussa yhteensopivassa muodossa.
 * 
 * @returns Albumin indeksi lokaalissa levyRaatiData -Arrayssa.
 */
function findLocalLevyRaatiIndex(album) {
    const albumSimple = simplifyAlbumData(album)
    return levyRaatiData.indexOf(levyRaatiData.find(e => 
        (e[0]===albumSimple[0]
        && e[1] === albumSimple[1])
        ))
}
/**
 * Hakee backendin lokaaliin muistiin levyraadin datan.
 * 
 * Funktio kutsutaan aina backendin (l. Jivesin) käynnistyessä, jotta frontendin ei tarvitse tehdä kyselyjä tietokantaan vaan backendin lokaaliin tietolistaan. Backendin lista päivittyy kun tietokannan tietoja muokataan, eli näiden pitäisi olla synkassa.
 * 
 * Tietojen hakemisen jälkeen tiedot simplifioidaan backendin tarpeita vastaaviksi (simplifyAlbumData(album))
 * 
 * Backendissa levyraati tallennettuna muuttujaan let levyRaatiData[]
 */
export async function FetchLevyraatiToLocal() {
    let allAlbums;
    await Album
        .find({})
        .then(res => {
            allAlbums=res
        })
    const albumsLessData = allAlbums.map(e=> simplifyAlbumData(e))
    levyRaatiData = albumsLessData
}
/**
 * Lisää albumi backendin lokaaliin tietokantaan.
 * 
 * @param {*} album Albumin tiedot missä tahansa muodossa. Funktio simplifioi vastaanottamansa datan. 
 */
export function addAlbumToLocal(album) {
    levyRaatiData.push(simplifyAlbumData(album))
}
/** 
 * Poistaa albumin backendin lokaalista tietokannasta.
 * 
 * @param {*} album Albumin tietoarray missä tahansa muodossa. 
 */
export function removeAlbumFromLocal(album) {
    const indexofAlbum = findLocalLevyRaatiIndex(album) 
    levyRaatiData.splice(indexofAlbum,1);
}
/**
 * Päivittää albumin pistekeskiarvon ja arvioiden määrän lokaaliin tietokantaan.
 * 
 * Huom! Lokaalin levyraatidatan käsittely jives.js -tiedostossa.
 * 
 * @param {*} album Albumin tiedot missä tahansa muuodossa 
 * @param {*} ratingAvg Arvion tai sen muutoksen seurauksena laskettu uusi albumin pistekeskiarvo
 * @param {*} ratingMod +1, 0 tai -1 riippuen siitä lisätäänkö , päivitetäänkö vai poistetaanko arvio
 */
export function upDateRatingLocal(album,ratingAvg,ratingMod) {
    const indexofAlbum = findLocalLevyRaatiIndex(album)
    levyRaatiData[indexofAlbum][5] = ratingAvg
    levyRaatiData[indexofAlbum][6] = levyRaatiData[indexofAlbum][6]+ratingMod
}


//Backendin endpointit ja funktio sammuttaessa yhteys
app.get('/levyraatidata', (req, res) => {
    if (levyRaatiData[0]===undefined) {
        return null
    }
    res.json(levyRaatiData)
})

app.get('/isSkriimOnline', async (req, res) => {
    const Userurl = "https://api.twitch.tv/helix/streams?user_id=55464815"
    const oauthUrl = "https://id.twitch.tv/oauth2/token"

    let twitchToken;
    await axios
        .post(oauthUrl,{
            'client_id' : twitchAppId,
            'client_secret' : twitchSecret,
            'grant_type' : "client_credentials",
        }
        )
        .then(res => {
            twitchToken = "Bearer "+res.data.access_token;
        }).catch(function (error) {
            console.log(error.response)
            console.log("Twitch tokenin haku epäonnistui!");
        })

    let status;
    await axios
    .get(Userurl,
        {headers: {
        'Authorization' : twitchToken, 
        'Client-ID': twitchAppId, 
        }})
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

    //Odotetaan 0,3s että ehditään saada tieto striimin kunnosta Twitchistä. Jos siihen mennessä ei saada 200 status=true, palautetaan 200 status=false 
    setTimeout(()=>{
        if (status===true) {
            res.status(200).send(true)
        } else {
            res.status(200).send(false)
        }
    },300)
})

process.on('exit', function() {
    console.log("Serverin yhteys katkeamassa...");
    mongoose.connection.close();
    console.log("Yhteys tietokantaan katkaistu.")
})



// Käynnistetään serveri ja haetaan levyraadin Mongodata serverille
app.listen(port)
console.log("Express serveri käynnistyy, kuunnellaan porttia ",port);
mongoose.connect(mongoUrl);
mongoose.set('strictQuery',false)
console.log("Yhteys tietokantaan otettu.")
FetchLevyraatiToLocal();
console.log("Levyraadin data haettu serverille")



// Alustetaan Jives ja asetetaan Jivesille toiminnallisuudet
const bot = eris(discordToken);
const PREFIX = 'jives!';
bot.on('ready', () => {
    console.log('Jives herätetty kauneusunilta!')
})
/**
 * Helppokäyttöisyyden vuoksi esim. älypuhelimilla käytettäessä käännetään usein viesteistä ensimmäinen kirjain lowercaseksi niin, että Jives ymmärtää sekä kutsun "jives!" että "Jives!".
 * 
 * Tämä funktio löytyy jives.js tiedostosta Jivesin käynnistämisen yhteydestä.
 * 
 * @return {string} syötetty string niin, että sen ensimmäinen alkukirjain on lowercase
 *  */ 
export function firstLow(string) {
    return string.charAt(0).toLowerCase() + string.slice(1)
}



// Joku lähettää viestin minkä Jives näkee (eli mahdollisesti kutsuu komentoa)
bot.on('messageCreate', async (msg) => {

    const content = msg.content;

    // Ei kuunnella näitä viestejä
    if (!msg.channel.guild) { // Viesti ei ole lähetetty guildiin (l. discordin serverille) eli on yksityisviesti
        return;
    }
    if (!(firstLow(content).startsWith(PREFIX))) { // Viesti ei ala Jivesin prefikseillä "Jives!" tai "jives!"
        return;
    }

    // Pilkotaan viestin sisältö osiin välilyönnin kohdalta jakaen
    // Käyttäjän viesti:
    // "Jives! [komennonnimi] [argumentti1] [argumentti2] [argumentti3] [jne]"
    const parts = content.split(' ');
    const commandName = firstLow(content.split(' ')[1]);
    const args = parts.slice(2);

    // Haetaan komentoa vastaava komento. Jos sopivaa komentoa ei löydy, ei tehdä mitään.
    let commandIndex = await commandGet(commandName);
    if (commandIndex===-1) {
      return;
    }

    // Jos kaikki menee tähän asti oikein, yritetään suorittaa vastaava komento. Komennot löytyvät functions.js -tiedostosta.
    try {
        await commandExec(msg, args, commandIndex, commandName, bot);
    } catch (err) {
        console.warn('Error handling command');
        console.warn(err);
    }

});

//Kun kuka tahansa liittyy serverille annetaan näille "uusi" -rooli jotta näiden on klikattava hyväksyntä serverin säännöistä ennen lukuoikeuden saamista
bot.on('guildMemberAdd', (guild,member) => {
    bot.addGuildMemberRole("1031479962005409802",member.id,"1031693719755296919","New member")
})

// Kun kuka tahansa lisää reaktion johonkin viestiin kun Jives on kuulemassa (arviot emojeilla reagoimalla ja roolien päivitys)
bot.on('messageReactionAdd', async (msg,emoji,reactor) => {

    if (reactor.id==="1070384026591973447") { //Ohitetaan Jivesin itsensä lähettämät reaktiot
        return
    }
    
    //Sääntösivun reaktio --> Poistetaan jäseneltä rajoittava "uusi"-rooli
    if (msg.id === "1031996372959907913") {
        reactor.removeRole("1031693719755296919","Added to channel")
    }

    //Arviointi reagoimalla
    const leaderboardEmotes = ['1️⃣', '2️⃣', '3️⃣', '4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

    const albumIdToRate = msg.id
    let allReviewTopics = levyRaatiData.map(album => album[7])

    //Luodaan feikkiviesti jota käyttää arviointifunktioissa
    const fakeMsg = {author:reactor,channel:{id:msg.id},id:msg.id}

    //Jos käyttäjä on reagoinut numeroemojiin viestissä joka vastaa levyraadin albumikanavaa, pyritään arvioimaan albumia emojilla
    if (leaderboardEmotes.includes(emoji.name) && allReviewTopics.includes(albumIdToRate)) {

        // Päätellään käyttäjän antama pistemäärä
        const ratingFromEmote = (leaderboardEmotes.indexOf(emoji.name)+1)*100
        
        try { // Kokeillaan kutsua rateByEmote(parametrit)
            await rateByEmote(bot, "emoteRating",albumIdToRate, ratingFromEmote, reactor, fakeMsg);
        } catch (err) {
            console.warn('Error handling command');
            console.warn(err);
        }
        // poistetaan käyttäjän reaktio jotta arviointi olisi anonyymiä
        bot.removeMessageReaction(msg.channel.id,msg.id,emoji.name,reactor.id);
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

//Kun kaikki tämä on opetettu Jivesille, voidaan Jives käynnistää eli muodostaa yhteys
bot.connect();
