function removeTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
}

function informUser_(subject) {
  var properties = PropertiesService.getScriptProperties().getProperties();
  var nbOfPostsRetrieved = parseInt(properties["nbOfPostsRetrieved"]);
  var nbOfRepliesRetrieved = parseInt(properties["nbOfRepliesRetrieved"]);
  var nbOfPlusonersRetrieved = parseInt(properties["nbOfPlusonersRetrieved"]);
  var nbOfResharersRetrieved = parseInt(properties["nbOfResharersRetrieved"]);
  var tmProcessBegan = new Date(properties["tmProcessBegan"]);

  MailApp.sendEmail(
    Session.getEffectiveUser().getEmail(),
    subject,
    '- Retrieved ' + nbOfPostsRetrieved.toFixed(0) + ' posts\n' +
    '- Retrieved ' + nbOfRepliesRetrieved.toFixed(0) + ' replies\n' + 
    '- Retrieved ' + nbOfPlusonersRetrieved.toFixed(0) + ' plusoners\n' + 
    '- Retrieved ' + nbOfResharersRetrieved.toFixed(0) + ' reshares.\n\n' +
    'Took ' + ((new Date() - tmProcessBegan) / 1000 / 60).toFixed(2) + ' minutes.'
  ); 
}
