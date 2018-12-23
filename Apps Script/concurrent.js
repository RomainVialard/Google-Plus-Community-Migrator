/*
  Retrieves comments, plusoners, and reshares by interacting with the endpoints concurrently
  and through pagination
*/

function getInfoByPost(postId, which) {
  var response, Plus, ret;
  Plus = buildPlus_();
  ret = ErrorHandler.expBackoff(function(){
    return Plus.getPostInformation({
      activityId: postId,
      collection: which
    }).pageByTokens('items');
  });
  if (ret instanceof Error) {
    throw ret;
  }
  return ret;
}

function getComments(postId) {
  var response, Plus, ret;
  Plus = buildPlus_();
  ret = ErrorHandler.expBackoff(function(){
    return Plus.getComments({
      activityId: postId
    }).pageByTokens('items');
  });
  if (ret instanceof Error) {
    throw ret;
  }
  return ret;
}

function concurrentlyGetPostItems(postId) {
  var Requests = Import.Requests, response;
  
  // backoff for Plus endpoints is handled in the child process
  return Requests.concurrently(function (builder) {
    builder.add('getInfoByPost', postId, 'plusoners');
    builder.add('getInfoByPost', postId, 'resharers');
    builder.add('getComments', postId);
  });

}

