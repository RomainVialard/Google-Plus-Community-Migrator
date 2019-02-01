var EXPORT_NAME = "My G+ Export";
var FIREBASE_DB_URL = "https://apps-script-community-archive.firebaseio.com/";
var COMMUNITY_ID = "102471985047225101769";
var SEARCH_QUERY = "community:" + COMMUNITY_ID;
// you can use as the SEARCH_QUERY most advanced search features listed here:
// https://support.google.com/plus/answer/1669519
// but "from:me" is not working, you need your Google+ profile ID, eg: "from:116263732197316259248 NOT in:community"

function getAllPosts() {
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var startTime = Date.now();
  
  var lock = LockService.getUserLock();
  // wait for 100ms only. If one instance of the script is already executing, abort.
  var lockAcquired = ErrorHandler.expBackoff(function(){
    return lock.tryLock(100);
  });
  if (!lockAcquired || lockAcquired instanceof Error) return;
  
  var userProperties = PropertiesService.getUserProperties();
  var properties = userProperties.getProperties();
    
  // Retrieving all the posts you want (eg: all posts from a specific community) might take quite a long time
  // Best to create a time-driven trigger to split the work between multiple script executions
  // Note that Google enforces a limit of 10K calls per day to the G+ API, after that you will start seeing the error:
  // "Daily Limit Exceeded. The quota will be reset at midnight Pacific Time (PT)."
  // The import will continue as soon as the quota is reset
  var triggers = ScriptApp.getProjectTriggers();
  if (!triggers.length) {
    ScriptApp.newTrigger("getAllPosts").timeBased().everyMinutes(5).create();
    console.log("Trigger created");
    // Save when we started the backup, this will be useful to keep syncing new posts once the whole content has been retrieved
    userProperties.setProperty("lastSyncDate", today);
    // Save export name in Firebase
    renameExport();
  }
  
  var nextPageToken = properties["nextPageToken"] || null;
  var lastSyncDate = properties["lastSyncDate"] || today;
  var onlySyncNewPosts = properties["onlySyncNewPosts"] || false;
  var dateOfMostRecentUpdate = properties["dateOfMostRecentUpdate"] || null;
  var searchQuery = properties["searchQuery"] || SEARCH_QUERY;
  var fbDatabaseUrl = properties["fbDatabaseUrl"] || FIREBASE_DB_URL;
  if (onlySyncNewPosts) {
    // full export done, simply retrieve the latest posts
    searchQuery+= " after:" + lastSyncDate;
  }
  
  var postData = {};
  var newDateOfMostRecentUpdate = null;
  
  do {
    var activityFeed = ErrorHandler.expBackoff(function(){
      return Plus.Activities.search(searchQuery, {maxResults: 20, pageToken: nextPageToken});
    });
    if (activityFeed && activityFeed instanceof Error) return;
    
    var posts = activityFeed.items;
    nextPageToken = activityFeed.nextPageToken;

    for (var i in posts) {
      var postId = posts[i].id;
      var updated = new Date(posts[i].updated).getTime();
      if (onlySyncNewPosts) {
        // save the date of most recent update
        if(!newDateOfMostRecentUpdate || newDateOfMostRecentUpdate < updated) newDateOfMostRecentUpdate = updated;
      }
      postData["posts/" + postId] = posts[i];

      // retrieve comments
      var comments = ErrorHandler.expBackoff(function(){
        return Plus.Comments.list(postId, {maxResults: 500}).items;
      });
      if (comments) {
        if (comments instanceof Error) {
          // Abort if no quota
          if (comments.message === ErrorHandler.NORMALIZED_ERRORS.DAILY_LIMIT_EXCEEDED) return;
        }
        else {
          for (var j in comments) {
            var commentId = FirebaseApp.encodeAsFirebaseKey(comments[j].id);
            postData["comments/" + postId + "/" + commentId] = comments[j];
          }
        }
      }

      // retrieve plusoners
      var plusoners = ErrorHandler.expBackoff(function(){
        return Plus.People.listByActivity(postId, "plusoners", {maxResults: 100}).items;
      });
      if (plusoners) {
        if (plusoners instanceof Error) {
          // Abort if no quota
          if (plusoners.message === ErrorHandler.NORMALIZED_ERRORS.DAILY_LIMIT_EXCEEDED) return;
        }
        else {
          for (var j in plusoners) {
            var plusoneId = plusoners[j].id;
            postData["plusoners/" + postId + "/" + plusoneId] = plusoners[j];
          }
        }
      }
      
      // retrieve resharers - doesn't seem to work
      /*
      var resharers = ErrorHandler.expBackoff(function(){
        return Plus.People.listByActivity(postId, "resharers").items;
      });
      if (resharers) {
        if (resharers instanceof Error) {
          // Abort if no quota
          if (resharers.message === ErrorHandler.NORMALIZED_ERRORS.DAILY_LIMIT_EXCEEDED) return;
        }
        else {
          for (var j in resharers) {
            var reshareId = resharers[j].id;
            postData["resharers/" + postId + "/" + reshareId] = resharers[j];
          }
        }
      }
      */
    }
    if (!posts.length) nextPageToken = null;
        
    // stop if script run for more than 5 min (next trigger will process next batch)
    // or if there's no more posts to retrieve (nextPageToken is null)
  } while (Date.now() - startTime < 5 * 60 * 1000 && nextPageToken);
  
  if (!Object.keys(postData).length) {
    if (onlySyncNewPosts) console.log("0 new posts today for Firebase project: " + properties['firebaseProject']);
  }
  else if (onlySyncNewPosts && dateOfMostRecentUpdate && dateOfMostRecentUpdate == newDateOfMostRecentUpdate) {
    console.log("Today's posts have already been imported for Firebase project: " + properties['firebaseProject']);
  }
  else {
    // Firebase multi-location updates - write all posts retrieved in 1 call, along with comments and plusoners
    try {
      var token = ScriptApp.getOAuthToken();
      var fb = FirebaseApp.getDatabaseByUrl(fbDatabaseUrl, token);
      fb.updateData('', postData);
    }
    catch(e) {
      ErrorHandler.logError(e);
      if (e.message === "404 - Firebase error. Please ensure that you spelled the name of your Firebase correctly") {
        // delete trigger and warn user it's not possible to continue
        deleteExistingTriggers();
        var currentUserEmailAddress = Session.getEffectiveUser();
        var subject = "Google+ exporter to Firebase - migration issue";
        var body = "We can't find your Firebase project. Maybe you didn't spell the name of your Firebase correctly.<br>";
        body+= "Please try again to set up your export from this web app:";
        body+= "https://script.google.com/macros/s/AKfycbwzj4xPRnd5vylHvI84lLSYgwi1QImFdzQhqGm1xLzD4g2EQK8/exec";
        MailApp.sendEmail(currentUserEmailAddress, subject, body, {htmlBody: body});
      }
      return;
    }
    
    ErrorHandler.expBackoff(function(){
      userProperties.setProperties({
        'nextPageToken': nextPageToken,
        'dateOfMostRecentUpdate': newDateOfMostRecentUpdate
      });
    });
    
    // Get the nb of posts in database
    var posts = fb.getData("posts", {shallow: "true"});
    if (posts) var nbOfPosts = Object.keys(posts).length;
    // if no posts retrieved, it might be because of a wrong G+ query
    else var nbOfPosts = 0;
    console.log(nbOfPosts + " posts in Firebase: " + properties['firebaseProject']);       
  }
  
  if (!nextPageToken) {
    if (!onlySyncNewPosts) {
      // Once the full export is done, keep syncing but only retrieve new posts
      userProperties.setProperty("onlySyncNewPosts", true);
      
      // Also send an email notification
      var currentUserEmailAddress = Session.getEffectiveUser();
      var subject = "Google+ exporter to Firebase - migration completed!";
      var body = nbOfPosts + " posts have been exported, matching the following G+ search query: '" + searchQuery + "'<br>";
      var linkToSearchResultsInGooglePlus = "https://plus.google.com/s/" + encodeURIComponent(searchQuery);
      linkToSearchResultsInGooglePlus+= "/posts?order=recent&scope=all";
      body+= linkToSearchResultsInGooglePlus+ "<br><br>";
      body+= "If you have completed the tutorial, all those posts should be available here:<br>";
      body+= fbDatabaseUrl.replace("firebaseio.com", "firebaseapp.com");
      body+= "<br><br>New posts will also be automatically exported every day.";
      MailApp.sendEmail(currentUserEmailAddress, subject, body, {htmlBody: body});
      console.log("Migration completed with " + nbOfPosts + " posts retrieved.");
    }
    else {
      // update lastSyncDate
      userProperties.setProperty("lastSyncDate", today);
    }
  }
}

