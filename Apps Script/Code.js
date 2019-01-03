var FIREBASEURL = "<your firebase url here>";
var COMMUNITYID = "<community id here>";

function App_ (options) {
  this.options = options || {};
  if (!options.firebaseUrl || !options.communityId) throw Error("Parameters required");
  this.firebaseBaseUrl = options.firebaseUrl;
  this.communityId = options.communityId;
  this.searchQuery = "community:" + this.communityId;
  this.options.maxInnerLoopCount = this.options.maxInnerLoopCount || 10;
  this.options.errorHandlerOptions = {
    retryNumber: options.retryNumber || 3
  };

  this.processedPosts = null;

  this.startUp = function () {
    var token;
    token = ScriptApp.getOAuthToken();
    this.fb = FirebaseApp.getDatabaseByUrl(this.firebaseBaseUrl, token);
    this.Plus = buildPlus_();
    this.done = false;
    this.RequestsLib = Import.Requests();
    this.startTime = Date.now();
    this.inform = {
      subject: "Subject",
      body: ""
    };
    var tPB = this.fb.getData('posts/session/tmProcessBegan');
    if (tPB) {
      this.timeProcessBegan = new Date(tPB);
    } else {
      this.timeProcessBegan = new Date()
      this.fb.setData('posts/session/tmProcessBegan', Utilities.formatDate(this.timeProcessBegan, "GMT", "yyyy-MM-dd'T'HH:mm:ss'Z'"));
    }
    
    this.alreadySaved = [];
    
    // read in the token, if available
    var nPT = this.fb.getData('posts/session/nextPageToken');
    if (nPT) 
      this.nextPageToken = nPT;
    else
      this.nextPageToken = null;
  };
  
  this.informUser = function () {
    var posts;
    
    this.count(this.alreadySaved);  // only need to count this when ready to report
    
    this.counts.duration = ((new Date() - this.timeProcessBegan) / 1000 / 60).toFixed(2);

    posts = this.fb.getData("posts", {shallow: "true"}) || [];
    
    // count them here so we aren't doing it throughout the process
    this.counts.totalPostsInDb = (Object.keys(posts).length - 1).toFixed(0);  // minus 1 to account for posts/session
    this.counts.totalRepliesInDb = calcNestedItems_(this.fb.getData("comments", {shallow: "false"})).toFixed(0);
    this.counts.totalPlusonersInDb = calcNestedItems_(this.fb.getData("plusoners", {shallow: "false"})).toFixed(0);
    
    this.inform.body += "<br><br>Number in Database / Number according to API"
    this.inform.body += '<br><ul><li>Retrieved {totalPostsInDb} / {nbOfPostsRetrieved} posts</li>';
    this.inform.body +=         '<li>Retrieved {totalRepliesInDb} / {nbOfRepliesRetrieved} comments</li>';
    this.inform.body +=         '<li>Retrieved {totalPlusonersInDb} / {nbOfPlusonersRetrieved} plusoners</li>';
    this.inform.body +=     '</ul>';
    this.inform.body += 'Took {duration} minutes';
    this.inform.body = format_(this.inform.body, this.counts);

    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      this.inform.subject.slice(0, 250),
      this.inform.body,
      {
        htmlBody: this.inform.body
      }
    ); 
  };
  
  /*
    Collect up to 10 posts (that we haven't already seen yet)
    and their associated information, preparing it for plus API calls
  */
  this.buildFeedCompilation = function () {
    var count = 1, activityFeed, query, self;
    self = this;
    
    this.feedCompilation = {
      postItems: [],      // compilation of all 10 posts item results
      requests: [],  // { request: null, items: [] }
      items: {}
    };   
    
    query = {
      query: this.searchQuery,
      maxResults: 20,  // max for this endpoint is 20
      fields: 'items,id,nextPageToken'
    };

    do {

      if (this.nextPageToken) query.pageToken = this.nextPageToken;
      activityFeed = ErrorHandler.expBackoff(function () {
        return self.Plus.getPosts({/* no templating */}, {
          query: query
        }).json();
      }, this.options.errorHandlerOptions);
            
      if (activityFeed instanceof Error) {
        if (activityFeed.message == ErrorHandler.NORMALIZED_ERRORS.DAILY_LIMIT_EXCEEDED)
          throw new HitRateReached(activityFeed.message);
        else if (activityFeed.message == ErrorHandler.NORMALIZED_ERRORS.API_NOT_ENABLED) {
          throw new GooglePlusApiNotEnabled(activityFeed.context.originalMessage);  // not just message, because the context.originalMessage has a useful link
        }
        throw new UnexpectedError(activityFeed.message);
      }
      
      if (activityFeed.items.length == 0) {
        this.done = true;
      }

      // Filter out any of those that we have already processed, in a different execution for example
      // Add them to self.alreadySaved for future reference
      activityFeed.items = activityFeed.items.filter(function (item) {
        if (self.processedPosts.indexOf(item.id) !== -1) {
          self.alreadySaved.push(item);
          return false;
        }
        return true;
      });
      
      if (activityFeed.items.length > 0) {
        count += 1;  // increase the count here only if we catch something we will process
      }
      
      // Add the posts
      Array.prototype.push.apply(this.feedCompilation.postItems, activityFeed.items);
      
      // Setup the request objects
      activityFeed.items.forEach(function (post) {
        self.feedCompilation.requests.push(
          self.Plus.getComments({
            activityId: post.id,
          }, {
            query: {
              maxResults: 500,
              fields: 'kind,nextPageToken,id,items'
            }
          }, false)
        );
        
        self.feedCompilation.requests.push(
          self.Plus.getPostInformation({
            activityId: post.id,
            collection: 'plusoners',
          }, {
            query: {
              maxResults: 100,
              fields: 'kind,nextPageToken,items'
          }}, false)
        );
        
        /*  
  Turns out, resharers endpoint seems to be broken, per issue: https://github.com/RomainVialard/Google-Plus-Community-Migrator/issues/12
  So must leave this here, in case maybe someday it gets resurrected and we want to add it back
        self.feedCompilation.requests.push(
          self.Plus.getPostInformation({
            activityId: post.id,
            collection: 'resharers'
          }, {
            query: {
              maxResults: 100,
              fields: 'kind,nextPageToken,items'
            }
          }, false)
        );
      */
      });

      this.nextPageToken = activityFeed.nextPageToken;
      if (!this.nextPageToken) this.done = true;
    } while (!this.done && count <= this.options.maxInnerLoopCount);
  };
  
  this.batchRequests = function () {
    var responses, self;
    self = this;

    while (this.feedCompilation.requests.length > 0) {      
      responses = ErrorHandler.expBackoff(function () {
        return self.RequestsLib.batch(self.feedCompilation.requests);
      });
      
      if (responses instanceof Error) {
        if (responses.message == ErrorHandler.NORMALIZED_ERRORS.DAILY_LIMIT_EXCEEDED) throw new HitRateReached('while doing batch request');
        else throw new UnexpectedError( (responses.context || {originalMessage: responses.message}).originalMessage);  // .context.originalMessage if present, otherwise fallback to just .message
      }
      
      responses.forEach(
        function (response, index) {
          var request, json, key, template;          
          request = response.request;
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
          
          // initialize if not already present
          self.feedCompilation.items[key] = self.feedCompilation.items[key] || [];

          // Append json.items to end of list, if any new items found this time around
          Array.prototype.push.apply(self.feedCompilation.items[key], json.items);

          // Check if this request has any additional requests needed
          if (!json.nextPageToken) {
            delete self.feedCompilation.requests[index];  // NOTE: using delete keyword does not change length, neccessary for loop; we filter out nulls below
          } else {
            request.setQuery('pageToken', json.nextPageToken);  // add pageToken parameter to the next call
          }
          
        }
      );

      // remove any requests that have been deleted
      this.feedCompilation.requests = this.feedCompilation.requests.filter(function (request) {
        return (request != null);
      });
    }  // end while
  };
  
  /*
    Keeps a running total for us
    @param Array(post items)
  */
  this.count = function (arr) {
    this.counts = this.fb.getData('posts/session/counts') || {};
    this.counts.nbOfPostsRetrieved = this.counts.nbOfPostsRetrieved || 0;
    this.counts.nbOfRepliesRetrieved = this.counts.nbOfRepliesRetrieved || 0;
    this.counts.nbOfPlusonersRetrieved = this.counts.nbOfPlusonersRetrieved || 0;
        
    this.counts.nbOfPostsRetrieved += arr.length;
    this.counts.nbOfRepliesRetrieved += arr.reduce(
      function (sum, item) {
        return sum += item.object.replies.totalItems;
      }, 0
    );
    this.counts.nbOfPlusonersRetrieved += arr.reduce(
      function (sum, item) {
        return sum += item.object.plusoners.totalItems;
      }, 0
    );
  };
  
  this.save = function () {
    // Now we have all the items, unpack them into database calls
    var self, updateHash = {};
    self = this;

    this.feedCompilation.postItems.forEach(function (item) {
      updateHash['posts/' + item.id] = item;
    });
    Object.keys(this.feedCompilation.items).forEach(function (key) {
      self.feedCompilation.items[key].forEach(function (item) {
        updateHash[key + FirebaseApp.encodeAsFirebaseKey(item.id)] = item;
      });
    });

    // Store the token in the database
    updateHash['posts/session/nextPageToken'] = this.nextPageToken;
    updateHash['posts/session/counts'] = this.counts;
    this.fb.updateData('', updateHash);
    if (Date.now() - this.startTime > 5 * 60 * 1000) throw new TimeElapsed('Ran out of time');
  };
  
  /*
    Efficiently process all the db info, updating where appropriate 
    Intent is that this can run without having to save nextPageTokens, and approaches but does
    not exceed max hit rate
  */
  this.process = function () {
    var posts;
    this.startUp();
    posts = this.fb.getData("posts", {shallow: "true"});
    if (posts)
      this.processedPosts = Object.keys(posts);
    else
      // on first run, post is null, so just make an empty array
      this.processedPosts = [];
      
    try {
      
      do {
        this.buildFeedCompilation();
        this.batchRequests();
        this.count(this.feedCompilation.postItems);
        this.save();
      } while (!this.done);

      this.inform.subject = 'Operation Complete';
      this.inform.body = "Enjoy";
      this.fb.deleteData('posts/session');
      // TODO: Add trigger here? In which case it'll use the fast-foward method to pick up differences since last run

    } catch (err) {
      err.__print__;
      switch (err.name) {
        case 'HitRateReached':
          this.inform.subject = 'Operation Paused: Daily Quota Exceeded';
          this.inform.body = 'Make another copy of project and re-run';
          break;
        case 'TimeElapsed':
          this.inform.subject = 'Operation Paused: Time Elapsed';
          this.inform.body = 'Make another copy of project and re-run';
          break;
        case 'UnexpectedError':
          this.inform.subject = 'Operation Paused: Unexpected error';
          this.inform.body = err.message;
          break;
        case 'GooglePlusApiNotEnabled':
          this.inform.subject = 'Action required: Enable Plus API';
          this.inform.body = err.message;
          break;
        default:
          // Probably a programming error, print it and make the developer inspect it.
          err.__print__;
          throw err;
          break;
      }
    } finally {
      this.informUser();
    }
  };

}



function execute() {
  var app;
  app = new App_({
    firebaseUrl: FIREBASEURL,
    communityId: COMMUNITYID,
    retryNumber: 3,  // for ErrorHandler, more responsive than the default 5
    maxInnerLoopCount: 10,  // can be increased for even better performance
  });
  app.process();
}
