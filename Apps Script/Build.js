function buildPlus_() {
  var Requests; 
  
  Requests = Import.Requests;
  Requests({
    namespace: 'Plus_.getPosts',
    config: {
      discovery: {
        name: 'plus',
        version: 'v1',
        resource: 'activities',
        method: 'search'
      },
      oauth: 'me',
      method: 'get',
      throwErrors: true
    }
  });
  Requests({
    namespace: 'Plus_.getPostInformation',
    config: {
      discovery: {
        name: 'plus',
        version: 'v1',
        resource: 'people',
        method: 'listByActivity'
      },
      oauth: 'me',
      method: 'get',
      fetch: false,
      throwErrors: true
    },
  });
  Requests({
    namespace: 'Plus_.getComments',
    config: {
      discovery: {
        name: 'plus',
        version: 'v1',
        resource: 'comments',
        method: 'list'
      },
      oauth: 'me',
      method: 'get',
      fetch: false,
      throwErrors: true
    },
  });
}