// Change the name of the export, displayed in the web app header
function renameExport(fbDatabaseUrl, exportName) {
  var token = ScriptApp.getOAuthToken();
  var fb = FirebaseApp.getDatabaseByUrl(fbDatabaseUrl || FIREBASE_DB_URL, token);
  fb.setData('siteTitle', exportName || EXPORT_NAME);
}

// throw in the Apps Script editor UI the total number of posts recorded in Firebase
// useful to check how many posts have been exported
function listNbOfPostsStoredInFirebase() {
  var token = ScriptApp.getOAuthToken();
  var fb = FirebaseApp.getDatabaseByUrl(FIREBASE_DB_URL, token);
  var posts = fb.getData('posts', {shallow: true});
  throw "Currently " + Object.keys(posts).length + " posts stored in Firebase.";
}

// throw in the Apps Script editor UI the date of the oldest post retrieved in Firebase
// useful to check if all posts, even the oldest ones have been exported
function getOldestPostStoredInFirebase() {
  var token = ScriptApp.getOAuthToken();
  var fb = FirebaseApp.getDatabaseByUrl(FIREBASE_DB_URL, token);
  var oldestPost = fb.getData('posts', {orderBy:"published", limitToFirst: 1});
  Logger.log(oldestPost);
  throw "The oldest post retrieved was published on " + oldestPost[Object.keys(oldestPost)[0]].published;
}