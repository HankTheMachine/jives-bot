import { auth } from "./auth.js";
import axios from 'axios';
import mongoose from 'mongoose';

//HOT SHIT
const mongoUrlJivesLevyraati = process.env.MONGOURL_JIVES
const spotifyApiAuth = process.env.SPOTIFYAPI_AUTH

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
const Album = mongoose.model('Album', albumSchema);

const reviewSchema = new mongoose.Schema({
    reviewerId: String,
    reviewerName: String,
    reviewType: String,
    albumId: String,
    rating: Number,
})
const Review = mongoose.model('Review', reviewSchema)
mongoose.set('strictQuery',false)


//LISTA BOTIN FUNKTIOISTA   
export async function commandGet(commandName,msg,args,bot) {
    const commandArray = [
        ['submit'],
        ['DELETEALBUM'],
        ['rate'],
        ['deleterating'],
        ['score'],
        ['leaderboard'],
        ['huhuu'],
    ]
    const commandIndex = commandArray.indexOf(commandArray.find(c => c[0]===commandName))
    return commandIndex
}

export async function commandExec(msg,args,commandIndex,bot) {
    const commandArray = [
        ['submit', addSpotifyAlbumToReviews(bot,msg,args)],
        ['DELETEALBUM', removeAlbumFromReviews(bot,msg)],
        ['rate', rateAlbum(bot,msg,args)],
        ['deleterating', deleteMyRating(bot,msg,args)],
        ['score', showRatingAverage(bot,msg,args)],
        ['leaderboard', showLeaderBoard(bot,msg,args)],
        ['huhuu', pingJives(bot,msg,args)],
    ]
    //mongoose.connect(mongoUrlJivesLevyraati)
    return await commandArray[commandIndex][1]
    }

//ITSE FUNKTIOT

async function pingJives(bot,msg,args) {
    if(!msg || (msg.content.split(' ')[1]!=="huhuu")) {
        return
    }
    const upDays = Math.floor(bot.uptime/86400000)
    const upHours = Math.floor(((bot.uptime-upDays*86400000)) / 3600000)
    const upMinutes = Math.floor(((bot.uptime-upHours*3600000-upDays*86400000))/60000)
    const upSeconds = Math.floor(((bot.uptime -upMinutes*60000-upHours*3600000-upDays*86400000)) / 1000)
    vastaa(bot,msg,("Charming evening, maa-a-a'am! \nOlen ollut käynnissä "+upDays+" päivää, "+upHours+" tuntia, "+upMinutes+" minuuttia ja "+upSeconds+" sekuntia."))
    return
}

async function showLeaderBoard(bot,msg,args) {
    if(!msg || (msg.content.split(' ')[1]!=="leaderboard")) {
        return
    }
    
    mongoose.connect(mongoUrlJivesLevyraati);
    let allAlbums;
    await Album
        .find({})
        .then(res => {
            allAlbums=res
        })
        //.then(mongoose.connection.close())
    const lb = allAlbums.map(e=> [e.albumArtists,e.albumTitle,(e.reviewAverage/10), e.reviewCount])
    console.log("Kaikki:" ,lb)
    const lbSorted = lb.sort((a,b) => {return b[2] - a[2]}).slice(0,10)
    console.log("Järjestyksessä: ", lbSorted)
    let leaderBoardMsg = "**TOP 10:** \n\n";
    const leaderboardEmotes = [':one:', ':two:', ':three:', ':four:',':five:',':six:',':seven:',':eight:',':nine:',':keycap_ten:'];

    for (let i=0;i<lbSorted.length;i++) {
        leaderBoardMsg = leaderBoardMsg.concat(leaderboardEmotes[i]+" **"+lbSorted[0][0]+" - "+lbSorted[0][1]+"**: "+lbSorted[0][2]+" ("+lbSorted[0][3]+") \n");
    }
    vastaaJaPoista(bot,msg,leaderBoardMsg);
}

async function showRatingAverage(bot,msg,args){
    if(!msg || (msg.content.split(' ')[1]!=="score")) {
        return
    }
    const albumData=(await getAlbum(msg.channel.id));
    if (albumData===null) {
        vastaa(bot,msg, "En tiedä minkä albumin arvosanaa yrität hakea. Kutsu funktiota vain levyn threadissa.")
        return
    }
    let arvioidenKA=0;
    const arvioidenMaara = albumData.albumReviews.length
    for (let i=0; i<arvioidenMaara; i++) {
        arvioidenKA = arvioidenKA+albumData.albumReviews[i].rating
    } 
    if (arvioidenMaara===0) {
        arvioidenKA=0;
        vastaaJaPoista(bot,msg,"Tätä levyä ei ole vielä arvosteltu.")
        return
    } else {
        arvioidenKA=Math.floor(arvioidenKA/arvioidenMaara)
    }
    console.log(arvioidenKA)
    await setRatingAverage(bot,msg,arvioidenKA)
    const KAin100 = Math.floor(arvioidenKA/10)
    vastaaJaPoista(bot,msg,("Levyn pistekeskiarvo on **"+KAin100+"** :chart_with_upwards_trend: _("+arvioidenMaara+" arviota)_"))
    return
}

