const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const bodyParser = require('body-parser')
const validator = require('validator')
const helmet = require('helmet')
const stats = require("stats-lite")

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
	extended: true
}));

app.use(helmet())
app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.get('/', (req, res) => res.render('pages/index'))
app.listen(PORT, () => console.log(`Listening on ${ PORT }`))


// Enable Cross Origin Resource Sharing
app.all('/*', function(request, response, next) {
	response.header("Access-Control-Allow-Origin", "*");
	response.header("Access-Control-Allow-Headers", "X-Requested-With");
	next();
});


// Connect to Database
var dbName = 'heroku_z1bwm0ng';
var mongoUri = 'mongodb://heroku_z1bwm0ng:nee4lsfpitacqupju0d81916s1@ds149960.mlab.com:49960/heroku_z1bwm0ng';
var MongoClient = require('mongodb').MongoClient, format = require('util').format;
var db = MongoClient.connect(mongoUri, function(error, client) {
        db = client.db(dbName);
});


// Endpoints
app.get('/getArrivalRateArray', function(request, response) {
        var hospital = request.query.hospital;
        var dateTime = {
                month: parseInt(request.query.month, 10),
                day: parseInt(request.query.day, 10),
                year: parseInt(request.query.year, 10),
                hour: parseInt(request.query.hour, 10),
                minute: parseInt(request.query.minute, 10)
        }

        var arrivalRateArray = [];
        var index = 0;
        var hour = dateTime.hour;
        var minute = dateTime.minute;
        var day = dateTime.day;

        // Add 1 to minute so first time through is the actual time
        minute += 1;
        for (var i = 0; i < 60; i++) {

                db.collection(hospital, function(error, collection) {

                        if (minute == 0) {
                                minute = 60;

                                if (hour == 0) {
                                        hour = 11;
                                        day = day - 1;
                                } else {
                                        hour = hour - 1;
                                }
                        }

                        minute = minute - 1;

                        collection.find({ arrivalyear:  dateTime.year,
                                          arrivalmonth: dateTime.month,
                                          arrivalday:   day,
                                          arrivaltime:  { $gte: ((hour - 1) * 100) + minute, $lt: (hour * 100) + minute }
                                  }).toArray(function(error, result) {

                                          arrivalRateArray[index++] = result.length;

                                          if (index == 60) {
                                                  response.send(arrivalRateArray);
                                          }
                                  });
                });
        }
});

app.get('/getProcessTimeArray', function(request, response) {
        var hospital = request.query.hospital;
        var dateTime = {
                month: parseInt(request.query.month, 10),
                day: parseInt(request.query.day, 10),
                year: parseInt(request.query.year, 10),
                hour: parseInt(request.query.hour, 10),
                minute: parseInt(request.query.minute, 10)
        }

        var processTimeArray = [];
        var index = 0;
        var hour = dateTime.hour;
        var minute = dateTime.minute;
        var day = dateTime.day;

        // Add 1 to minute so first time through is the actual time
        minute += 1;
        for (var i = 0; i < 60; i++) {

                db.collection(hospital, function(error, collection) {

                        if (minute == 0) {
                                minute = 60;

                                if (hour == 0) {
                                        hour = 11;
                                        day = day - 1;
                                } else {
                                        hour = hour - 1;
                                }
                        }

                        minute = minute - 1;

                        collection.find({ arrivalyear:    { $lte: dateTime.year },
                                          arrivalmonth:   { $lte: dateTime.month },
                                          arrivalday:     { $lte: day },
                                          arrivaltime:    { $lt: ((hour * 100) + minute)},
                                          dischargeyear:  { $gte: dateTime.year },
                                          dischargemonth: { $gte: dateTime.month },
                                          dischargeday:   { $gte: day },
                                          dischargetime:  { $gte: ((hour * 100) + minute)}
                                }).toArray(function(error, result) {

                                        var count = 0;
                                        var totalHours = 0;
                                        var totalMinutes = 0;

                                        result.forEach(function(patient) {

                                                if (day > patient.arrivalday) {
                                                        totalHours += (day - patient.arrivalday - 1) * 24;
                                                        totalHours += 24 - (patient.arrivaltime / 100);
                                                        totalHours += hour;
                                                        totalMinutes += minute + (60 - (patient.arrivaltime % 100));
                                                } else if (hour > (patient.arrivaltime / 100)) {
                                                        totalHours += hour - (patient.arrivaltime / 100);
                                                        totalMinutes += minute + (60 - (patient.arrivaltime % 100));
                                                } else {
                                                        totalMinutes += minute - (patient.arrivaltime % 100);
                                                }

                                                count++;
                                        });

                                        var totalTimeMin = (totalHours * 60) + totalMinutes;
                                        var averageMinutes = totalTimeMin / count;

                                        processTimeArray[index++] = averageMinutes / 60;

                                        if (minute == 59) {
                                                minute = -1;

                                                if (hour == 11) {
                                                        hour = 0;
                                                        day = day + 1;
                                                } else {
                                                        hour = hour + 1;
                                                }
                                        }

                                        minute = minute + 1;

                                        if (index == 60) {
                                                response.send(processTimeArray);
                                        }
                                });
                });
        }
});

