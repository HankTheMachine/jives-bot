import { auth } from "./auth.js";
//import {getAccessToken} from "./auth.js"
import axios from 'axios';
import mongoose from 'mongoose';
import querystring from 'node:querystring';

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

//ITSE FUNKTIOT

async function addSpotifyAlbumToReviews(bot,msg,args) {
    //Onko ylipäätään viestiä ja oikealla kanavalla
    if(!msg || msg.channel.id!==auth.levyRaatiSubmissionsChannel) {
        return
    }

    const submission = args[0]
    //Onko submissionissa validi spotify share linkki
    if (!(submission.includes(auth.spotifyShareLink))) {
        vastaa(bot,msg,", yritit lisätä arvioihin spotifylevyn antamatta kelvollista linkkiä. Shame on you!")
        return
    }

    //Haetaan access token
    const accessToken = await getAccessToken();
    if (accessToken===undefined) {
        loggaa(bot,"Ei access tokenia?")
        return
    }
    // Kutsussa on spotifylinkki ja access token fetchattu ` `
    //Haetaan data
    const {albumJson,title,artists,albumId,img,imgSmall,label,copyrights} = await getSpotifyApiData(submission,accessToken)
    if (albumJson === undefined) {
        loggaa(bot,"Ei albumdataa?")
        return
    }

    let submitterId = msg.author.id;
    let submitterName = msg.author.username;
    let link = submission;

    // AlbumJson on löytynyt Spotifystä
    console.log("Löytyi albumi seuraavin tiedoin:");
    console.log("Albumin nimi: ",title);
    console.log("Artistit: ",artists);
    console.log("Albumin id: ",albumId);
    console.log("Albumin kuva normaali: ",img);
    console.log("Albumin kuva pieni: ",imgSmall);
    console.log("Albumin levy-yhtiö: ",label);
    console.log("Tekijänoikeudet: ",copyrights);
    console.log("Arvostelun lähettäjä Discordissa: ",submitterName," (",submitterId,")");


    // tarkistetaan onko levy jo tietokannassa
  

    const albumSchema = new mongoose.Schema({
        albumSubmitterId: String,
        albumSubmitterUserName: String,
        albumLink: String,
        albumID: String,
        albumTitle: String,
        albumArtists: String,
        albumLabel: String,
        albumImg : String,
        albumImgSmall : String,
        albumCopyrights : [],
        reviewsAverage: Number,
        reviewCount: Number,
        albumReviews : [],
    })

    const reviewSchema = new mongoose.Schema({
        reviewerId: String,
        reviewerName: String,
        rating: Number,
    })

    // ON OK LISÄTÄ ALBUMI KANAVALLE
    loggaa(bot,"Albumi ",title," voidaan lisätä")
    //await lisaaAlbumi()
    
    return
    // ON OK LISÄTÄ ALBUMI KANAVALLE
    /*
    const reviewMSG = await bot.createMessage(auth.levyRaatiChannel, `Add function called by ${msg.author.username}`);
    const reviewThread = await bot.createThreadWithMessage(reviewMSG.channel.id,reviewMSG.id,{name:`Testi`})
    bot.createMessage(reviewThread.id,'Keskustelu albumista ja arviot tämän ketjun alle!')
    return
    */
}

async function lisaaAlbumi() {
    const reviewMSG = await bot.createMessage(auth.levyRaatiChannel, `Add function called by ${msg.author.username}`);
    const reviewThread = await bot.createThreadWithMessage(reviewMSG.channel.id,reviewMSG.id,{name:title})
    bot.createMessage(reviewThread.id,'Keskustelu albumista ja arviot tämän ketjun alle!')
    
}

export function loggaa(bot,logmessage) {
    const logChannel = "1070986689503305789";
    return bot.createMessage(logChannel,logmessage);
}
function vastaaJaPoista(bot,msg,vastaus) {
    const kanava = msg.channel.id
    bot.createMessage(kanava,vastaus)
    return bot.deleteMessage(msg.channel.id,msg.id,"Bad function call") 
}
function vastaa(bot,msg,vastaus) {
    const kanava = msg.channel.id
    return bot.createMessage(kanava,vastaus)
}
async function getSpotifyApiData(submission,tokenraw) {
    const albumGetUrl = auth.spotifyApiAlbumLink+submission.slice(auth.spotifyShareLink.length)
    const accessToken = "Bearer "+tokenraw;
    const api_headers = {
        headers: {
        'Authorization' : accessToken,
        'Accept' : 'application/json',
        'Content-type' : 'application/json',
        }
    }

    let albumJson;

    await axios
        .get(albumGetUrl,api_headers)
        .then(res => 
            albumJson=res.data
        ).catch(function (error) {
            console.log(error.response)
            if (error.response.data.error.status===401) {
                loggaa(bot, "Spotify api palautti statuskoodin 401. OAuth token ei ole kelvollinen.")
            }
            if (error.response.data.error.status===400) {
                loggaa(bot, "Spotify ulisee ettei Bearer ole hyvä saatana")
            }
        })
    const title=albumJson.name;
    const artists = stringifyArtists(albumJson.artists.map((x)=> x.name))
    const albumId = albumJson.id
    const img = albumJson.images[1].url;
    const imgSmall =albumJson.images[2].url;
    const label = albumJson.label;
    const copyrights = albumJson.copyrights
    return {albumJson,title,artists,albumId,img,imgSmall,label,copyrights}
}

async function getAccessToken() {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", auth.spotifyApiAuth);
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
    
    var urlencoded = new URLSearchParams();
    urlencoded.append("grant_type", "client_credentials");
    
    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: urlencoded,
      redirect: 'follow',
      json:true,
    };

    let token;
    await fetch("https://accounts.spotify.com/api/token", requestOptions)
      .then(response => response.json())
      .then(result => 
        //console.log("Fetchin tulos: ",result),
        token=result,
        )
      .catch(error => console.log('error', error));
    return token.access_token
}

function stringifyArtists(artistArray) {
    let string = '';
    for (let i=0;i<artistArray.length;i++) {
        string = string.concat(artistArray[i])
        if (artistArray[i+1]!==undefined) {
            if (i+2!==artistArray.length) {
                string = string.concat(", ");
            } else {
                string = string.concat(" & ");
            }
        }
    }
    return string
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