import { auth } from "./auth.js";
//import {getAccessToken} from "./auth.js"
import axios from 'axios';
import mongoose from 'mongoose';
import querystring from 'node:querystring';

//MONGO STUFF
const albumSchema = new mongoose.Schema({
    albumSubmitterId: String,
    albumSubmitterUserName: String,
    albumLink: String,
    albumReviewTopicDiscord: String,
    albumPlatform : String,
    albumId: String,
    albumType: String,
    albumTitle: String,
    albumArtists: String,
    albumReleaseDate: String,
    albumLabel: String,
    albumImg : String,
    albumImgSmall : String,
    albumCopyrights : [],
    reviewCount : Number,
    reviewAverage: Number,
    albumReviews : [],
})
const reviewSchema = new mongoose.Schema({
    reviewerId: String,
    reviewerName: String,
    reviewType: String,
    albumId: String,
    rating: Number,
})
//const Review = mongoose.model('Review'.reviewSchema)

//LISTA BOTIN FUNKTIOISTA   
export async function commandGet(commandName,msg,args,bot) {
    const commandArray = [
        ['spotify', addSpotifyAlbumToReviews(bot,msg,args)],
        ['DELETEALBUM', removeAlbumFromReviews(bot,msg)],
        ['rate', rateAlbum(bot,msg,args)],
        ['deleterating', deleteMyRating(bot,msg,args)],
    ]
    const commandIndex = commandArray.indexOf(commandArray.find(c => c[0]===commandName))
    return commandIndex
}

export async function commandExec(msg,args,commandIndex,bot) {
    const commandArray = [
        ['spotify', addSpotifyAlbumToReviews(bot,msg,args)],
        ['DELETEALBUM', removeAlbumFromReviews(bot,msg)],
        ['rate', rateAlbum(bot,msg,args)],
        ['deleterating', deleteMyRating(bot,msg,args)],
    ]
    return await commandArray[commandIndex][1]
    }

//ITSE FUNKTIOT

async function deleteMyRating(bot,msg,args) {
    if(!msg || (msg.content.split(' ')[1]!=="deleterating")) {
        return
    }
    const reviewerId = msg.author.id;
    const albumData=(await getAlbum(msg.channel.id));
    const oldReviewObject = albumData.albumReviews.find(e => e.reviewerId === msg.author.id)
    // Arviota ei löydy
    if (oldReviewObject===undefined) {
        vastaa(bot,msg,"Et ole arvostellut tätä levyä vielä!")
        return
    }
    //arvio löytyy, poistetaan
    const rating = oldReviewObject.rating
    const newAverage = (albumData.reviewAverage - Math.floor(rating/albumData.reviewCount))
    await deleteMongoReview(bot,msg,newAverage)
}

async function rateAlbum(bot,msg,args) {
    //Ei paskota hommia jos ei ole viestiä tai komento ei ole oikea
    if(!msg || (msg.content.split(' ')[1]!=="rate")) {
        return
    }
    //Konvertoidaan rating yhdenmukaiseksi asteikolle 0-1000
    let rating=parseRating(args[0],bot,msg)
    if (rating===undefined) {
        vastaa(bot,msg,"Tarkista arvosanasi muotoilu! Anna pisteesi joko kokonaislukuna 0-100 tai murtolukuna, esim: 7/10.");
        return
    }
    
    //Katsotaan onko käyttäjän arviota jo albumin arvioissa
    const albumData=(await getAlbum(msg.channel.id));
    const albumReviews=albumData.albumReviews;
    const oldReviewObject = albumReviews.find(e => e.reviewerId === msg.author.id )

    //-1 jos vanhaa arviota ei ole, jos on, tämän indeksi otetaan talteen
    const indexOfOldReview = albumReviews.indexOf(oldReviewObject)
    const Review = mongoose.model('Review', reviewSchema)
    const reviewToAdd = new Review({
        reviewerId: msg.author.id,
        reviewerName: msg.author.username,
        reviewType: "comment",
        albumId: msg.channel.id,
        rating: rating,
    })

    console.log("Vanhan arvion index: ",indexOfOldReview)
    console.log("Uusi arvio: ",reviewToAdd)
    
    // Lasketaan uusi average
    let reviewsAverage = albumData.reviewAverage;
    const reviewCount = albumData.reviewCount;

    // Käyttäjän arviota tälle levylle ei vielä ole
    if (indexOfOldReview===-1) {
        //Lasketaan uusi keskiarvo arvosanoista
        reviewsAverage=Math.floor(reviewsAverage+((rating-reviewsAverage)/(reviewCount+1)))
        console.log("Uusi average on ",reviewsAverage)
        await pushReviewToMongo(bot,msg,reviewToAdd,reviewsAverage)
    }

    // Käyttäjä on jo arvioinut levyn, päivitetään arvosana uuteen
    else {
        const oldRating = oldReviewObject.rating
        reviewsAverage = Math.floor(reviewsAverage+((rating-oldRating)/reviewCount)) 
        console.log("Uusi average on ",reviewsAverage)
        await updateMongoReview(bot, msg, reviewToAdd,reviewsAverage)
    }
    
    return
}

