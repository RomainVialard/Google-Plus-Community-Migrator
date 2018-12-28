/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

// Signs-in Friendly Chat.
function signIn() {
  // Sign in Firebase using popup auth and Google as the identity provider.
  var provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider);
}

// Signs-out of Friendly Chat.
function signOut() {
  // Sign out of Firebase.
  firebase.auth().signOut();
}

// Initiate firebase auth.
function initFirebaseAuth() {
  // Listen to auth state changes.
  firebase.auth().onAuthStateChanged(authStateObserver);
}

// Returns the signed-in user's profile Pic URL.
function getProfilePicUrl() {
  return firebase.auth().currentUser.photoURL || '/images/profile_placeholder.png';
}

// Returns the signed-in user's display name.
function getUserName() {
  return firebase.auth().currentUser.displayName;
}

// Returns true if a user is signed-in.
function isUserSignedIn() {
  return !!firebase.auth().currentUser;
}

let referenceToOldestKey = '';

function loadPosts() {
  // Display a message to the user using a Toast.
  var data = {
    message: nbOfPostsDisplayed + ' posts displayed. Loading more posts...',
    timeout: 1500
  };
  if (snackbarElement && snackbarElement.MaterialSnackbar) snackbarElement.MaterialSnackbar.showSnackbar(data);

  var callback = function(snap) {
    var postId = snap.key;
    var postData = snap.val();
    displayPost(postId, postData);
    if (!referenceToOldestKey || new Date(referenceToOldestKey).getTime() > new Date(postData.published).getTime()) {
      referenceToOldestKey = postData.published;
    }
  };

  var query = firebase.database().ref('/posts/').orderByChild('published');
  if (referenceToOldestKey) {
    // retrieve 10 additional posts + the last one previously retrieved: 11
    query = query.limitToLast(11).endAt(referenceToOldestKey);
  }
  else query = query.limitToLast(10);
  query.on('child_added', callback);
}

// Triggers when the auth state change for instance when the user signs-in or signs-out.
function authStateObserver(user) {
  if (user) { // User is signed in!
    // Get the signed-in user's profile pic and name.
    var profilePicUrl = getProfilePicUrl();
    var userName = getUserName();

    // Set the user's profile pic and name.
    userPicElement.style.backgroundImage = 'url(' + profilePicUrl + ')';
    userNameElement.textContent = userName;

    // Show user's profile and sign-out button.
    userNameElement.removeAttribute('hidden');
    userPicElement.removeAttribute('hidden');
    signOutButtonElement.removeAttribute('hidden');

    // Hide sign-in button.
    signInButtonElement.setAttribute('hidden', 'true');
  } else { // User is signed out!
    // Hide user's profile and sign-out button.
    userNameElement.setAttribute('hidden', 'true');
    userPicElement.setAttribute('hidden', 'true');
    signOutButtonElement.setAttribute('hidden', 'true');

    // Show sign-in button.
    signInButtonElement.removeAttribute('hidden');
  }
}

// Displays a Post in the UI.
function displayPost(postId, postData) {
  var div = document.getElementById(postId);
  // if post was already retrieved and displayed, skip
  if (div) return;

  var template = document.getElementById("posts").querySelector("template");
  var copy = document.importNode(template.content, true);
  div = copy.querySelector('div');
  div.id = postId;

  if (!referenceToOldestPost) postListElement.appendChild(div);
  else postListElement.insertBefore(div, referenceToOldestPost);
  referenceToOldestPost = div;
  nbOfPostsDisplayed++;

  div.querySelector('.MqU2J').src = postData.actor.image.url;
  div.querySelector('.sXku1c').textContent = postData.actor.displayName;

  var publicationDate = moment(postData.published);
  div.querySelector('.o8gkze').textContent = publicationDate.fromNow();

  // check if the access.description field contains a community category
  var regExp = /\(([^)]+)\)/;
  var category = regExp.exec(postData.access.description);
  if (category) div.querySelector('.IJ13Ic').textContent = category[1];

  // Display HTML content of the post
  var messageElement = div.querySelector('.jVjeQd');
  messageElement.innerHTML = postData.object.content;

  // Check if an image is linked to the post
  if (postData.object.attachments && postData.object.attachments['0'] && postData.object.attachments['0'].image) {
    div.querySelector('div[data-jsname="MTOxpb"]').style.display = "block";
    div.querySelector('.JZUAbb').src = postData.object.attachments['0'].image.url;
  }

  // LIKES / PLUSONES
  var plusOnesContainer = div.querySelector('.oHo9me');
  plusOnesContainer.dataset.itemid = "update/" + postId;

  var nbOfPlusones = postData.object.plusoners.totalItems;
  plusOnesContainer.dataset.count = nbOfPlusones;
  div.querySelector('.M8ZOee').textContent = nbOfPlusones;

  // Check if current user has +1 this post. In that case, make the +1 button red.
  var currentUser = firebase.auth().currentUser;
  if (currentUser) {
    var path = '/plusoners/' + postId + '/' + currentUser.providerData[0].uid + '/id';
    firebase.database().ref(path).once('value').then(function(snapshot) {
      if(snapshot.val()) {
        var element = plusOnesContainer.querySelector('[aria-label="+1"]');
        element.classList.add('y7OZL');
        element.classList.add('M9Bg4d');
        plusOnesContainer.dataset.pressed = true;
      }
      else {
        plusOnesContainer.dataset.pressed = false;
      }
    });

    // display the current user profile picture next to the comment UI
    div.querySelector('.WWCMIb').src = currentUser.photoURL;
  }
  else {
    // if user not authenticated, hide profile picture placeholder + comment textbox
    div.querySelector('.JPtOFc').style.display = 'none';
  }

  // COMMENTS
  if (postData.object.replies.totalItems) {
    var commentSection = div.querySelector('.EMg45');
    var path = '/comments/' + postId;
    var query = firebase.database().ref(path).orderByChild('published').limitToLast(3);
    query.on('child_added', function (snapshot) {
      if(snapshot.val()) {
        var comment = snapshot.val();
        var commentTemplate = commentSection.querySelector("template");
        var copy = document.importNode(commentTemplate.content, true);
        var div = copy.querySelector('div');
        commentSection.appendChild(div);
        div.querySelector('.vGowKb').textContent = comment.actor.displayName;
        div.querySelector('.Wj5EM').querySelector('span').innerHTML = comment.object.content;
      }
    });
  }

}