async function setRatingAverage(bot,msg,ratingAverage) {
    //const Album = mongoose.model('Album', albumSchema);
    mongoose.connect(mongoUrlJivesLevyraati);
    await Album
        .updateOne(
            {
                albumReviewTopicDiscord : msg.channel.id
            },
            {
                $set: {reviewAverage : ratingAverage},
            },
        )
        .then(res => {
            console.log("Response yrityksestä asettaa mongon average: ",res)
            //mongoose.connection.close()
        })
    return
}

async function deleteMyRating(bot,msg,args) {
    if(!msg || (msg.content.split(' ')[1]!=="deleterating")) {
        return
    }
    const reviewerId = msg.author.id;
    const albumData=(await getAlbum(msg.channel.id));
    const oldReviewObject = albumData.albumReviews.find(e => e.reviewerId === msg.author.id)
    // Arviota ei löydy
    if (oldReviewObject===undefined) {
        vastaaJaPoista(bot,msg,(msg.author.username+", et ole arvostellut tätä levyä vielä!"))
        return
    }
    //arvio löytyy, poistetaan
    const rating = oldReviewObject.rating
    const newAverage = (albumData.reviewAverage - Math.floor(rating/albumData.reviewCount))
    await deleteMongoReview(bot,msg,newAverage)
    vastaaJaPoista(bot,msg,(msg.author.username+" poisti arvionsa."))
}

async function rateAlbum(bot,msg,args) {
    //Ei paskota hommia jos ei ole viestiä tai komento ei ole oikea
    if(!msg || (msg.content.split(' ')[1]!=="rate")) {
        return
    }
    //Konvertoidaan rating yhdenmukaiseksi asteikolle 0-1000
    let rating=parseRating(args[0],bot,msg)
    if (rating===undefined) {
        vastaaJaPoista(bot,msg,(msg.author.username+", tarkista arvosanasi muotoilu! Anna pisteesi joko kokonaislukuna 0-100 tai murtolukuna, esim: 7/10. Arvosanasi _'"+args[0]+ "'_ ei kelpaa."));
        return
    }
    
    //Katsotaan onko käyttäjän arviota jo albumin arvioissa
    const albumData=(await getAlbum(msg.channel.id));
    if (albumData===null) {
        vastaaJaPoista(bot,msg,(msg.author.username+", en tiedä mitä albumia yrität arvostella. Kutsu arviointifunktiota vain levyn threadissa."))
        return
    }
    const albumReviews=albumData.albumReviews;
    const oldReviewObject = albumReviews.find(e => e.reviewerId === msg.author.id )

    //-1 jos vanhaa arviota ei ole, jos on, tämän indeksi otetaan talteen
    const indexOfOldReview = albumReviews.indexOf(oldReviewObject)
    
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
        vastaaJaPoista(bot,msg,(msg.author.mention+" antoi levylle **"+(rating/10)+"** pistettä!"))
    }

    // Käyttäjä on jo arvioinut levyn, päivitetään arvosana uuteen
    else {
        const oldRating = oldReviewObject.rating
        reviewsAverage = Math.floor(reviewsAverage+((rating-oldRating)/reviewCount)) 
        console.log("Uusi average on ",reviewsAverage)
        await updateMongoReview(bot, msg, reviewToAdd,reviewsAverage)
        vastaaJaPoista(bot,msg,(msg.author.mention+" päivitti arvionsa: **"+(oldRating/10)+"** :arrow_right: **"+(rating/10)+"** pistettä!"))
    }
    
    return
}

async function deleteMongoReview(bot,msg,ratingAverage) {
    //const Album = mongoose.model('Album', albumSchema);
    mongoose.connect(mongoUrlJivesLevyraati);
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
            //mongoose.connection.close();
        })
    return
} 

async function updateMongoReview(bot,msg,Review,ratingAverage) {
    await deleteMongoReview(bot,msg,ratingAverage)
    await pushReviewToMongo(bot,msg,Review,ratingAverage)
    return
    }

