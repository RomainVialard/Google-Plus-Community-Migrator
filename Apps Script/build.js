function buildPlus_() {
  var Requests, Plus = {}; 
  
  Requests = Import.Requests;
  Requests({
    base: Plus,
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
      throwErrors: true,
    }
  });
  Requests({
    base: Plus,
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
      throwErrors: true,
    },
  });
  Requests({
    base: Plus,
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
      throwErrors: true,
    },
  });
  return Plus;
}

