function getGoogleId(properties) {
  if (!properties) properties = PropertiesService.getUserProperties();
  var googleId = properties.getProperty('googleId');
  if (!googleId) {
    var token = ScriptApp.getOAuthToken();
    
    var url = "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" + token;
    var response = ErrorHandler.urlFetchWithExpBackOff(url);
    var tokeninfo = JSON.parse(response.getContentText());
    
    if (tokeninfo.sub) googleId = tokeninfo.sub;
    else if (tokeninfo.user_id) googleId = tokeninfo.user_id;
    else {
      // try to get Google ID from userInfo
      var url = "https://www.googleapis.com/oauth2/v3/userinfo?access_token=" + token;
      var response = ErrorHandler.urlFetchWithExpBackOff(url);
      var tokeninfo = JSON.parse(response.getContentText());
      
      if (tokeninfo.sub) googleId = tokeninfo.sub;
      else if (tokeninfo.id) googleId = tokeninfo.id;
    }
    properties.setProperty('googleId', googleId);
  }
  return googleId;
};