app.get('/getCapacityUtilization', function(request, response) {
        var hospital = request.query.hospital;
        var dateTime = {
                month: parseInt(request.query.month, 10),
                day: parseInt(request.query.day, 10),
                year: parseInt(request.query.year, 10),
                hour: parseInt(request.query.hour, 10),
                minute: parseInt(request.query.minute, 10)
        }
        var totalBeds = parseInt(request.query.totalBeds, 10);

        totalBeds = 34;

        db.collection(hospital, function(error, collection) {
                collection.find({ arrivalyear:    { $lte: dateTime.year },
                                  arrivalmonth:   { $lte: dateTime.month },
                                  arrivalday:     { $lte: dateTime.day },
                                  arrivaltime:    { $lt: ((dateTime.hour * 100) + dateTime.minute)},
                                  dischargeyear:  { $gte: dateTime.year },
                                  dischargemonth: { $gte: dateTime.month },
                                  dischargeday:   { $gte: dateTime.day },
                                  dischargetime:  { $gte: ((dateTime.hour * 100) + dateTime.minute)}
                }).toArray(function(error, result) {

                        var capacityUtil = String(result.length / totalBeds);

                        response.send(capacityUtil);
                });
        });
});

app.get('/getAvailableBeds', function(request, response) {
        var capacityUtil = parseFloat(request.query.capacityUtilization);
        var totalBeds = parseInt(request.query.totalBeds, 10);

        var availableBeds = String(totalBeds - (capacityUtil * totalBeds));

        response.send(availableBeds);

});

app.get('/getEMwindowRating', function(request, response) {
        var arrivalRateArray = JSON.parse(request.query.arrivalRateArray);
        var processTimeArray = JSON.parse(request.query.processTimeArray);

        var varArrivalRate = stats.variance(arrivalRateArray);
        var varProcessTime = stats.variance(processTimeArray);
        var capacityUtil = parseFloat(request.query.capacityUtilization);
        var processTime = parseFloat(processTimeArray[0]);

        var total = 0;
        for (var i = 0; i < processTimeArray.length; i++) {
                total += parseFloat(processTimeArray[i]);
        }

        var avg = total / processTimeArray.length;

        // Compute cycle time
        var rating = ((Math.pow(varArrivalRate, 2) + Math.pow(varProcessTime, 2)) / 2) * (capacityUtil / (1 - capacityUtil)) * avg;

        //Map rating to log function with base 1.14
        //rating = (Math.log(rating * 100)) / (Math.log(1.14));

        // if (rating < 1) {
        //         rating = 1;
        // } else if (rating > 99) {
        //         rating = 99;
        // }

        rating = String(rating * 10);

        console.log("Rating: " + rating);

        response.send(rating);
});
