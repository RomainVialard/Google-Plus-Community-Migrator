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

// Loads posts history and listens for upcoming ones.
function loadPosts() {
  // Loads the last 12 posts and listen for new ones.
  var callback = function(snap) {
    var postId = snap.key;
    var postData = snap.val();
    displayPost(postId, postData);
  };

  firebase.database().ref('/posts/').orderByChild('published').limitToLast(100).on('child_added', callback);
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

// Template for posts - copied from Google+ to match css classes
var POST_TEMPLATE = '<div class="mvhxEe wRd1We cDhoub XkfHGe hE2QI mdl-cell mdl-cell--5-col">'+
  '    <div class="OisWG">'+
  '        <div class="tpVlOc mEgM8 iCPjVb hE2QI">'+

  /* Post author profile picture - Replaced anchor on by span */
  // '            <a href="./100918340617817280791" data-profileid="100918340617817280791" class="h7vvy jfZVid"><img class="MqU2J" height="36" width="36"></a>'+
  '            <span class="h7vvy jfZVid"><img class="MqU2J" height="36" width="36"></span>'+

  '            <div class="dVAtqc" id="author:c30">'+
  '                <div class="q6HYG">'+

  /* Post author name - Replaced anchor on by span */
  // '                    <div class="mmkmJ"><a href="./100918340617817280791" data-profileid="100918340617817280791" class="sXku1c"></a></div>'+
  '                    <div class="mmkmJ"><span class="sXku1c"></span></div>'+

  '                    <div class="dNF4Ud pSkmb">'+
  '                        <div class="XVzU0b pdkqBe tFHtob">'+
  '                            <svg height="100%" width="100%">'+
  '                                <path d="M20 14l10 10-10 10z"></path>'+
  '                            </svg>'+
  '                        </div>'+
  '                        <div class="UohHvc">'+

  // '                            <a href="./communities/102471985047225101769" class="eYSPjc sRhiGb" aria-label="Google Apps Script community">Google Apps Script</a>' +
  /* Post category - Replaced anchor by span */
  // '                            <a href="./communities/102471985047225101769/stream/9568169c-33a8-4215-a2a8-fc89fc456240" class="eYSPjc IJ13Ic"></a>' +
  '                            <span class="eYSPjc IJ13Ic"></span>' +

  /* Disable button to change post category
  '                            <div role="button" tabindex="0" data-oid="9568169c-33a8-4215-a2a8-fc89fc456240" class="ZTemg"'+
  '                                 aria-label="Change category">'+
  '                                <div class="XVzU0b g5imIb">'+
  '                                    <svg height="100%" width="100%">'+
  '                                        <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"></path>'+
  '                                    </svg>'+
  '                                </div>'+
  '                            </div>'+
  */

  '                        </div>'+
  '                        <span class="HiU1rc" aria-hidden="true"></span>'+
  '                    </div>'+
  '                </div>'+
  '                <div class="GmZGge">'+
  '                    <div class="BIDenb">'+
  '                        <a href="./+JMuller/posts/Ws7KGV7hn9Z" class="eZ8gzf" aria-label="Full post view"><span class="DPvwYc rRPL7d" aria-hidden="true">?</span></a>'+
  '                        <div class="LmajHd n8JNod">'+
  '                            <div role="button" class="U26fgb JRtysb WzwrXb iRxCkb lrZTuc" aria-label="More options" aria-disabled="false" tabindex="0" aria-haspopup="true" aria-expanded="false" data-dynamic="true" data-alignright="true">'+
  '                                <div class="NWlf3e MbhUzd"></div>'+
  '                                <content class="MhXXcc oJeWuf"><span class="Lw7GHd snByac"><span class="DPvwYc NKEypf SnosMe" aria-hidden="true">?</span></span></content>'+
  '                            </div>'+
  '                        </div>'+
  '                    </div>'+

  /* Publication date - Replaced anchor by span */
  // '                    <a href="./+JMuller/posts/Ws7KGV7hn9Z" class="o8gkze"><span></span></a>'+
  '                    <span class="o8gkze"></span>'+

  '                </div>'+
  '            </div>'+
  '        </div>'+
  '        <span class="Sce4ed">'+
  '               <div class="uVccjd t9tmff" data-checked-veid="46456" data-unchecked-veid="46457" aria-label="Select this post" tabindex="0" role="checkbox" aria-checked="false">'+
  '                  <div class="PkgjBf MbhUzd"></div>'+
  '                  <div class="uHMk6b fsHoPb"></div>'+
  '                  <div class="rq8Mwb">'+
  '                     <div class="TCA6qd">'+
  '                        <div class="MbUTNc oyD5Oc"></div>'+
  '                        <div class="Ii6cVc oyD5Oc"></div>'+
  '                     </div>'+
  '                  </div>'+
  '               </div>'+
  '            </span>'+
  '    </div>'+
  '    <div data-cai="c30" class="SlwI7e">'+
  '        <div id="body:c30">'+
  '            <div class="i8Zvz">'+
  '                <div class="R6Ozpf qhIQqf">'+
  '                    <div class="jVjeQd" dir="ltr">'+
  '                </div>'+
  '            </div>'+
  '        </div>'+
  '        <div class="i8Zvz"></div>'+
  '    </div>'+
  '    <div class="CKe11d" role="button" tabindex="0" aria-label="View comments">'+
  '        <div aria-hidden="true">'+
  '            <div class="EMg45"></div>'+
  '        </div>'+
  '    </div>'+
  '    <div class="QeQGL">'+
  '        <div data-fh="false" data-sc="true" class="SVDMFb VrClg">'+
  '            <div class="pf7Psf kQxXGc tgi2ee" data-c="google-plus" data-si="14" data-av="true">'+
  '                <content class="x2sGwe aRDqpc">'+
  '                    <div>'+
  '                        <div class="JPtOFc">'+
  '                            <img class="WWCMIb vD3nIe" width="36" height="36">'+
  '                            <div class="QBU0S PnFuuf">'+
  '                                <div class="L0Slxe" tabindex="0" role="button">Add a comment...</div>'+
  '                            </div>'+
  '                        </div>'+
  '                    </div>'+
  '                </content>'+
  '                <div class="tb3unb" style="display:none;" aria-hidden="true">'+
  '                    <div class="xn2mde gn1yRe">'+
  '                        <img class="Xy5NZc n5wdGe" src="https://ssl.gstatic.com/social/plusappui/drag_drop_overlay_3ba422a8b93491a55b6fd8e5a6f5790d.png" aria-hidden="true">'+
  '                        <div class="mlwXqe D5zEId">Drag photo here to add to your comment</div>'+
  '                    </div>'+
  '                </div>'+
  '            </div>'+
  '        </div>'+
  '        <div class="b4FgKc xAPqUc" role="toolbar" aria-label="Post actions">'+
  '            <div class="JzCzjd">'+
  '                <div data-itemid="update/z12mjloprzmbxzlhm04cgjn4jsr5ipc4gc4" data-count="5" data-pressed="false" class="oHo9me">'+
  '                    <div role="button" class="U26fgb mUbCce fKz7Od GsLz7c teCjMb" aria-label="+1" aria-disabled="false" tabindex="0" aria-describedby="c31" aria-pressed="false">'+
  '                        <div class="VTBa7b MbhUzd"></div>'+
  '                        <content class="xjKiLb">'+
  '                           <span style="top: -12px">'+
  '                              <div class="G7pzvd" style="margin-left:3px">'+
  '                                 <svg width="100%" height="100%">'+
  '                                    <path class="Ce1Y1c" d="M10 8H8v4H4v2h4v4h2v-4h4v-2h-4zm4.5-1.92V7.9l2.5-.5V18h2V5z"></path>'+
  '                                 </svg>'+
  '                              </div>'+
  '                           </span>'+
  '                        </content>'+
  '                    </div>'+
  '                    <span class="cUjEhd" id="c31"> 5 plus ones</span>'+
  '                </div>'+
  '                <div class="M8ZOee" aria-hidden="true"></div>'+
  '                <div class="oHo9me">'+
  '                    <div role="button" class="U26fgb mUbCce fKz7Od GsLz7c" aria-label="Share" aria-disabled="false" tabindex="0" aria-describedby="c32">'+
  '                        <div class="VTBa7b MbhUzd"></div>'+
  '                        <content class="xjKiLb">'+
  '                           <span style="top: -12px">'+
  '                              <div class="XVzU0b G7pzvd pdkqBe">'+
  '                                 <svg height="100%" width="100%">'+
  '                                    <path class="Ce1Y1c" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7 l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"></path>'+
  '                                 </svg>'+
  '                              </div>'+
  '                           </span>'+
  '                        </content>'+
  '                    </div>'+
  '                    <span class="cUjEhd" id="c32"> no shares</span>'+
  '                </div>'+
  '                <div class="M8ZOee" aria-hidden="true"></div>'+
  '            </div>'+
  '        </div>'+
  '    </div>'+
  '</div>';

// A loading image URL.
var LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';

// Displays a Post in the UI.
function displayPost(postId, postData) {
  var div = document.getElementById(postId);
  // If an element for that post does not exists yet we create it.
  if (!div) {
    var container = document.createElement('div');
    container.innerHTML = POST_TEMPLATE;
    div = container.firstChild;
    div.setAttribute('id', postId);
    postListElement.insertBefore(div, postListElement.firstChild);
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
  var path = '/plusoners/' + postId + '/' + firebase.auth().currentUser.providerData[0].uid + '/id';
  firebase.database().ref(path).once('value').then(function(snapshot) {
    if(snapshot.val()) {
      var element = div.querySelector('[aria-label="+1"]');
      element.classList.add('y7OZL');
      element.classList.add('M9Bg4d');
    }
  });

  // display the current user profile picture next to the comment UI
  div.querySelector('.WWCMIb').src = firebase.auth().currentUser.photoURL;
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

signOutButtonElement.addEventListener('click', signOut);
signInButtonElement.addEventListener('click', signIn);

// initialize Firebase
initFirebaseAuth();

// We load currently existing chat messages and listen to new ones.
loadPosts();
