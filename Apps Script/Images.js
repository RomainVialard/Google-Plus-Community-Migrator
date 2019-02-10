// This function should usually fail with an uncatchable error: "Exceeded memory limit"
function exportImages() {
  var lock = LockService.getUserLock();
  // wait for 100ms only. If one instance of the script is already executing, abort.
  var lockAcquired = ErrorHandler.expBackoff(function(){
    return lock.tryLock(100);
  });
  if (!lockAcquired || lockAcquired instanceof Error) return;
  
  var userProperties = PropertiesService.getUserProperties();
  var properties = userProperties.getProperties();
  
  var fbDatabaseUrl = properties["fbDatabaseUrl"] || FIREBASE_DB_URL;
  var firebaseProject = properties["firebaseProject"] || null;
  var onlySyncNewPosts = properties["onlySyncNewPosts"] || false;
  var onlySyncNewImages = properties["onlySyncNewImages"] || false;
  
  var token = ScriptApp.getOAuthToken();
  var fb = FirebaseApp.getDatabaseByUrl(fbDatabaseUrl || FIREBASE_DB_URL, token);
  
  var data = fb.getData("imagesToExport");
  var nbOfImagesExported = 0;
  for (var postId in data) {
    var imageUrl = data[postId];
    var newData = {};
    var firebaseImageRef = saveImageToStorage(firebaseProject, postId, imageUrl);
    if (firebaseImageRef) {
      newData["posts/" + postId + "/object/attachments/0/image/firebaseImageRef"] = firebaseImageRef;
    }
    newData["imagesToExport/" + postId] = null;
    fb.updateData('', newData);
    nbOfImagesExported++;
  }
  if (!nbOfImagesExported && onlySyncNewPosts && !onlySyncNewImages) {
    userProperties.setProperty("onlySyncNewImages", true);
    
    // Also send an email notification
    var currentUserEmailAddress = Session.getEffectiveUser();
    var subject = "Google+ exporter to Firebase - all images exported!";
    var body = "Images linked to your posts have been exported to Firebase Storage.";
    MailApp.sendEmail(currentUserEmailAddress, subject, body, {htmlBody: body});
    
    console.log("All images exported");
    deleteExistingTriggers("exportImages");
    ErrorHandler.expBackoff(function(){
      ScriptApp.newTrigger("exportImages").timeBased().everyMinutes(30).create();
    });
  }
}

function saveImageToStorage(firebaseProject, postId, imageUrl) {
  var response = ErrorHandler.urlFetchWithExpBackOff(imageUrl, {
    muteHttpExceptions: true,
    throwOnFailure: true,
    retryNumber: 1,
    verbose: true
  });
  if (response.getResponseCode() !== 200) {
    return null;
  }
  var blob = response.getBlob();
  var bytes = blob.getBytes();
  var token = ScriptApp.getOAuthToken();
  var options = {
    method: "POST",
    contentLength: bytes.length,
    contentType: blob.getContentType(),
    payload: bytes,
    headers: {
      Authorization: 'Bearer ' + token
    },
    throwOnFailure: true
  };

  var bucketName = firebaseProject + ".appspot.com";
  var filePathAndName = postId + "/" + blob.getName();
  var uploadUrl = 'https://www.googleapis.com/upload/storage/v1/b/' + bucketName + '/o?uploadType=media&name=' + filePathAndName;
  var response = ErrorHandler.urlFetchWithExpBackOff(uploadUrl, options).getContentText();
  var storageObject = JSON.parse(response);  
  return storageObject.name;
}
