var async = require('async');
var ffmetadata = require('ffmetadata');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var sanitize = require('sanitize-filename');
var Spotify = require('spotify-web');
var request = require('request');

module.exports = function(spotify, uri, outputDir, callback) {
  spotify.get(uri, function (err, track) {
    if (err) throw err;

    console.log('Ripping: %s - %s', track.artist[0].name, track.name);

    async.parallel({
      album: function (callback) {
        track.album.get(function (err, album) {
          if (err) throw err;
          mkdirp('tmp/', function(err) {
            if (err) throw err;
          });
          var coverImagePath = 'tmp/' + Spotify.gid2id(track.gid) + '.jpg';
          var albumCoverUri = album.cover[album.cover.length - 1].uri

          request.head(albumCoverUri, function(err, res, body){
            request(albumCoverUri).pipe(fs.createWriteStream(coverImagePath)).on('close', function() {
              album.coverImagePath = coverImagePath;
              callback(null, album);
            });
          });
        });
      },
      artist: function (callback) {
        track.artist[0].get(function (err, artist) {
          if (err) throw err;
          return callback(null, artist);
        });
      },
      writeStream: function (callback) {
        var file = outputDir + '/' + sanitize(track.artist[0].name, {replacement: '_'}) + '/' + '[' + track.album.date.year + '] ' + sanitize(track.album.name, {replacement: '_'}) + '/' + ('00' + track.number).slice(-2) + ' ' + sanitize(track.name, {replacement: '_'}) + '.mp3';
        
        mkdirp(path.dirname(file), function(err) {
          if (err) throw err;

          // create file to write to
          var writeStream = fs.createWriteStream(file);

          track.play()
            .pipe(writeStream)
            .on('finish', function () {
              callback(null, writeStream);
            });
        });
      }
    },
    function (err, results) {
      if (err) throw err;

      // write metadata
      var metadata = {
        encoded_by   : 'Spotify'
      };
      if (track.name) metadata.title = track.name;
      if (track.artist) metadata.artist = track.artist[0].name;
      if (track.album) {
        if (track.album.artist) metadata.album_artist = track.album.artist[0].name;
        if (track.album.name) metadata.album = track.album.name;
        if (track.album.date) {
          if (track.album.date.year) metadata.date = track.album.date.year;
        }
        if (track.album.label) metadata.publisher = track.album.label;
      }
      if (results.album.disc) {
        if (track.number) metadata.track = track.number + "/" + results.album.disc[track.discNumber - 1].track.length;
        if (results.album.disc.length > 1 && track.discNumber) metadata.disc = track.discNumber;
      }
      if (results.album.copyright) metadata.copyright = results.album.copyright[0].text;
      if (results.artist.genre) metadata.genre = results.artist.genre[0];

      ffmetadata.write(results.writeStream.path, metadata, {
        'id3v2.3': true,
        attachments: [
          results.album.coverImagePath
        ]
      }, function(err) {
        if (err) throw err;
        console.log('Metadata written to file "%s".', results.writeStream.path);

        // close file and connection
        fs.unlink(results.album.coverImagePath, function(err) {
          if (err) throw err;
        });
        results.writeStream.end();

        callback(null);
      });
    });
  });
};