var request = require('request');
var settings = require('./settings.js');
var APIKEY = settings.apikey;
if(APIKEY === '') {
	console.log('Missing API key, edit settings file.');
	process.exit(1);
}
var express = require('express');
var js2xmlparser = require("js2xmlparser");
var serverPort = 9000;
var maxAge = 86400000;
var app = express();

function convertVanityToId(APIKEY, vanityName, callback) {
  request('http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key='+APIKEY+'&vanityurl=' + vanityName, function (error, response, body) {
      if(error) {
          return callback(error);
      }
      body = JSON.parse(body);
      if(response.statusCode === 200 && body.response.success === 1) {
          return callback(null, body.response.steamid);
      } else {
          return callback(body);
      }
  });
}

function getFriends (req, res, type, APIKEY, STEAMID) {
    request('http://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key='+APIKEY+'&steamid='+STEAMID+'&relationship=friend', function (error, response, body) {
      if(error) {
          if(type && type === "json") {
              return res.json(500, {message: error});
          }
          throw error
      }
      if(response.statusCode === 200) {
          var steamIDArray = [];
          body = JSON.parse(body);
          for(var friendCounter = 0; friendCounter < body.friendslist.friends.length; friendCounter++) {
            steamIDArray.push(body.friendslist.friends[friendCounter].steamid);
          }
          request('http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key='+APIKEY+'&steamids='+steamIDArray.join(','), function (error, response, body) {
            if(error) {
                if(type && type === "json") {
                  return res.json(500, {message: error});
                }
                throw error
            }
            if(response.statusCode === 200) {
                body = JSON.parse(body);
                var players = body.response.players;
                var onlinePlayers = players.filter(function (a, b) {
                  return a.personastate !== 0;
                });
                onlinePlayers.sort(function (a, b) {
                  if(a.personaname < b.personaname) return -1;
                  if(a.personaname > b.personaname) return 1;
                  return 0;
                });
                var currentGamers = onlinePlayers.filter(function (a) {
                  return a.gameextrainfo;
                });
                var list = [];
                for(var gamerCounter = 0; gamerCounter < currentGamers.length; gamerCounter++) {
                  var listObj = {};
                  listObj.names = currentGamers[gamerCounter].personaname;
                  listObj.games = currentGamers[gamerCounter].gameextrainfo;
                  list.push(listObj);
                }
                var onlineOnly = onlinePlayers.filter(function (a) {
                  return !a.gameextrainfo;
                });
                for(var onlineCounter = 0; onlineCounter < onlineOnly.length; onlineCounter++) {
                  var listObj = {};
                  listObj.names = onlineOnly[onlineCounter].personaname;
                  listObj.games = "NONE";
                  list.push(listObj);
                }
                if(type && type === "json") {
                  return res.json({list: {user: list}});
                } else {
                  res.set('Content-Type', 'application/xml');
                  return res.send(js2xmlparser("list", {user: list}));
                }
            } else {
              return res.send(500, body);
            }
          });
      }  else {
        return res.send(500, body);
      }
  });
}

app.configure('development', function(){
  app.use(express.logger('dev'));
});
app.use(express.compress());
app.use(express.methodOverride());
app.use(function (req, res, next) {
  res.setHeader('Cache-Control', 'public, max-age=' + (maxAge / 1000));
  next();
});
app.use(app.router);

app.get('/getFriends', function (req, res) {
  var STEAMID = req.query.steamid;
  var type = req.query.type;
  if(!STEAMID) {
    if(type && type === "json") {
      return res.json(400, {message: 'Missing steamid.'});
    } else {
      return res.send('Missing steamid.');
    }
  }
  if(isNaN(parseInt(STEAMID, 10))) {
      convertVanityToId(APIKEY, STEAMID, function (error, steamid) {
        if(error) {
          if(type && type === "json") {
            return res.json(400, {message: error});
          } else {
            return res.send(400, error);
          }
        }
        return getFriends(req, res, type, APIKEY, steamid);
      });
  } else {
      return getFriends(req, res, type, APIKEY, STEAMID);
  }
});

app.listen(serverPort, function () {
  console.log("Server has started on port " + serverPort);
});