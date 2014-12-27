var async = require('async');
var config = require('./.config');
var download = require('./download');
var minimist = require('minimist')(process.argv.slice(2));
var Spotify = require('spotify-web');
var util = require('util');

var uri = minimist.uri;
var outputDir = minimist.output || config.output;

// Spotify credentials...
var username = minimist.username || config.username;
var password = minimist.password || config.password;

Spotify.login(username, password, function (err, spotify) {
  if (err) throw err;

  console.log(Spotify.uriType(uri));
  switch (Spotify.uriType(uri)) {
    case 'track':
      console.log('Fetching track information for %s.', uri);

      download(spotify, uri, outputDir, function(err) {
        if (err) throw err;
        spotify.disconnect();
      });
      break;
    case 'album':
      console.log('Fetching album information for %s.', uri);

      spotify.get(uri, function (err, album) {
        if (err) throw err;

        // first get the Track instances for each disc
        var tracks = [];
        album.disc.forEach(function (disc) {
          if (!Array.isArray(disc.track)) return;
          tracks.push.apply(tracks, disc.track);
        });

        async.mapSeries(tracks, function(track, callback) {
          download(spotify, track.uri, outputDir, callback)
        }, function(err, results) {
          if (err) throw err;
          spotify.disconnect();
        });
      });
      break;
    case 'artist':
      console.log('Fetching artist information for %s.', uri);

      spotify.get(uri, function (err, artist) {
        if (err) throw err;

        console.log(util.inspect(artist.albumGroup, false, null));
        console.log(Spotify.gid2id(artist.albumGroup[0].album[0].gid));
      });

      break;
    default:
      console.log("This URI type is not supported.");
      spotify.disconnect();
  }
});