async function deleteMongoReview(bot,msg,ratingAverage) {
    const Album = mongoose.model('Album', albumSchema);
    await mongoose.connect(auth.mongoUrlJivesLevyraati);
    await Album
        .updateOne(
            { 
                albumReviewTopicDiscord : msg.channel.id
            },
            {
                $pull : {albumReviews : {reviewerId: msg.author.id}},
                $set : {reviewAverage : ratingAverage},
                $inc : {reviewCount : -1}
            }
        ).then(result => {
            console.log('Koetettiin poistaa vanha arvostelu tietokannasta: ',result);
            mongoose.connection.close();
        })
    return
} 

async function updateMongoReview(bot,msg,Review,ratingAverage) {
    await deleteMongoReview(bot,msg,ratingAverage)
    await pushReviewToMongo(bot,msg,Review,ratingAverage)
    return
    }

async function pushReviewToMongo(bot,msg,Review,ratingAverage) {
    const Album = mongoose.model('Album', albumSchema);
    await mongoose.connect(auth.mongoUrlJivesLevyraati);
    Album
        .updateOne(
            {
                albumReviewTopicDiscord : msg.channel.id
            },
            {
                $push: {albumReviews : Review},
                $inc: {reviewCount : 1},
                $set: {reviewAverage : ratingAverage},
            },
        )
        .then(res => {
            console.log("Pushauksen res: ",res)
            mongoose.connection.close();
        })
    return
}



function parseRating(rating,bot,msg) {
    let convertedRating = Number(rating)
    if ((convertedRating<0) || (convertedRating>100)) {
        convertedRating = undefined;
    } else if (isNaN(convertedRating)) {
        try {
            console.log("ei kokonaisluku parametrina")
            const split = rating.split("/")
            const ratingFloat = parseInt(split[0],10) / parseInt(split[1],10)
            convertedRating = Math.floor(ratingFloat*1000)
        } catch (err) {
            console.warn(err)

            convertedRating = undefined;
        }
    } else {
        convertedRating = (convertedRating*10);
    }
    console.log("Saatu arvio ",rating, " konvertoitu pisteiksi ",convertedRating)
    if (isNaN(convertedRating)) {
        convertedRating === undefined
    }
    return convertedRating
}

async function removeAlbumFromReviews(bot,msg,args) {
    //Ei paskota hommia jos ei ole viestiä tai komento ei ole oikea
    if(!msg || (msg.content.split(' ')[1]!=="DELETEALBUM")) {
        return
    }
    
    //Haetaan levy
    const reviewMongo = await getAlbum(msg.channel.id)
    console.log(reviewMongo)
    const submitterId = reviewMongo.albumSubmitterId

    //Jos delete-funktion kutsuja ei ole botin omistaja tai alkuperäisen arvostelun lähettäjä, ei saa poistaa
    if (msg.author.id !== (submitterId || auth.HenKonenDiscordId) ) {
        loggaa(bot,("Käyttäjä "+msg.author.username+" yritti poistaa arvion"))
        return
    }
    
    //Luvallinen ihminen poistamassa, poistetaan
    await deleteAlbumFromMongo(msg.channel.id)
    bot.deleteChannel(msg.channel.id,"Album Submitter asked to delete submission")
    bot.deleteMessage(auth.levyRaatiChannel,msg.channel.id,"Album Submitter asked to delete submission")
    return

}

async function getAlbum(id) {
    const Album = mongoose.model('Album', albumSchema);
    await mongoose.connect(auth.mongoUrlJivesLevyraati);
    let albumData;
    await Album
        .findOne({albumReviewTopicDiscord: id})
        .then( res => {
            albumData=res;
            mongoose.connection.close();
        })
    return albumData 
}

