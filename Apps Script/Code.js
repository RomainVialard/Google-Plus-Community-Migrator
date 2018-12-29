function getAllPosts(options) {   
  /* modular libraries */
  var Requests = Import.Requests();
  
  var lock = LockService.getScriptLock();
  // wait for 100ms only. If one instance of the script is already executing, abort.
  var lockAcquired = lock.tryLock(100);
  if (!lockAcquired) { 
    Logger.log('no lock');
    return;
  }
  
  /*
    This provides us with the Plus_ variable
    It builds the requisite API endpoint information via the discovery API 
  */
  buildPlus_();
  
  var firebaseBaseUrl = "https://apps-script-community-archive.firebaseio.com/";
  var communityId = "102471985047225101769";
  var searchQuery = "community:" + communityId;
  // you can use as the searchQuery most advanced search features listed here:
  // https://support.google.com/plus/answer/1669519
  // but "from:me" is not working, you need your Google+ profile ID, eg: "from:116263732197316259248 NOT in:community"

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var startTime = Date.now();
    
  var scriptProperties = PropertiesService.getScriptProperties();
  
  // Retrieving all the posts you want (eg: all posts from a specific community) might take quite a long time
  // Best to create a time-driven trigger to split the work between multiple script executions
  // Note that Google enforces a limit of 10K calls per day to the G+ API, after that you will start seeing the error:
  // "Daily Limit Exceeded. The quota will be reset at midnight Pacific Time (PT)."
  // The import will continue as soon as the quota is reset
  var triggers = ScriptApp.getProjectTriggers();
  if (triggers.length == 0) {
    ScriptApp.newTrigger("getAllPosts").timeBased().everyMinutes(5).create();
    console.log("Trigger created");
    // Save when we started the backup, this will be useful to keep syncing new posts once the whole content has been retrieved
    scriptProperties.setProperty("lastSyncDate", today);
  }
  
  var properties = scriptProperties.getProperties();
  var nextPageToken = properties["nextPageToken"] || undefined;
  var nbOfPostsRetrieved = parseInt(properties["nbOfPostsRetrieved"]) || 0;
  var nbOfRepliesRetrieved = parseInt(properties["nbOfRepliesRetrieved"]) || 0;
  var nbOfPlusonersRetrieved = parseInt(properties["nbOfPlusonersRetrieved"]) || 0;
  var nbOfResharersRetrieved = parseInt(properties["nbOfResharersRetrieved"]) || 0;
  var tmProcessBegan = properties["tmProcessBegan"] || Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd'T'HH:mm:ss'Z'");
  var lastSyncDate = properties["lastSyncDate"] || today;
  var onlySyncNewPosts = properties["onlySyncNewPosts"] || false;
  if (onlySyncNewPosts) {
    // full export done, simply retrieve the latest posts
    searchQuery+= " after:" + lastSyncDate;
  }
  
  var token = ScriptApp.getOAuthToken();
  var fb = FirebaseApp.getDatabaseByUrl(firebaseBaseUrl, token);

  do {

    // collect 10 results, and then interact with the comments/plusoners/resharers
    var count = 1;
    var feedCompilation = {
      postItems: [],      // compilation of all 10 posts item results
      requests: [],  // { request: null, items: [] }
      jsons: [],
      items: {}
    }; 
    
    do {
      var activityFeed = ErrorHandler.expBackoff(function () {
        /*
          build the object so that it has pageToken if available
        */
        var query;
        query = {
          query: searchQuery
        };
        if (nextPageToken) query.pageToken = nextPageToken;

        return Plus_.getPosts({/* no templating */}, {
          query: query
        }).json();
      });
      
      if (activityFeed instanceof Error) {
        informUser_('Error: ' + activityFeed.message.slice(0, 40) || 'unknown');
        removeTriggers_();
        return;
      }
      
      // Add the posts directly
      Array.prototype.push.apply(feedCompilation.postItems, activityFeed.items);

      /*
        Setup the request objects
        Using the Plus_ variable we setup before, creates the request objects required
        to interact with all endpoints we need for each item in the activity feed
      */

      activityFeed.items.forEach(function (post) {
        feedCompilation.requests.push(
          Plus_.getComments({
            activityId: post.id,
          }, {}, false)
        );
        feedCompilation.requests.push(
          Plus_.getPostInformation({
            activityId: post.id,
            collection: 'resharers'
          }, {}, false)
        );
        feedCompilation.requests.push(
          Plus_.getPostInformation({
            activityId: post.id,
            collection: 'plusoners'
          }, {}, false)
        );
      });
      
      count += 1;
      nextPageToken = activityFeed.nextPageToken;
    } while (nextPageToken && count <= 10);
    

    /*
      Now we need to interact with the endpoints setup above
      If any of them returns nextPageToken, we'll need to reach out again to the same endpoint
      so we'll filter out ones that are finished, and loop until length = 0
    */
    while (feedCompilation.requests.length > 0) {

      /*
       This Request.batch function takes the request objects and turns them into
       regular objects, passes it to UrlFetchApp.fetchAll, and maps responses to response objects
      */
      var responses = ErrorHandler.expBackoff(function () {
        return Requests.batch(feedCompilation.requests);
      });
      
      if (responses instanceof Error) {
        informUser("Error: " + responses.message);
        removeTriggers_();
        return;
      }
      
      var removals = responses.forEach(
        function (response, index) {
          var request, json, key, template;          
          request = response.request;
          if (!response.ok) throw Error(response.statusCode + ' found for ' + request.getUrl());
          json = response.json();
          key = null;
          template = request.getTemplate();
          switch (json.kind) {
            case 'plus#commentFeed':
              key = 'comments/' + template.activityId + '/';
              break;
            case 'plus#peopleFeed':
              key = template.collection + '/' + template.activityId + '/';
              break;
          }
          if (key == null) throw Error("Could not find");
          feedCompilation.items[key] = feedCompilation.items[key] || [];

          // Add any new items found this time around
          Array.prototype.push.apply(feedCompilation.items[key], json.items);

          if (!json.nextPageToken) {
            delete feedCompilation.requests[index];  // does not change length, we filter out nulls below
          } else {
            request.setQuery('pageToken', json.nextPageToken);
          }
          
        }
      );

      // remove any requests that have been deleted
      feedCompilation.requests = feedCompilation.requests.filter(function (request) {
        return (request != null);
      });
    }

    // update our counts
    nbOfPostsRetrieved += feedCompilation.postItems.length;
    nbOfRepliesRetrieved += feedCompilation.postItems.reduce(
      function (sum, item) {
        return sum += item.object.replies.totalItems;
      }, 0
    );
    nbOfPlusonersRetrieved += feedCompilation.postItems.reduce(
      function (sum, item) {
        return sum += item.object.plusoners.totalItems;
      }, 0
    );
    nbOfResharersRetrieved += feedCompilation.postItems.reduce(
      function (sum, item) {
        return sum += item.object.resharers.totalItems;
      }, 0
    );
    
    // Now we have all the items, unpack them into database calls
    var updateHash = {};
    feedCompilation.postItems.forEach(function (item) {
      updateHash['posts/' + item.id] = item;
    });
    Object.keys(feedCompilation.items).forEach(function (key) {
      feedCompilation.items[key].forEach(function (item) {
        updateHash[key + FirebaseApp.encodeAsFirebaseKey(item.id)] = item;
      });
    });

    fb.updateData('', updateHash);
    
    ErrorHandler.expBackoff(function(){
      scriptProperties.setProperties({
        'nextPageToken': nextPageToken,
        'nbOfPostsRetrieved': nbOfPostsRetrieved.toFixed(0),
        'nbOfRepliesRetrieved': nbOfRepliesRetrieved.toFixed(0),
        'nbOfPlusonersRetrieved': nbOfPlusonersRetrieved.toFixed(0),
        'nbOfResharersRetrieved': nbOfResharersRetrieved.toFixed(0),
        'tmProcessBegan': tmProcessBegan,
      });
    });

    // stop if script run for more than 4.5 mins (next trigger will process next batch)
    // or if there's no more posts to retrieve (nextPageToken is null)
  } while (Date.now() - startTime < 4 * 60 * 1000 && nextPageToken);

  informUser_('Operation update');
  
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
      body+= firebaseBaseUrl.replace("firebaseio.com", "firebaseapp.com");
      body+= "<br><br>New posts will also be automatically exported every day.";
      MailApp.sendEmail(currentUserEmailAddress, subject, body, {htmlBody: body});
    }
  }
}