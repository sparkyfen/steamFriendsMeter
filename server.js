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
	if(!STEAMID) return res.json(500, 'Missing steamid.');
	request('http://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key='+APIKEY+'&steamid='+STEAMID+'&relationship=friend', function (error, response, body) {
		if(error) {
			throw error;
		}
		if(response.statusCode === 200) {
			var steamIDArray = [];
			body = JSON.parse(body);
			for(var friendCounter = 0; friendCounter < body.friendslist.friends.length; friendCounter++) {
				steamIDArray.push(body.friendslist.friends[friendCounter].steamid);
			}
			request('http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key='+APIKEY+'&steamids='+steamIDArray.join(','), function (error, response, body) {
				if(error) {
					throw error;
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
					res.set('Content-Type', 'application/xml');
					res.send(js2xmlparser("list", {user: list}));
				} else {
					res.send(500, body);
				}
			});
		}  else {
			res.send(500, body);
		}
	});
});

app.listen(serverPort, function () {
	console.log("Server has started on port " + serverPort);
});