async function pushReviewToMongo(bot,msg,Review,ratingAverage) {
    //const Album = mongoose.model('Album', albumSchema);
    mongoose.connect(mongoUrlJivesLevyraati);
    await Album
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
            //setTimeout((mongoose.connection.close()),1000);
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

    if (isNaN(convertedRating) || convertedRating>1000) {
        return undefined
    } else {
        return convertedRating
    }
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
        vastaaJaPoista(bot,msg,(msg.author.username+", et voi poistaa toisen lähettämää arviota!"))
        return
    }
    
    //Luvallinen ihminen poistamassa, poistetaan
    await deleteAlbumFromMongo(msg.channel.id)
    bot.deleteChannel(msg.channel.id,"Album Submitter asked to delete submission")
    bot.deleteMessage(auth.levyRaatiChannel,msg.channel.id,"Album Submitter asked to delete submission")
    return

}

async function getAlbum(id) {
    //const Album = mongoose.model('Album', albumSchema);
    mongoose.connect(mongoUrlJivesLevyraati);
    let albumData;
    await Album
        .findOne({albumReviewTopicDiscord: id})
        .then( res => {
            albumData=res;
            //mongoose.connection.close();
        })
    return albumData 
}

async function deleteAlbumFromMongo(id) {
    //const Album = mongoose.model('Album', albumSchema);
    mongoose.connect(mongoUrlJivesLevyraati);
    await Album
        .deleteOne({albumReviewTopicDiscord: id})
        .then( res => {
            //mongoose.connection.close();
        })
    return
}

async function addSpotifyAlbumToReviews(bot,msg,args) {
    //Onko ylipäätään viestiä
    if(!msg) {
        return
    }

    //Ei paskota hommia jos ei ole viestiä tai komento ei ole oikea
    if(!msg || (msg.content.split(' ')[1]!=="submit")) {
        return
    }

    const submission = args[0]
    //Onko submissionissa validi spotify share linkki
    if (!(submission.includes(auth.spotifyShareLink))) {
        vastaaJaPoista(bot,msg,", yritit lisätä arvioihin jotain Spotifystä antamatta kelvollista linkkiä. Levyraatiin vastaanotetaan Spotifystä vain albumeita ja singlejä, ei yksittäisiä kappaleita.")
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
    const {itsDARE,reviewTopic} = await isAlbumInDatabase(albumId);
    if (itsDARE===true) {
        vastaaJaPoista(bot, msg, (msg.author.username+", lisäämäsi albumi on jo lähetetty! :arrow_right: https://discord.com/channels/1031479962005409802/"+reviewTopic));
        return
    }

    
    // ON OK LISÄTÄ ALBUMI KANAVALLE
    loggaa(bot,("Albumi "+title+" voidaan lisätä"))
    const reviewThread = await postAlbumTopicToDiscord(bot,artists,title,releaseYear,msg.author,submission,img);

    //Nyt kun viestin id on tiedossa voidaan laittaa mongoon
    //const Album = mongoose.model('Album', albumSchema);
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
    vastaaJaPoista(bot,msg,(":cd: Albumi **"+artists+"** - **"+title+"** vastaanotettu! :arrow_right: https://discord.com/channels/1031479962005409802/"+reviewThread))
    return
}

async function postAlbumTopicToDiscord(bot,artists,title,year,submitter,submission,img) {
    const ylaKanavaViesti = img
    const arvioviesti = "**"+artists+"** - **"+title+"**"
    const arvioviesti2 = "Lähettäjä: "+submitter.mention+". Keskustelu ja arviot tähän ketjuun!"
    const reviewMSG = await bot.createMessage(auth.levyRaatiChannel, ylaKanavaViesti);
    const reviewThread = await bot.createThreadWithMessage(reviewMSG.channel.id,reviewMSG.id,{name:title});
    await bot.createMessage(reviewThread.id,submission)
    bot.createMessage(reviewThread.id,arvioviesti)
    bot.createMessage(reviewThread.id,arvioviesti2)
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
    myHeaders.append("Authorization", spotifyApiAuth);
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
    //const Album = mongoose.model('Album', albumSchema);
    mongoose.connect(mongoUrlJivesLevyraati);
    let albumData;
    let reviewTopic;
    let itsDARE;
    await Album
        .findOne({albumId: id})
        .then( res => {
            console.log("Data Mongosta: ",res)
            albumData=res;
            //mongoose.connection.close();
        })
    if (albumData===null) {
        itsDARE = false;
    } else {
        itsDARE = true
        reviewTopic=albumData.albumReviewTopicDiscord
    }
    return {itsDARE,reviewTopic}   
}
async function pushAlbumToMongo(album) {
    mongoose.connect(mongoUrlJivesLevyraati)
    await album
        .save()
        .then(result => {
            console.log('Albumi lisätty tietokantaan: ',result)
            //mongoose.connection.close();
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