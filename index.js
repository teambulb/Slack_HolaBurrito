require('dotenv').config();
const ts = require('tinyspeck'),
    mongodb = require('mongodb'),
    fs = require('fs'),
    PORT = process.env.PORT || 8080,
    BOT_TOKEN = process.env.BOT_TOKEN,
    TOKEN = process.env.TOKEN,
    REQUEST_URL =  process.env.REQUEST_URL,
    MAX_BURRITOS_PER_DAY = process.env.MAX_BURRITOS_PER_DAY,
    MONGODB_USER=process.env.MONGODB_USER,
    MONGODB_PASS=process.env.MONGODB_PASS;

// setting defaults for all Slack API calls
let slack = ts.instance({ token: BOT_TOKEN });
let uri = encodeURI('mongodb://holaBurrito:eZRPtdQDZ2QZpX@ds139960.mlab.com:39960/heroku_8k5h3x81');
//let uri = encodeURI('mongodb://' + MONGODB_USER + ':' + MONGODB_PASS + '@ds139960.mlab.com:39960/heroku_8k5h3x81');

mongodb.MongoClient.connect(uri, function(err, client) {

    var that = this;

    if (err) {
        console.log('Failed to connect to mongodb');
    }

    let db = client.db('heroku_8k5h3x81')

    let burritosGiven = db.collection('burritosGiven');
    let burritosReceived = db.collection('burritosReceived');

    function burritoGiven(gaveABurrito, recievedABurrito, numberGiven) {

        for (var i = 0; i < numberGiven; i++) {

            burritosReceived.findOneAndUpdate({ slackUser : recievedABurrito }, { $inc : { count : 1 }, $set : { lastUpdateDate : new Date() }}, { upsert : true });
            burritosGiven.findOneAndUpdate({ slackUser : gaveABurrito }, { $inc : { count : 1 }, $set : { lastUpdateDate : new Date() }}, { upsert : true });
        }
    };

    this.burritosRemainingPerDay = function(user) {

        return new Promise(function (resolve, reject) {

            var query = burritosGiven.findOne({ slackUser : user }, function (err, res) {

                if (err) {
                    reject(err);
                }

                var result = MAX_BURRITOS_PER_DAY - (res ? res.count : 0);
                resolve(result);
            });
        });
    }

    this.burriotsRecieved = function(user) {

        return new Promise(function (resolve, reject) {

            var query = burritosReceived.findOne({ slackUser : user }, function (err, res) {

                if (err) {
                    reject(err);
                }

                var result = res ? res.count : 0;
                resolve(result);
            });
        });
    }

    function burritosInMention(str) {

        var burritoCount = 0;
        var arr = str.split(" ");
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === ':burrito:') {
                burritoCount++;
            }
        }

        return burritoCount;
    }

    function getAllUsersInStr(str) {

        var outputUsers = [];
        var arr = str.split(" ");
        for (var i = 0; i < arr.length; i++) {

            var userGivenBurrito = arr[i].match(/<@(.*)>/);
            if (userGivenBurrito && userGivenBurrito[1]) {

                outputUsers.push(userGivenBurrito[1]);
            }
        }

        return outputUsers;
    }

    slack.on('message', payload => {

        if (payload.event.text && payload.event.text.indexOf(':burrito:') > 0) {

            that.burritosRemainingPerDay(payload.event.user).then(function(remainingCount) {

                var usersGivenBurritos = getAllUsersInStr(payload.event.text);
                var burritosGiven = burritosInMention(payload.event.text);
                var burritosToDistribute = (usersGivenBurritos.length - 1) * (burritosGiven.length - 1);
                var giveFailed = false;

                if (burritosToDistribute > remainingCount) {

                    slack.send({
                        token: BOT_TOKEN,
                        text: 'You don\'t have enough burritos to give to everyone.',
                        channel: payload.event.user,
                        as_user: false,
                        username: 'Hola Burrito'
                    }).then(res => {
                    }).catch(console.error);
                    return;
                }

                for (var i = 0; i < usersGivenBurritos.length; i++) {

                    var userGivenBurrito = usersGivenBurritos[i];

                    if (!userGivenBurrito) {
                        giveFailed = true;
                        break;
                    }

                    // if (payload.event.user === userGivenBurrito) {
                    //     slack.send({
                    //         token: BOT_TOKEN,
                    //         text: 'You cannot give yourself a burrito.',
                    //         channel: payload.event.user,
                    //         as_user: false,
                    //         username: 'Hola Burrito'
                    //     }).then(res => {
                    //     }).catch(console.error);
                    //     giveFailed = true;
                    //     break;
                    // }

                    if (remainingCount <= 0) {
                        slack.send({
                            token: BOT_TOKEN,
                            text: 'You are out of burritos to give today.',
                            channel: payload.event.user,
                            as_user: false,
                            username: 'Hola Burrito'
                        }).then(res => {
                        }).catch(console.error);
                        giveFailed = true;
                        break;
                    }

                    if (!giveFailed) {
                        burritoGiven(payload.event.user, userGivenBurrito, burritosGiven);
                    }
                }

                if (usersGivenBurritos === undefined || usersGivenBurritos.length == 0 || giveFailed) {
                    return;
                }

                var pluralize = burritosGiven === 1 ? ' burrito' : ' burritos';
                slack.send({
                    token: BOT_TOKEN,
                    text: 'Hola, you gave ' + burritosGiven + pluralize + ' to <@' + userGivenBurrito + '>. You have ' + remainingCount + ' burritos left to give today.',
                    channel: payload.event.user,
                    as_user: false,
                    username: 'Hola Burrito'
                }).then(res => {
                }).catch(console.error);

                that.burriotsRecieved(userGivenBurrito).then(function(count) {

                    var pluralize = count === 1 ? ' burrito' : ' burritos';
                    slack.send({
                        token: BOT_TOKEN,
                        text: 'Hola, you recieved a burrito from <@' + payload.event.user + '>. Overall you have ' + count + pluralize + '.',
                        channel: '@' + userGivenBurrito,
                        as_user: false,
                        username: 'Hola Burrito'
                    }).then(res => {
                    }).catch(console.error);
                });
            });
        }
    });

    slack.on('/burritostats', payload => {

        Promise.all([that.burritosRemainingPerDay(requester), that.burriotsRecieved(requester)], function(res) {

            var requester = payload.user_id;
            var burritosLeft = res[0];
            var totalBurritosRecieved = res[1];

            slack.send({
                token: BOT_TOKEN,
                text: 'You have ' + burritosLeft + ' burritos left to give today. You have recieved ' + totalBurritosRecieved + ' burrito(s).',
                channel: requester,
                as_user: false,
                username: 'Hola Burrito'
            }).then(res => {
            }).catch(console.error);
        });
    });


    // incoming http requests
    slack.listen(PORT);
});