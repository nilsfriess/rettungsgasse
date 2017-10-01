#!/usr/bin/env nodejs

let fetch = require('fetch').fetchUrl
let xml2json = require('xml2json')
let _ = require('lodash')
let fs = require('fs')
let geocoder = require('node-geocoder')({ apiKey: 'AIzaSyCmYzPMAThClsbQU5kC30x6Vc-dLaBGHdM' })
let app = require('express')()

// set true to use demo xml file
let debug = false
let readLocal = false

//demo coordinates of the car 
let coords = []

app.get('/', (req, res, err) => {
    res.redirect('/api')
})

app.get('/api', (req, res, err) => {
    res.send(`
    <html>
    <body style="font-family: Helvetica, Arial, Sans-Serif; padding: 70px">
        <h1>How to use this API</h1>
        <p>Go to /api/lonlat and pass the last two coordinates of your car, e.g.</p>
        <code>https://rescuealley.tech/api/lonlat/47.1232,6.123124+5.12313,4.2326</code>
        <br>
        <p></p>
    </body>
    </html>`)
})

app.get('/api/lonlat/:coords', (req, res, err) => {
    if (!req.params.coords) {
        res.redirect('/api')
    }
    checkForRescueAlley(debug ? coords : req.params.coords, (response) => {
        res.json(response)
    })
})

app.get('/api/test/lonlat/:coords', (req, res, err) => {
    checkForRescueAlley(debug ? coords : req.params.coords, (response) => {
        res.json(response)
    })
})

app.get('/api/test/lonlat', (req, res, err) => {
    debug = true
    readLocal = true

    coords = [
        [48.356701, 7.793980],
        [48.358688, 7.795312],

    ]

    checkForRescueAlley(coords, (response) => {
        res.json(response)
    })
})

app.get('/api/lonlat', (req, res, err) => {
    res.redirect('/api')
})


app.listen(4000, () => {
    console.log("Server is listening on port 4000")
})


//main();

/*#########################################################################
function definitions
#########################################################################*/


