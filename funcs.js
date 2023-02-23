import { auth } from "./auth.js";
import axios from 'axios';
import mongoose from 'mongoose';
import { 
    addAlbumToLocal, 
    removeAlbumFromLocal,
    upDateRatingLocal, 
} from "./jives.js";

//HOT SHIT
const spotifyApiAuth = process.env.SPOTIFYAPI_AUTH
const mongoUrl = process.env.MONGOURL_JIVES;

//MONGO STUFF
export const albumSchema = new mongoose.Schema({
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
export const Album = mongoose.model('Album', albumSchema);

const reviewSchema = new mongoose.Schema({
    reviewerId: String,
    reviewerName: String,
    reviewType: String,
    albumId: String,
    rating: Number,
})
const Review = mongoose.model('Review', reviewSchema)



//LISTA BOTIN FUNKTIOISTA   
export async function commandGet(commandName,msg,args,bot) {
    const commandArray = [
        ['submit'],
        ['dELETEALBUM'],
        ['rate'],
        ['deleterating'],
        ['score'],
        ['leaderboard'],
        ['huhuu'],
        ['myrating'],
        ['greetMe'],
    ]
    const commandIndex = commandArray.indexOf(commandArray.find(c => c[0]===commandName))
    return commandIndex
}

export async function commandExec(msg,args,commandIndex,cmd,bot) {
    const commandArray = [
        ['submit', addSpotifyAlbumToReviews(bot,cmd,msg,args)],
        ['dELETEALBUM', removeAlbumFromReviews(bot,cmd,msg)],
        ['rate', rateAlbum(bot,cmd,msg,args)],
        ['deleterating', deleteMyRating(bot,cmd,msg,args)],
        ['score', showRatingAverage(bot,cmd,msg,args)],
        ['leaderboard', showLeaderBoard(bot,cmd,msg,args)],
        ['huhuu', pingJives(bot,cmd,msg,args)],
        ['myrating', showMyRating(bot,cmd,msg,args)],
        ['greetMe', greetMe(bot,cmd,msg,args)],
    ]
    return await commandArray[commandIndex][1]
    }

//ITSE FUNKTIOT

export async function rateByEmote(bot,cmd,albumIdToRate,rating,reactor,msg) {
    //Ei paskota hommia jos ei ole viestiä tai komento ei ole oikea
    console.log("Emojiarvio alkaa")
    if(cmd!== "emoteRating") {
        return
    }
    
    //Katsotaan onko käyttäjän arviota jo albumin arvioissa
    const albumData=(await getAlbum(albumIdToRate));
    if (albumData===null) {
        console.log("albumia ei löydy, review topic: "+albumIdToRate)
        return
    }
    const albumReviews=albumData.albumReviews;
    const oldReviewObject = albumReviews.find(e => e.reviewerId === reactor.id )

    //-1 jos vanhaa arviota ei ole, jos on, tämän indeksi otetaan talteen
    const indexOfOldReview = albumReviews.indexOf(oldReviewObject)
    
    const reviewToAdd = new Review({
        reviewerId: reactor.id,
        reviewerName: reactor.username,
        reviewType: "reaction",
        albumId: msg.id,
        rating: rating,
    })

    //console.log("Vanhan arvion index: ",indexOfOldReview)
    //console.log("Uusi arvio: ",reviewToAdd)
    
    // Lasketaan uusi average
    let reviewsAverage = albumData.reviewAverage;
    const reviewCount = albumData.reviewCount;

    //otetaan direct message kanava vastausta varten
    const DmKanavaObj = await bot.getDMChannel(reactor.id)
    const DmKanava = DmKanavaObj.id

    if (indexOfOldReview===-1) {
        //Lasketaan uusi keskiarvo arvosanoista
        reviewsAverage=Math.floor(reviewsAverage+((rating-reviewsAverage)/(reviewCount+1)))
        console.log("Uusi average on ",reviewsAverage)
        await pushReviewToMongo(bot,msg,reviewToAdd,reviewsAverage)
        upDateRatingLocal(albumData,reviewsAverage,1)
        bot.createMessage(DmKanava,(reactor.mention+", annoit levylle "+albumData.albumTitle+" **"+(rating/10)+"** pistettä!"))
    }

    // Käyttäjä on jo arvioinut levyn, päivitetään arvosana uuteen
    else {
        const oldRating = oldReviewObject.rating
        reviewsAverage = Math.floor(reviewsAverage+((rating-oldRating)/reviewCount)) 
        console.log("Uusi average on ",reviewsAverage)
        await updateMongoReview(bot, msg, reviewToAdd,reviewsAverage)
        upDateRatingLocal(albumData,reviewsAverage,0)
        bot.createMessage(DmKanava,(reactor.mention+", annoit levylle "+albumData.albumTitle+" **"+(rating/10)+"** pistettä!"))
    }
    return
}


async function greetMe(bot,cmd,msg,args) {
    if (!msg || cmd!=="greetMe") {
        return
    }
    const channel= await bot.getDMChannel(msg.author.id)
    await vastaaDm(bot,msg,"Terve!")
}


async function showMyRating(bot,cmd,msg,args) {
    if(!msg || cmd!=="myrating") {
        return
    }
    // onko public message = "p"
    let pub = args[0]
    if (args[0] === undefined) {
        pub = "n";
    }
    const albumData=(await getAlbum(msg.channel.id));
    if (albumData===null) {
        await vastaaDmJaPoista(bot,msg,"En tiedä minkä albumin arvosanaa yrität hakea. Kutsu funktiota vain levyn threadissa.")
        return
    }
    
    const arviosi = albumData.albumReviews.find(r => r.reviewerId === msg.author.id)
    const albumi = albumData.albumTitle
    console.log(arviosi)
    if (pub==="p") {
        if (arviosi===undefined) {
            vastaaJaPoista(bot,msg,(msg.author.mention+", et ole vielä antanut tälle levylle arvosanaa."))
        } else {
            vastaaJaPoista(bot,msg,(msg.author.mention+", olet antanut albumille **"+(arviosi.rating/10)+"** pistettä!"))
        }
    } else {
        if (arviosi===undefined) {
            await vastaaDmJaPoista(bot,msg,(msg.author.mention+", et ole vielä antanut levylle "+albumi+" arvosanaa."))
        } else {
            await vastaaDmJaPoista(bot,msg,(msg.author.mention+", olet antanut albumille *"+albumi+"**"+(arviosi.rating/10)+"** pistettä!"))
        }
    }
}

async function pingJives(bot,cmd,msg,args) {
    if(!msg || cmd !=="huhuu") {
        return
    }

    const upHours = Math.floor(bot.uptime/ 3600000)
    const upMinutes = Math.floor(((bot.uptime-upHours*3600000-upDays*86400000))/60000)
    const upSeconds = Math.floor(((bot.uptime -upMinutes*60000-upHours*3600000-upDays*86400000)) / 1000)
    vastaa(bot,msg,("Charming evening, maa-a-a'am! \nOlen ollut käynnissä "+upHours+" tuntia, "+upMinutes+" minuuttia ja "+upSeconds+" sekuntia."))
    return
}

async function showLeaderBoard(bot,cmd,msg,args) {
    if(!msg || cmd !== "leaderboard") {
        return
    }
    
    // onko public message = "p"
    let pub = args[0]
     if (args[0] === undefined) {
        pub = "n";
    }

    let allAlbums;
    await Album
        .find({})
        .then(res => {
            allAlbums=res
        })
    const lb = allAlbums.map(e=> [e.albumArtists,e.albumTitle,(e.reviewAverage/10), e.reviewCount])
    console.log("Kaikki:" ,lb)
    const lbSorted = lb.sort((a,b) => {return b[2] - a[2]}).slice(0,10)
    console.log("Järjestyksessä: ", lbSorted)
    let leaderBoardMsg = "**TOP 10:** \n\n";
    const leaderboardEmotes = [':one:', ':two:', ':three:', ':four:',':five:',':six:',':seven:',':eight:',':nine:',':keycap_ten:'];

    for (let i=0;i<lbSorted.length;i++) {
        leaderBoardMsg = leaderBoardMsg.concat(leaderboardEmotes[i]+" **"+lbSorted[i][0]+" - "+lbSorted[i][1]+"**: "+lbSorted[i][2]+" ("+lbSorted[i][3]+") \n");
    }
    if (pub==="p") {
        vastaa(bot,msg,leaderBoardMsg);
    } else {
        vastaaDmJaPoista(bot,msg,leaderBoardMsg)
    }
}

async function showRatingAverage(bot,cmd,msg,args){
    if(!msg || cmd!== "score") {
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
        })
    return
}

async function deleteMyRating(bot,cmd,msg,args) {
    if(!msg || cmd!== "deleterating") {
        return
    }
    // onko public message = "p"
    let pub = args[0]
    if (args[0] === undefined) {
        pub = "n";
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
    upDateRatingLocal(albumData,newAverage,-1)
    if (pub==="p") {
        vastaaJaPoista(bot,msg,(msg.author.username+" poisti arvionsa."))
    } else {
        vastaaDmJaPoista(bot,msg,("Poistit arviosi levystä "+albumData.albumTitle))
    }
}

async function rateAlbum(bot,cmd,msg,args) {
    //Ei paskota hommia jos ei ole viestiä tai komento ei ole oikea
    if(!msg || cmd!== "rate") {
        return
    }

    // onko public message = "p"
    console.log("argumentti 1= "+args[1])
    let pub = args[1]
    if (args[1] === undefined) {
        pub = "n";
    }
    console.log("pub status ? "+pub)

    //Konvertoidaan rating yhdenmukaiseksi asteikolle 0-1000
    let rating=parseRating(args[0],bot,msg)
    if (rating===undefined) {
        vastaaDmJaPoista(bot,msg,("Tarkista arvosanasi muotoilu! Anna pisteesi joko kokonaislukuna 0-100 tai murtolukuna, esim: 7/10. Arvosanasi _'"+args[0]+ "'_ ei kelpaa."));
        return
    }
    
    //Katsotaan onko käyttäjän arviota jo albumin arvioissa
    const albumData=(await getAlbum(msg.channel.id));
    if (albumData===null) {
        vastaaDmJaPoista(bot,msg,(msg.author.username+", en tiedä mitä albumia yrität arvostella. Kutsu arviointifunktiota vain levyn threadissa."))
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

    //arvostellaan julkisesti
    if (pub==="p") {
        // Käyttäjän arviota tälle levylle ei vielä ole
        if (indexOfOldReview===-1) {
            //Lasketaan uusi keskiarvo arvosanoista
            reviewsAverage=Math.floor(reviewsAverage+((rating-reviewsAverage)/(reviewCount+1)))
            console.log("Uusi average on ",reviewsAverage)
            await pushReviewToMongo(bot,msg,reviewToAdd,reviewsAverage)
            upDateRatingLocal(albumData,reviewsAverage,1)
            vastaaJaPoista(bot,msg,(msg.author.mention+" antoi levylle **"+(rating/10)+"** pistettä!"))
        }

        // Käyttäjä on jo arvioinut levyn, päivitetään arvosana uuteen
        else {
            const oldRating = oldReviewObject.rating
            reviewsAverage = Math.floor(reviewsAverage+((rating-oldRating)/reviewCount)) 
            console.log("Uusi average on ",reviewsAverage)
            await updateMongoReview(bot, msg, reviewToAdd,reviewsAverage)
            upDateRatingLocal(albumData,reviewsAverage,0)
            vastaaJaPoista(bot,msg,(msg.author.mention+" päivitti arvionsa: **"+(oldRating/10)+"** :arrow_right: **"+(rating/10)+"** pistettä!"))
        }
    }
    //arvostellaan yksityisesti
    else {
        if (indexOfOldReview===-1) {
            //Lasketaan uusi keskiarvo arvosanoista
            reviewsAverage=Math.floor(reviewsAverage+((rating-reviewsAverage)/(reviewCount+1)))
            console.log("Uusi average on ",reviewsAverage)
            await pushReviewToMongo(bot,msg,reviewToAdd,reviewsAverage)
            upDateRatingLocal(albumData,reviewsAverage,1)
            vastaaDmJaPoista(bot,msg,(msg.author.mention+", annoit levylle "+albumData.albumTitle+" **"+(rating/10)+"** pistettä!"))
        }

        // Käyttäjä on jo arvioinut levyn, päivitetään arvosana uuteen
        else {
            const oldRating = oldReviewObject.rating
            reviewsAverage = Math.floor(reviewsAverage+((rating-oldRating)/reviewCount)) 
            console.log("Uusi average on ",reviewsAverage)
            await updateMongoReview(bot, msg, reviewToAdd,reviewsAverage)
            upDateRatingLocal(albumData,reviewsAverage,0)
            vastaaDmJaPoista(bot,msg,(msg.author.mention+", päivitit arviosi levylle "+albumData.albumTitle+" : **"+(oldRating/10)+"** :arrow_right: **"+(rating/10)+"** pistettä!"))
        }
    }
    
    return
}

async function deleteMongoReview(bot,msg,ratingAverage) {
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
        })
    return
} 


async function updateMongoReview(bot,msg,Review,ratingAverage) {
    await deleteMongoReview(bot,msg,ratingAverage)
    await pushReviewToMongo(bot,msg,Review,ratingAverage)
    return
    }

async function pushReviewToMongo(bot,msg,Review,ratingAverage) {
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

async function removeAlbumFromReviews(bot,cmd,msg,args) {
    //Ei paskota hommia jos ei ole viestiä tai komento ei ole oikea
    if(!msg || cmd!== "dELETEALBUM") {
        return
    }
    
    //Haetaan levy
    const reviewMongo = await getAlbum(msg.channel.id)
    console.log(reviewMongo)
    const submitterId = reviewMongo.albumSubmitterId

    //Jos delete-funktion kutsuja ei ole botin omistaja tai alkuperäisen arvostelun lähettäjä, ei saa poistaa
    if (msg.author.id !== submitterId) {
        if (msg.author.id !== auth.HenKonenDiscordId) {
            vastaaJaPoista(bot,msg,(msg.author.username+", et voi poistaa toisen lähettämää arviota!"))
            return
        }
    }
    
    //Luvallinen ihminen poistamassa, poistetaan
    await deleteAlbumFromMongo(msg.channel.id)
    removeAlbumFromLocal(reviewMongo)
    bot.deleteChannel(msg.channel.id,"Album Submitter asked to delete submission")
    bot.deleteMessage(auth.levyRaatiChannel,msg.channel.id,"Album Submitter asked to delete submission")
    return

}

async function getAlbum(id) {
    let albumData;
    await Album
        .findOne({albumReviewTopicDiscord: id})
        .then( res => {
            albumData=res;
        })
    return albumData 
}

async function deleteAlbumFromMongo(id) {
    await Album
        .deleteOne({albumReviewTopicDiscord: id})
        .then( res => {
        })
    return
}

async function addSpotifyAlbumToReviews(bot,cmd,msg,args) {
    //Ei paskota hommia jos ei ole viestiä tai komento ei ole oikea
    if(!msg || cmd!== "submit") {
        return
    }

    const submission = args[0]
    //Onko submissionissa validi spotify share linkki
    if (!(submission.includes(auth.spotifyShareLink))) {
        const viesti2 = 
        vastaa(bot,msg,(msg.author.mention+", yritit lisätä arvioihin jotain Spotifystä antamatta kelvollista linkkiä. Levyraatiin vastaanotetaan Spotifystä vain albumeita ja singlejä, ei yksittäisiä kappaleita."))
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
        const viesti = 
        vastaaJaPoista(bot, msg, (msg.author.mention+", albumi **"+title+"** on jo lähetetty! :arrow_right: https://discord.com/channels/1031479962005409802/"+reviewTopic));
        return
    }

    
    // ON OK LISÄTÄ ALBUMI KANAVALLE
    loggaa(bot,("Albumi "+title+" voidaan lisätä"))
    const reviewThread = await postAlbumTopicToDiscord(bot,artists,title,releaseYear,msg.author,submission,img);

    //Nyt kun viestin id on tiedossa voidaan laittaa mongoon
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
    addAlbumToLocal(albumToAdd)
    vastaaJaPoista(bot,msg,(":cd: Albumi **"+artists+"** - **"+title+"** vastaanotettu! :arrow_right: https://discord.com/channels/1031479962005409802/"+reviewThread))
    //tehdään arviointireaktiot
    //,'5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'
    const ratingEmotes = ['1️⃣', '2️⃣', '3️⃣', '4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    for (let i=0;i<ratingEmotes.length;i++) {
        await bot.addMessageReaction("1070620790816510003",reviewThread,ratingEmotes[i])
    }
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

async function vastaaDmJaPoista(bot,msg,vastaus) {
    const Dmkanava = await bot.getDMChannel(msg.author.id)
    bot.createMessage(Dmkanava.id,vastaus)
    return bot.deleteMessage(msg.channel.id,msg.id,"Deleting function call") 
}
function vastaaJaPoista(bot,msg,vastaus) {
    const kanava = msg.channel.id
    bot.createMessage(kanava,vastaus)
    return bot.deleteMessage(msg.channel.id,msg.id,"Deleting function call") 
}
function vastaa(bot,msg,vastaus) {
    const kanava = msg.channel.id
    return bot.createMessage(kanava,vastaus)
}

async function vastaaDm(bot,msg,vastaus) {
    const Dmkanava = await bot.getDMChannel(msg.author.id)
    return bot.createMessage(Dmkanava.id,vastaus)
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
    let albumData;
    let reviewTopic;
    let itsDARE;
    await Album
        .findOne({albumId: id})
        .then( res => {
            console.log("Data Mongosta: ",res)
            albumData=res;
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
    await album
        .save()
        .then(result => {
            console.log('Albumi lisätty tietokantaan: ',result)
        })
}
