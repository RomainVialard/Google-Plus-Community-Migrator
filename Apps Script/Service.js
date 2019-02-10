// Until the end of 2018, people needed to make a copy of this project 
// because the quota to use the G+ API was quite low and shared among all users of the project
// Google granted more quota to use the G+ API, so it's now possible to deploy this project as a web app
// and avoid asking people to make a copy of the project
function doGet() {
  return HtmlService.createTemplateFromFile("index").evaluate();
}

function saveSettings(settings) {
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  var properties = PropertiesService.getUserProperties();
  var fbDatabaseUrl = "https://" + settings.firebaseProject + ".firebaseio.com/";
  properties.setProperties({
    firebaseProject: settings.firebaseProject,
    searchQuery: settings.searchQuery,
    exportName: settings.exportName,
    fbDatabaseUrl: fbDatabaseUrl,
    saveImages: true,
    // Save when we started the backup, this will be useful to keep syncing new posts once the whole content has been retrieved
    lastSyncDate: today
  }, true);
  
  console.log("Starting a new export: " + JSON.stringify(settings));
  
  deleteExistingTriggers();
  ErrorHandler.expBackoff(function(){
    ScriptApp.newTrigger("getAllPosts").timeBased().everyMinutes(5).create();
  });
  ErrorHandler.expBackoff(function(){
    ScriptApp.newTrigger("exportImages").timeBased().everyMinutes(1).create();
  });
  console.log("Triggers created");
  
  // Save export name in Firebase
  renameExport(fbDatabaseUrl, settings.exportName);
}

function deleteExistingTriggers(functionName) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i in triggers) {
    if (functionName && triggers[i].getHandlerFunction() != functionName) continue;
    ErrorHandler.expBackoff(function(){
      ScriptApp.deleteTrigger(triggers[i]);
    });
  }
}
