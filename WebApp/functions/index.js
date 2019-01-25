const functions = require('firebase-functions');
// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.database();

// Declared at cold-start, but only initialized if/when the function executes
// Because posts is declared in global scope, its value can be reused in subsequent invocations
// without having to be recomputed (without having to fetch all posts again from the database)
// https://cloud.google.com/functions/docs/bestpractices/tips#use_global_variables_to_reuse_objects_in_future_invocations
let posts;

const runtimeOpts = {
  timeoutSeconds: 60,
  memory: '256MB' // might need to change that depending on the number of posts in the database
}


exports.fullTextSearchOnDatabase = functions
  .runWith(runtimeOpts)
  .database.ref('/searchQueries/{pushId}/query')
  .onCreate(async (snapshot, context) => {

    const searchQuery = snapshot.val();
    const searchQueryRegEx = new RegExp(searchQuery, 'i');

    // This value is initialized only if (and when) the function is called
    if(!posts) {
      console.log("No cache - retrieve posts again");
      posts = await getAllPosts();
    }
    else {
      console.log("Using cache");
    }

    let matchingResults = {};

    for (var i in posts) {
      // check if post content matches our search query
      if (posts[i].object.content.search(searchQueryRegEx) !== -1) {
        // add the publication date + nb of plusoners to try to sort by relevance or recent activity
        matchingResults[i] = {};
        matchingResults[i].published = posts[i].published;
        matchingResults[i].object = {};
        matchingResults[i].object.replies = {};
        matchingResults[i].object.replies.totalItems = posts[i].object.replies.totalItems;
        matchingResults[i].object.plusoners = {};
        matchingResults[i].object.plusoners.totalItems = posts[i].object.plusoners.totalItems;
        matchingResults[i].object.resharers = {};
        matchingResults[i].object.resharers.totalItems = posts[i].object.resharers.totalItems;
      }
    }

    await snapshot.ref.parent.child('nbOfResults').set(Object.keys(matchingResults).length);
    return await db.ref("/searchResults/" + snapshot.ref.parent.key).set(matchingResults);
  });

async function getAllPosts() {
  // Get a database reference to our posts
  const ref = db.ref("/posts/");
  const batchSize = 1000;
  let postsData;
  let endAt;
  posts = {};

  do {
    let postsListQuery = ref.orderByChild("published").limitToLast(batchSize);
    if (endAt) postsListQuery = postsListQuery.endAt(endAt);

    const postsSnapshot = await postsListQuery.once("value");
    postsData = postsSnapshot.val();

    for (const i in postsData) {
      const publicationTime = new Date(postsData[i].published).getTime();
      if (!endAt || new Date(endAt).getTime() > publicationTime) {
        endAt = postsData[i].published;
      }
      posts[i] = postsData[i];
    }

  } while (Object.keys(postsData).length === batchSize);
  return posts;
}

// Cut off time. Child nodes older than this will be deleted.
const CUT_OFF_TIME = 5 * 60 * 1000; // 5 Minutes in milliseconds.

/**
 * https://github.com/firebase/functions-samples/tree/master/delete-old-child-nodes
 *
 * This database triggered function will check for child nodes that are older than the
 * cut-off time. Each child needs to have a `startedAt` attribute.
 */
exports.deleteOldItems = functions.database.ref('/searchQueries/{pushId}').onCreate((snapshot) => {
  const searchQueriesRef = snapshot.ref.parent; // reference to the parent
  const searchResultsRef = admin.database().ref("/searchResults/");
  const now = Date.now();
  const cutoff = now - CUT_OFF_TIME;
  const oldItemsQuery = searchQueriesRef.orderByChild('startedAt').endAt(cutoff);
  return oldItemsQuery.once('value').then((snapshot) => {
    // create a map with all children that need to be removed
    const updates = {};
    snapshot.forEach(child => {
      updates[child.key] = null;
    });
    // execute all updates in 2 go and return the result to end the function
    searchResultsRef.update(updates);
    return searchQueriesRef.update(updates);
  });
});