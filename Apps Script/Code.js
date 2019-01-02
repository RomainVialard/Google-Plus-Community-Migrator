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
  
  var lock = LockService.getScriptLock();
  // wait for 100ms only. If one instance of the script is already executing, abort.
  var lockAcquired = lock.tryLock(100);
  if (!lockAcquired) return;
  
  var scriptProperties = PropertiesService.getScriptProperties();
  
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
    scriptProperties.setProperty("lastSyncDate", today);
    // Save export name in Firebase
    renameExport();
  }
  
  var properties = scriptProperties.getProperties();
  var nextPageToken = properties["nextPageToken"] || null;
  var nbOfPostsRetrieved = properties["nbOfPostsRetrieved"] || 0;
  var lastSyncDate = properties["lastSyncDate"] || today;
  var onlySyncNewPosts = properties["onlySyncNewPosts"] || false;
  if (onlySyncNewPosts) {
    // full export done, simply retrieve the latest posts
    SEARCH_QUERY+= " after:" + lastSyncDate;
  }
  
  var token = ScriptApp.getOAuthToken();
  var fb = FirebaseApp.getDatabaseByUrl(FIREBASE_DB_URL, token);
  
  do {
    var activityFeed = Plus.Activities.search(SEARCH_QUERY, {maxResults: 20, pageToken: nextPageToken});
    var posts = activityFeed.items;
    nextPageToken = activityFeed.nextPageToken;
    if (!posts.length) nextPageToken = null;
    var postData = {};

    for (var i in posts) {
      nbOfPostsRetrieved++;
      var postId = posts[i].id;
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
    // Firebase multi-location updates - write up to 20 posts in 1 call, along with comments and plusoners
    fb.updateData('', postData);
    
    ErrorHandler.expBackoff(function(){
      scriptProperties.setProperties({
        'nextPageToken': nextPageToken,
        'nbOfPostsRetrieved': nbOfPostsRetrieved
      });
    });
    
    console.log(nbOfPostsRetrieved + " posts retrieved so far");
  
    // stop if script run for more than 4 min (next trigger will process next batch)
    // or if there's no more posts to retrieve (nextPageToken is null)
  } while (Date.now() - startTime < 4 * 60 * 1000 && nextPageToken);
  
  if (!nextPageToken) {
    if (!onlySyncNewPosts) {
      // Once the full export is done, keep syncing but only retrieve new posts
      scriptProperties.setProperty("onlySyncNewPosts", true);
      
      // Also send an email notification
      var posts = fb.getData("posts", {shallow: "true"});
      var nbOfPosts = Object.keys(posts).length;
      var currentUserEmailAddress = Session.getEffectiveUser();
      var subject = "Google+ exporter to Firebase - migration completed!";
      var body = nbOfPosts + " posts have been exported, matching the following G+ search query: '" + SEARCH_QUERY + "'<br>";
      var linkToSearchResultsInGooglePlus = "https://plus.google.com/s/" + encodeURIComponent(SEARCH_QUERY) + "/top";
      body+= linkToSearchResultsInGooglePlus+ "<br><br>";
      body+= "If you have completed the tutorial, all those posts should be available here:<br>";
      body+= FIREBASE_DB_URL.replace("firebaseio.com", "firebaseapp.com");
      body+= "<br><br>New posts will also be automatically exported every day.";
      MailApp.sendEmail(currentUserEmailAddress, subject, body, {htmlBody: body});
    }
    else {
      // update lastSyncDate
      scriptProperties.setProperty("lastSyncDate", today);
    }
  }
}

// Change the name of the export, displayed in the web app header
function renameExport() {
  var token = ScriptApp.getOAuthToken();
  var fb = FirebaseApp.getDatabaseByUrl(FIREBASE_DB_URL, token);
  fb.setData('siteTitle', EXPORT_NAME);
}

// throw in the Apps Script editor UI the total number of posts recorded in Firebase
function listNbOfPostsStoredInFirebase() {
  var token = ScriptApp.getOAuthToken();
  var fb = FirebaseApp.getDatabaseByUrl(FIREBASE_DB_URL, token);
  var posts = fb.getData('posts', {shallow: true});
  throw "Currently " + Object.keys(posts).length + " posts stored in Firebase.";
}