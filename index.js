let fetch           = require('fetch').fetchUrl
let xml2json        = require('xml2json')
let _               = require('lodash')
let fs              = require('fs')
let googleMaps      = require('@google/maps').createClient({ key: 'AIzaSyCmYzPMAThClsbQU5kC30x6Vc-dLaBGHdM' })
let geocoder = require('node-geocoder')({ apiKey: 'AIzaSyCmYzPMAThClsbQU5kC30x6Vc-dLaBGHdM' })

// set true to use demo xml file
const debug = true

//demo coordinates of the car 
const coords = [
    48.27,
    7.78
]

// get all traffic jams that are accidents
fetch('https://verkehrsmeldungen.polizei-bw.de/TicMessages.ashx?region=BW', (error, meta, body) => {
    if (error)
        console.error(error)

    let jsonBody = xml2json.toJson(body.toString(), {
        object: true,
    })

    if (debug) {
        jsonBody = xml2json.toJson(fs.readFileSync('./TicMessages.xml', 'utf8'), { object: true })
    }

    // add all traffic messages that are accidents to the accident array
    let accidents = []
    jsonBody.vwd4.topic.forEach((topic) => {
        if (topic.message.forEach) {
            topic.message.filter((message) => {
                if (!_.isEmpty(message.signs.accident) && isAccidentInArea(message, coords)) // message.signs.accident is empty if not a traffic jam
                    accidents.push(message)
            })
        }
    })


    getStreetNameOfLocation(coords[0], coords[1]).then((carStreetName) => {
        accidents.forEach(accident => {
            let latlong = accident.geo.latlong[0].split(',')
            let lat = latlong[0]
            let lon = latlong[1];
    
            getStreetNameOfLocation(lat, lon).then(data => {
                console.log(data)
            })
    
        })
    })

    
})


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
        })
}
