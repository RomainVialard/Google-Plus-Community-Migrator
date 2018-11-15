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
  var callback = function(snap) {
    var postId = snap.key;
    var postData = snap.val();
    displayPost(postId, postData);
    if (!referenceToOldestKey || new Date(referenceToOldestKey).getTime() > new Date(postData.published).getTime()) {
      referenceToOldestKey = postData.published;
    }
  };

  var query = firebase.database().ref('/posts/').orderByChild('published').limitToLast(10);
  if (referenceToOldestKey) {
    query = query.endAt(referenceToOldestKey);
  }
  query.on('child_added', callback);
  // firebase.database().ref('/posts/').limitToLast(100).on('child_changed', callback);
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

// Returns true if user is signed-in. Otherwise false and displays a message.
function checkSignedInWithMessage() {
  // Return true if the user is signed in Firebase
  if (isUserSignedIn()) {
    return true;
  }

  // Display a message to the user using a Toast.
  var data = {
    message: 'You must sign-in first',
    timeout: 2000
  };
  signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
  return false;
}

// A loading image URL.
var LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';

// Displays a Post in the UI.
function displayPost(postId, postData) {
  var div = document.getElementById(postId);
  // If an element for that post does not exists yet we create it.
  if (!div) {
    var template = document.querySelectorAll("template")[0];
    var copy = document.importNode(template.content, true);
    div = copy.querySelectorAll('div')[0];
    div.id = postId;

    if (!referenceToOldestPost) postListElement.appendChild(div);
    else postListElement.insertBefore(div, referenceToOldestPost);
    referenceToOldestPost = div;
  }

  div.querySelector('.MqU2J').src = postData.actor.image.url;
  div.querySelector('.sXku1c').textContent = postData.actor.displayName;

  var publicationDate = moment(postData.published);
  div.querySelector('.o8gkze').textContent = publicationDate.fromNow();

  var regExp = /\(([^)]+)\)/;
  var category = regExp.exec(postData.access.description)[1];
  div.querySelector('.IJ13Ic').textContent = category;

  var messageElement = div.querySelector('.jVjeQd');
  messageElement.innerHTML = postData.object.content;

  div.querySelector('.M8ZOee').textContent = postData.object.plusoners.totalItems;
  // Check if current user has +1 this post. In that case, make the +1 button red.
  var currentUser = firebase.auth().currentUser;
  if (currentUser) {
    var path = '/plusoners/' + postId + '/' + currentUser.providerData[0].uid + '/id';
    firebase.database().ref(path).once('value').then(function(snapshot) {
      if(snapshot.val()) {
        var element = div.querySelector('[aria-label="+1"]');
        element.classList.add('y7OZL');
        element.classList.add('M9Bg4d');
      }
    });

    // display the current user profile picture next to the comment UI
    div.querySelector('.WWCMIb').src = currentUser.photoURL;
  }

}

// Checks that the Firebase SDK has been correctly setup and configured.
function checkSetup() {
  if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
    window.alert('You have not configured and imported the Firebase SDK. ' +
        'Make sure you go through the codelab setup instructions and make ' +
        'sure you are running the codelab using `firebase serve`');
  }
}

// Checks that Firebase has been imported.
checkSetup();

// Shortcuts to DOM Elements.
var postListElement = document.getElementById('posts');
var userPicElement = document.getElementById('user-pic');
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signOutButtonElement = document.getElementById('sign-out');
var signInSnackbarElement = document.getElementById('must-signin-snackbar');
let referenceToOldestPost = '';

signOutButtonElement.addEventListener('click', signOut);
signInButtonElement.addEventListener('click', signIn);

// initialize Firebase
initFirebaseAuth();

loadPosts();
document.getElementsByTagName('main')[0].addEventListener('scroll', function(event) {
  var element = event.target;
  if (element.scrollHeight - element.scrollTop === element.clientHeight) {
    referenceToOldestPost = '';
    loadPosts();
  }
});
