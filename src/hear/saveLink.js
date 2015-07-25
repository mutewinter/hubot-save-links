/*
- extract links
- valid links?
-- not slack.com
-- check 200
-- chech canonical
- check if it's already there
- if it's there eventually send the old message
- if it's NOT there save it
*/

var url = require('url');
var moment = require('moment');
var debug = require('debug')('save-links');
var client = require('./../redis');
var msgUtils = require('./../msgUtils');

function saveLink(msg){
  debug('msg received: ' + msg.envelope.message.text);
  var link = msgUtils.extractLinks(msg);

  if(link && (url.parse(link)).hostname !== 'slack.com') {
    isLinkAlreadySaved(link, msg, persist);
  }
}

function isLinkAlreadySaved(link, msg, callback) {
  client.hget('hubot:links:hash', link, function(err, result){
    if(err) {
      debug(err);
      return;
    }

    if(result) {
      debug(result);
      var alreadySavedLink = JSON.parse(result);

      if (alreadySavedLink.msg.room === msg.envelope.room && process.env.OLD_ENABLED) {
        msg.send('#OLD dude! Already posted on ' + moment(alreadySavedLink.date).format('DD MMM YYYY HH:mm') + ' by ' + alreadySavedLink.postedBy);
      }

      return;
    }

    callback(link, msg);
  });
}

function createLinkInfo(link, msg){
  return {
    link: link,
    postedBy: msg.envelope.user.name,
    date: Date.now(),
    parsedUrl: url.parse(link),
    msg: msg.envelope,
    tags: msgUtils.extractTags(msg)
  };
}

function persist(link, msg) {
  var linkInfo = JSON.stringify(createLinkInfo(link, msg));
  var multi = client.multi([
      ["hset", "hubot:links:hash", link, linkInfo],
      ["lpush", "hubot:links:list", linkInfo],
      ["zadd", "hubot:links:sorted-set", linkInfo.date, linkInfo]
    ]
  );

  multi.exec(function (err, replies) {
    if(err) {
      debug(err);
    }
    debug('link ' + link + ' saved');
    debug('link info: ' + linkInfo);
  });
}

module.exports = saveLink;
