function buildPlus_() {
  var Requests, Plus_ = {}; 
  
  Requests = Import.Requests;
  Requests({
    base: Plus_,
    attr: 'getPosts',
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
    base: Plus_,
    attr: 'getPostInformation',
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
    base: Plus_,
    attr: 'getComments',
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
  return Plus_;
}

