const functions = require('firebase-functions');
// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();


exports.fullTextSearchOnDatabase = functions
  .database.ref('/searchQueries/{pushId}/query')
  .onCreate(async (snapshot, context) => {

    const searchQuery = snapshot.val();
    const searchQueryRegEx = new RegExp(searchQuery, 'i');

    // Get a database reference to our posts
    const db = admin.database();
    const ref = db.ref("/posts/");
    const batchSize = 1000;

    let matchingResults = {};
    let posts = {};
    let endAt = undefined;
    do {
      let postsListQuery = ref.orderByChild("published").limitToLast(batchSize);
      if (endAt) postsListQuery = postsListQuery.endAt(endAt);

      const postsSnapshot = await postsListQuery.once("value");
      posts = postsSnapshot.val();

      for (const i in posts) {
        const publicationTime = new Date(posts[i].published).getTime();
        if (!endAt || new Date(endAt).getTime() > publicationTime) {
          endAt = posts[i].published;
        }

        // check if post content matches our search query
        if (posts[i].object.content.search(searchQueryRegEx) !== -1) {
          // add the publication date + nb of plusoners to try to sort by relevance or recent activity
          matchingResults[i] = posts[i];
        }
      }

    } while (Object.keys(posts).length === batchSize);

    await snapshot.ref.parent.child('nbOfResults').set(Object.keys(matchingResults).length);
    return await db.ref("/searchResults/" + snapshot.ref.parent.key).set(matchingResults);
  });

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