function getAllPosts() {

  var projectId = "apps-script-community-archive";
  var communityId = "102471985047225101769";
  var searchQuery = "community:" + communityId;
  // you can use as the searchQuery most advanced search features listed here:
  // https://support.google.com/plus/answer/1669519
  // but "from:me" is not working, you need your Google+ profile ID, eg: "from:116263732197316259248 NOT in:community"

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
  }
  
  var properties = scriptProperties.getProperties();
  var nextPageToken = properties["nextPageToken"] || null;
  var nbOfPostsRetrieved = properties["nbOfPostsRetrieved"] || 0;
  var lastSyncDate = properties["lastSyncDate"] || today;
  var onlySyncNewPosts = properties["onlySyncNewPosts"] || false;
  if (onlySyncNewPosts) {
    // full export done, simply retrieve the latest posts
    searchQuery+= " after:" + lastSyncDate;
  }
  
  var token = ScriptApp.getOAuthToken();
  var fb = FirebaseApp.getDatabaseByUrl("https://" + projectId + ".firebaseio.com/", token);
  
  do {
    var activityFeed = Plus.Activities.search(searchQuery, {maxResults: 20, pageToken: nextPageToken});
    var posts = activityFeed.items;
    nextPageToken = activityFeed.nextPageToken;
    if (!posts.length) nextPageToken = null;

    for (var i in posts) {
      nbOfPostsRetrieved++;
      var postId = posts[i].id;
      var postData = {};
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

      // Firebase multi-location updates
      fb.updateData('', postData);
    }
    
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
      var body = nbOfPosts + " posts have been exported, matching the following G+ search query: '" + searchQuery + "'<br>";
      var linkToSearchResultsInGooglePlus = "https://plus.google.com/s/" + encodeURIComponent(searchQuery) + "/top";
      body+= linkToSearchResultsInGooglePlus+ "<br><br>";
      body+= "If you have completed the tutorial, all those posts should be available here:<br>";
      body+= ("https://" + projectId + ".firebaseapp.com/");
      body+= "<br><br>New posts will also be automatically exported every day.";
      MailApp.sendEmail(currentUserEmailAddress, subject, body, {htmlBody: body});
    }
    else {
      // update lastSyncDate
      scriptProperties.setProperty("lastSyncDate", today);
    }
  }
}
