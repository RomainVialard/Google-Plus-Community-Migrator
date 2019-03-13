/* global firebase */

'use strict';

// Sign in Firebase using popup auth and Google as the identity provider.
function signIn() {
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
}

// Sign out of Firebase.
function signOut() {
    firebase.auth().signOut();
}

  // Listen to auth state changes.
function initFirebaseAuth() {
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

let pageSize = 20;
let referenceToLastValue = '';
let referenceToLastKey = undefined;

function loadPosts() {
  
    page++;
    
    if(typeof(msnry) === 'undefined' || isNaN(msnry.cols)) {
        msnry = new Masonry('.grid', {
            itemSelector: '.grid-item',
            columnWidth: '.grid-sizer',
            percentPosition: true,
            horizontalOrder: true,
            transitionDuration: 0,
            gutter: 8
        });
    }
    
    if(msnry.colYs.length === 0) {
      console.warn("msnry.colYs.length === 0");
    }

    var sortMethod = document.getElementById("sortMethod").value;
    var query = firebase.database().ref('/posts/').orderByChild(sortMethod);
  
    if (referenceToLastValue) {
        // retrieve 1 additional posts + the last one previously retrieved: 11
        query = query.limitToLast(pageSize + 1).endAt(referenceToLastValue, referenceToLastKey);
    } else {
        query = query.limitToLast(pageSize);
    }
  
    query.on('child_added', function(snapshot) {
        
        var postId = snapshot.key;
        var postData = snapshot.val();
        
        var div = displayPost(postId, postData);
        msnry.prepended(div);
        
        if (! referenceToLastKey) {
            referenceToLastKey = postId;
            switch(sortMethod) {
                case "object/replies/totalItems":
                  referenceToLastValue = postData.object.replies.totalItems;
                  break;
                case "object/plusoners/totalItems":
                  referenceToLastValue = postData.object.plusoners.totalItems;
                  break;
                case "object/resharers/totalItems":
                  referenceToLastValue = postData.object.resharers.totalItems;
                  break;
                default:
                  // published
                  referenceToLastValue = postData.published;
            }
        }
  });
  referenceToLastKey = undefined;
  if(page === 1) {
    setTimeout(function() {msnry.layout();}, 800);
  }
}

// remove all posts when user performs a search / sort; then reload them from Firebase.
function reloadPosts() {
    
    /* visually remove the items from the layout */
    var postList = document.getElementById("posts");
    var items = postList.getElementsByClassName("grid-item");
    
    /* also remove the items from DOM */
    while (postList.lastChild !== null) {
        postList.removeChild(postList.lastChild);
        msnry.remove(postList.lastChild);
    }
    
    clearLayout();
    loadPosts();
}

// Triggers when the auth state change for instance when the user signs-in or signs-out.
// TODO: this does not yet remove the profile picture from the posts & it also breaks the script.
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
  if (div) {
      
      /* todo: comment avatars & plusones would need to be updated */
      return false;
  }

  var template = document.getElementById("template-holder").querySelector("template");
  var copy = document.importNode(template.content, true);
  
  div = copy.querySelector('div');
  div.id = "post_" + postId;
  
  if (!referenceToOldestPost) {
      // postListElement.appendChild(div);
  } else {
      // postListElement.insertBefore(div, referenceToOldestPost);
  }
  // msnry.appended(div);
  
  referenceToOldestPost = div;
  nbOfPostsDisplayed++;
  
  div.querySelector('.MqU2J').src = postData.actor.image.url;
  div.querySelector('.sXku1c').textContent = postData.actor.displayName;

  var publicationDate = moment(postData.published);
  div.querySelector('.o8gkze').textContent = publicationDate.fromNow() + " ("+ nbOfPostsDisplayed+")";

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
      } else {
        plusOnesContainer.dataset.pressed = false;
      }
    });

    // display the current user profile picture next to the comment UI
    div.querySelector('.WWCMIb').src = currentUser.photoURL;
  } else {
    // if user not authenticated, hide profile picture placeholder + comment textbox
    div.querySelector('.JPtOFc').style.display = 'none';
  }

  // RESHARES
  if (postData.object.resharers.totalItems) {
    div.querySelectorAll('.M8ZOee')[1].textContent = postData.object.resharers.totalItems;
  }

  // COMMENTS
  if (postData.object.replies.totalItems) {
    if (postData.object.replies.totalItems > 3) {
      div.querySelector('.GA5Ak').style.display = "block";
      div.querySelector('.CwaK9').firstChild.innerText = "Show all " + postData.object.replies.totalItems + " comments";
    }

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
        msnry.layout();
      }
    });
  }
  
  // console.log("index "+index+": "+postId + " > " + publicationDate.fromNow());
  var index = (page*pageSize) + (nbOfPostsDisplayed-1 -(page*pageSize));
  posts[index] = div;
  if(nbOfPostsDisplayed % pageSize === 0) {
      var j=0; 
      var rev = posts.slice(nbOfPostsDisplayed-pageSize, nbOfPostsDisplayed).reverse();
      for(var i=posts.length-pageSize; i < posts.length; i++) {
        if(typeof(rev[j]) !== 'undefined') {
          var div = rev[j];
          postListElement.appendChild(div);
          msnry.appended(div);
        }
        j++;
      }
      console.log("loaded page " + page + "; " + nbOfPostsDisplayed + " items.");
      // msnry.layout();
  }
}

var msnry, posts;
var posts = [];
var page = 0;

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

// update page / site title with value in Firebase
firebase.database().ref("siteTitle").once('value').then(function(snapshot) {
  if(snapshot.val()) {
    var siteTitle = snapshot.val();
    document.title = siteTitle;
    document.querySelector('meta[name="description"]').setAttribute("content", siteTitle);
    document.querySelector('meta[name="application-name"]').setAttribute("content", siteTitle);
    document.querySelector('meta[name="apple-mobile-web-app-title"]').setAttribute("content", siteTitle);
    document.getElementsByTagName('h3')[0].innerText = siteTitle;
  } else {
      console.log("Firebase: the siteTitle is not defined.");
  }
});

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
  msnry.layout();
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
      
      msnry.layout();
    }
  });
}

function togglePlusoned(el) {
  
  // check if user is authenticated.
  if (!firebase.auth().currentUser) {
    // Display a message to the user using a Toast.
    snackbarElement.MaterialSnackbar.showSnackbar({
      message: 'You must sign-in to +1 a post.',
      timeout: 1500
    });
    return false;
  }

  var postId = el.dataset.itemid.replace("update/", "");
  var userGoogleId = firebase.auth().currentUser.providerData[0].uid;

  var subEl = el.querySelector('[aria-label="+1"]');
  if (el.dataset.pressed === "true") {
      
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
        el.parentNode.querySelector('.M8ZOee').textContent = el.dataset.count;
      }
    });
    
  } else {
    
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
        el.parentNode.querySelector('.M8ZOee').textContent = el.dataset.count;
      }
    });
  }
}

function clearLayout() {
  
  referenceToLastKey = '';
  referenceToLastValue = '';
  referenceToOldestPost = '';
  nbOfPostsDisplayed = 0;
  
  /* visually remove the items from the layout */
  var postList = document.getElementById("posts");
  var items = postList.getElementsByClassName("grid-item");
  msnry.remove(items);
  
  /* also remove the items from DOM */
  while (postList.lastChild !== null) {
    postList.removeChild(postList.lastChild);
  }
  
  msnry._resetLayout();
  posts = [];
  page = 0;
}