async function deleteAlbumFromMongo(id) {
    const Album = mongoose.model('Album', albumSchema);
    await mongoose.connect(auth.mongoUrlJivesLevyraati);
    await Album
        .deleteOne({albumReviewTopicDiscord: id})
        .then( res => {
            mongoose.connection.close();
        })
    return
}

async function addSpotifyAlbumToReviews(bot,msg,args) {
    //Onko ylipäätään viestiä ja oikealla kanavalla
    if(!msg || msg.channel.id!==auth.levyRaatiSubmissionsChannel) {
        return
    }

    //Ei paskota hommia jos ei ole viestiä tai komento ei ole oikea
    if(!msg || (msg.content.split(' ')[1]!=="spotify")) {
        return
    }

    const submission = args[0]
    //Onko submissionissa validi spotify share linkki
    if (!(submission.includes(auth.spotifyShareLink))) {
        vastaa(bot,msg,", yritit lisätä arvioihin jotain Spotifystä antamatta kelvollista linkkiä. Levyraatiin vastaanotetaan Spotifystä vain albumeita ja singlejä, ei yksittäisiä kappaleita.")
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
    const {albumJson,title,artists,albumId,albumType,img,imgSmall,label,releaseYear,copyrights} = await getSpotifyApiData(submission,accessToken)
    if (albumJson === undefined) {
        loggaa(bot,"Ei albumdataa?")
        return
    }

    let submitterId = msg.author.id;
    let submitterName = msg.author.username;
    
    // tarkistetaan onko levy jo tietokannassa
    const itsDARE = await isAlbumInDatabase(albumId);
    if (itsDARE===true) {
        loggaa(bot, ("Albumi "+artists+" - "+title+" on jo tietokannassa (id "+albumId+")"))
        return
    }

    
    // ON OK LISÄTÄ ALBUMI KANAVALLE
    loggaa(bot,("Albumi "+title+" voidaan lisätä"))
    const reviewThread = await postAlbumTopicToDiscord(bot,artists,title,releaseYear,submitterName,submission);

    //Nyt kun viestin id on tiedossa voidaan laittaa mongoon
    const Album = mongoose.model('Album', albumSchema);
    const albumToAdd = new Album({
        albumSubmitterId: submitterId,
        albumSubmitterUserName: submitterName,
        albumLink: submission,
        albumReviewTopicDiscord: reviewThread,
        albumPlatform : "Spotify",
        albumId: albumId,
        albumType: albumType,
        albumTitle: title,
        albumArtists: artists,
        albumLabel: label,
        albumReleaseDate: releaseYear,
        albumImg : img,
        albumImgSmall : imgSmall,
        albumCopyrights : copyrights,
        reviewCount : 0,
        reviewAverage :0,
        albumReviews : [],
    })
    await pushAlbumToMongo(albumToAdd)
    
    return
}

async function postAlbumTopicToDiscord(bot,artists,title,year,submitter,submission) {
    const ylaKanavaViesti = artists+" - "+title+" ("+year+") "+submission
    const arvioviesti = "Lähettäjä: "+submitter+". Keskustelu ja arviot tähän ketjuun!"
    const reviewMSG = await bot.createMessage(auth.levyRaatiChannel, ylaKanavaViesti);
    const reviewThread = await bot.createThreadWithMessage(reviewMSG.channel.id,reviewMSG.id,{name:title});
    await bot.createMessage(reviewThread.id,arvioviesti)
    return reviewThread.id
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
    const artists = stringifyArtists(albumJson.artists.map((x)=> x.name));
    const albumId = albumJson.id;
    const albumType = albumJson.album_type;
    const img = albumJson.images[1].url;
    const imgSmall =albumJson.images[2].url;
    const label = albumJson.label;
    const releaseYear = albumJson.release_date;
    const copyrights = albumJson.copyrights;
    return {albumJson,title,artists,albumId,albumType,img,imgSmall,label,releaseYear,copyrights}
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

async function isAlbumInDatabase(id) {
    const Album = mongoose.model('Album', albumSchema);
    await mongoose.connect(auth.mongoUrlJivesLevyraati);
    let albumData;
    await Album
        .findOne({albumId: id})
        .then( res => {
            console.log("Data Mongosta: ",res)
            albumData=res;
            mongoose.connection.close();
        })
    if (albumData===null) {
        return false
    } else return true   
}
async function pushAlbumToMongo(album) {
    await mongoose.connect(auth.mongoUrlJivesLevyraati)
    album
        .save()
        .then(result => {
            console.log('Albumi lisätty tietokantaan: ',result)
            mongoose.connection.close();
        })
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