// Shortcuts to DOM Elements.
var postListElement = document.getElementById('posts');
var userPicElement = document.getElementById('user-pic');
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signOutButtonElement = document.getElementById('sign-out');
var snackbarElement = document.getElementById('snackbar');

signOutButtonElement.addEventListener('click', signOut);
signInButtonElement.addEventListener('click', signIn);

// initialize Firebase
initFirebaseAuth();

let referenceToOldestPost = '';
let nbOfPostsDisplayed = 0;

// load the first 10 posts right away
loadPosts();
// load 10 more posts once user scrolled to the bottom of the page
document.getElementsByTagName('main')[0].addEventListener('scroll', function(event) {
  var element = event.target;
  if (Math.round(element.scrollHeight - element.scrollTop) === Math.round(element.clientHeight)) {
    referenceToOldestPost = '';
    loadPosts();
  }
});

function expandPost(el) {
  el.classList.remove("qhIQqf");
  el.querySelector('.jVjeQd').style['max-height'] = 'none';
}

function displayAllComments(el) {
  el.querySelector('.EMg45').style.display = 'none';
  var fullCommentListParentEl = el.querySelector('.RIrM6d');
  var postId = fullCommentListParentEl.parentNode.parentNode.parentNode.parentNode.parentNode.id;

  fullCommentListParentEl.style.display = 'block';

  var commentSection = fullCommentListParentEl.querySelector("ul");
  var commentTemplate = commentSection.querySelector("template");

  var path = '/comments/' + postId;
  var query = firebase.database().ref(path).orderByChild('published');
  query.on('child_added', function (snapshot) {
    if(snapshot.val()) {
      var comment = snapshot.val();
      var copy = document.importNode(commentTemplate.content, true);
      var li = copy.querySelector('li');
      commentSection.appendChild(li);
      li.querySelector('.vGowKb').textContent = comment.actor.displayName;
      li.querySelector('.MqU2J').src = comment.actor.image.url;
      li.querySelector('.g6UaYd').querySelector('div').innerHTML = comment.object.content;
      var publicationDate = moment(comment.published);
      li.querySelector('.gmFStc').querySelector('span').textContent = publicationDate.fromNow();
    }
  });
}

function togglePlusoned(el) {
  // check if user is authenticated. If not, display alert
  if (!firebase.auth().currentUser) {
    // Display a message to the user using a Toast.
    var data = {
      message: 'You must sign-in to +1 a post.',
      timeout: 1500
    };
    snackbarElement.MaterialSnackbar.showSnackbar(data);
    return;
  }

  var postId = el.dataset.itemid.replace("update/", "");
  var userGoogleId = firebase.auth().currentUser.providerData[0].uid;

  var subEl = el.querySelector('[aria-label="+1"]');
  if (el.dataset.pressed == "true") {
    el.dataset.pressed = false;
    el.dataset.count--;

    // Firebase: write the new +1's data simultaneously in the post's plusoners list and the post.
    var updates = {};
    updates['/posts/' + postId + "/object/plusoners/totalItems"] = +el.dataset.count;
    updates['/plusoners/' + postId + '/' + userGoogleId] = null;
    firebase.database().ref().update(updates, function(error) {
      if (error) {
        console.log(error);
      } else {
        subEl.classList.remove('y7OZL');
        subEl.classList.remove('M9Bg4d');
        el.parentNode.querySelector('.M8ZOee').textContent = el.dataset.count;
      }
    });
  }
  else {
    el.dataset.pressed = true;
    el.dataset.count++;

    // Firebase: write the new +1's data simultaneously in the post's plusoners list and the post data.
    var updates = {};
    updates['/posts/' + postId + "/object/plusoners/totalItems"] = +el.dataset.count;
    updates['/plusoners/' + postId + '/' + userGoogleId] = {
      displayName: firebase.auth().currentUser.displayName,
      // etag: "",
      id: userGoogleId,
      image: {
        url: firebase.auth().currentUser.photoURL
      },
      kind: "plus#person",
      url: "https://profiles.google.com/" + userGoogleId
    };

    firebase.database().ref().update(updates, function(error) {
      if (error) {
        console.log(error);
      } else {
        subEl.classList.add('y7OZL');
        subEl.classList.add('M9Bg4d');
        el.parentNode.querySelector('.M8ZOee').textContent = el.dataset.count;
      }
    });
  }
}