function checkForRescueAlley(coords, cb) {

    // extract the coordinates from string in the url
    if (!debug) {
        coords = coords.split('+')
        coords[0] = coords[0].split(',')
        coords[1] = coords[1].split(',')

        coords[0][0] = parseFloat(coords[0][0])
        coords[0][1] = parseFloat(coords[0][1])
        coords[1][0] = parseFloat(coords[1][0])
        coords[1][1] = parseFloat(coords[1][1])
    }


    console.log(`Checking the following coordinates: ${coords}`)

    // response object
    let shouldShowWarning = false
    let information = {
        message: "",
        streetName: "",
        warning: ""
    }

    // get all traffic jams that are accidents
    fetch('https://verkehrsmeldungen.polizei-bw.de/TicMessages.ashx?region=BW', async (error, meta, body) => {
        if (error) {
            console.error(error)
            cb({ error })
            return
        }

        let jsonBody = {}

        if (readLocal) {
            jsonBody = xml2json.toJson(fs.readFileSync('./TicMessages.xml', 'utf8'), { object: true })
        } else {
            jsonBody = xml2json.toJson(body.toString(), {
                object: true,
            })
        }

        // add all traffic messages that are accidents to the accident array
        let accidents = []
        jsonBody.vwd4.topic.forEach((topic) => {
            if (_.isArray(topic.message)) {
                topic.message.filter((message) => {
                    if (!_.isEmpty(message.signs.accident) && isAccidentInArea(message, coords[0])) { // message.signs.accident is empty if not a traffic jam
                        accidents.push(message)
                    }
                })
            }
        })

        if (accidents.length === 0) {
            information.message = 'No traffic jams found in your area..'
            if (debug) console.log(information.message)
            shouldShowWarning = false
            cb({
                shouldShowWarning,
                information
            })
            return
        } else {
            if (debug) console.log(`Found ${accidents.length} traffic jam${accidents.length == 1 ? '' : 's'} caused by an accident in your area.`)
        }

        // 1. get street name of street the car is riding on (e.g. 'E35')
        // 2. get street name of all the extracted accidents
        // 3. compare them and delete all accidents that are not on the cars road
        let carStreetName = ''
        try {
            carStreetName = await getStreetNameOfLocation(coords[0][0], coords[0][1])
        } catch (err) {
            throw err
        }

        information.streetName = carStreetName
        if (debug) console.log(`You are on street: ${carStreetName}`)

        let accidentsToCheck = []


        for (let i = 0; i < accidents.length; i++) {
            //extract the coordinates of the accident
            let foundAccident = false
            for (let j = 0; j < accidents[i].geo.latlong.length && !foundAccident; j++) {
                let latlong = accidents[i].geo.latlong[j].split(',')

                let lat = latlong[0]
                let lon = latlong[1]

                try {
                    accidentStreetName = await getStreetNameOfLocation(lat, lon)
                } catch (e) {
                    throw (e)
                }
                if (debug) process.stdout.write(`\nThe ${j + 1}. coordinate of the ${i + 1}. accident is on street: ${accidentStreetName}. `)

                if (accidentStreetName === carStreetName) {
                    console.log('This accident is on the same street as you, checking if it\'s ahead of you...')
                    accidentsToCheck.push(accidents[i])
                    foundAccident = true
                }
            }
        }



        /*accidentsToCheck.forEach((accident) => {
            let path = []
            accident.geo.latlong.forEach((latlong) => {
                path.push([latlong.split(',')[0], latlong.split(',')[1]])
            })
            console.log('Path for snapToRoads', path)
            const data = googleMaps.snapToRoads({ path , interpolate: true }, (error, data) => {
                if(error) 
                    console.error(error)
                console.log(data.json.snappedPoints)
            })
 
        })*/

        if (_.isEmpty(accidentsToCheck)) {
            information.message = 'No traffic jams found on your street. Stop.'
            if (debug) console.log(information.message)
            cb({
                shouldShowWarning,
                information
            })
            return
        }

        let carFirst = coords[0]
        let carSecond = coords[1]

        let startOfTrafficJam = accidentsToCheck[0].geo.latlong[accidentsToCheck[0].geo.latlong.length - 1].split(',').map((n) => parseFloat(n))
        let endOfTrafficJam = accidentsToCheck[0].geo.latlong[0].split(',').map((n) => parseFloat(n))


        let carFirstToStart = getDistance(carFirst, startOfTrafficJam)
        let carSecondToStart = getDistance(carSecond, startOfTrafficJam)

        let carFirstToEnd = getDistance(carFirst, endOfTrafficJam)
        let carSecondToEnd = getDistance(carSecond, endOfTrafficJam)

        let firstToSecond = getDistance(carFirst, carSecond)

        if (debug) {
            console.log(`
    Calculated distances: 
    - carFirstToStart:  ${carFirstToStart}
    - carSecondToStart: ${carSecondToStart}
    - carFirstToEnd:    ${carFirstToEnd}
    - carSecondToEnd:   ${carSecondToEnd}
    - startToEnd        ${firstToSecond}\n
    `)
        }

        if (firstToSecond < 0.01) {
            information.warning = 'Distance between the car\'s coordinates are very close, you\'re probably standing.Data provided might be inaccurate.'
            if (debug) console.log(information.warning)
        }

        //driving towards the traffic jam
        if (carSecondToStart < carFirstToStart) {
            if (carSecondToEnd < carFirstToEnd) {
                if (carSecondToStart < carSecondToEnd) {
                    information.message = 'Result: You\'re driving towards the traffic jam'
                    console.log(information.message)
                    shouldShowWarning = true
                }
            }
        }
        if (carFirstToStart < carSecondToStart) {
            if (carSecondToEnd < carFirstToEnd) {
                information.message = 'Result: You\'re inside the traffic jam'
                console.log(information.message)
                shouldShowWarning = true
            }
        }

        cb({
            shouldShowWarning,
            information
        })
    })
}

function isAccidentInArea(accident, area, delta = 0.5) {
    let isInArea = false
    accident.geo.latlong.forEach((coords) => {
        coords = coords.split(',')
        coords[0] = parseFloat(coords[0])
        coords[1] = parseFloat(coords[1])
        if (
            ((coords[0] <= area[0] + delta) && (coords[0] >= area[0] - delta)) &&
            ((coords[1] <= area[1] + delta) && (coords[1] >= area[1] - delta))
        ) {
            isInArea = true
        }
    })
    return isInArea
}

function getStreetNameOfLocation(lat, lon) {
    return geocoder.reverse({ lat, lon })
        .then((data) => {
            return data[0].streetName
        }, (err) => {
            throw err
        })
}

function getDistance(first, second) {
    return getDistanceFromLatLonInKm(first[0], first[1], second[0], second[1])
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371  // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1)   // deg2rad below
    var dLon = deg2rad(lon2 - lon1)
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)

    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    var d = R * c  // Distance in km
    return d
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}
